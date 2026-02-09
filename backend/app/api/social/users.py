"""User directory, connections, and follow/unfollow endpoints."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.follow import Follow
from app.models.activity import Activity, ActivityType
from app.models.discussion import Discussion
from app.models.comment import Comment
from app.api.deps import get_current_user
from app.services.auth import get_password_hash
from app.schemas.social import (
    SocialUser,
    UserDirectoryResponse,
    ConnectionsResponse,
    DiscussionResponse,
    CommentResponse,
    UserActivityResponse,
)
from .utils import get_follow_sets, build_social_user

router = APIRouter()
RHO_USERNAME = "rho"
RHO_EMAIL = "rho@proofmesh.ai"
RHO_AVATAR_URL = "https://api.dicebear.com/9.x/bottts-neutral/svg?seed=proofmesh-rho"


async def ensure_rho_user(db: AsyncSession) -> tuple[User, bool]:
    result = await db.execute(select(User).where(func.lower(User.username) == RHO_USERNAME))
    rho_user = result.scalar_one_or_none()
    if rho_user:
        changed = False
        if not rho_user.avatar_url:
            rho_user.avatar_url = RHO_AVATAR_URL
            changed = True
        return rho_user, changed

    result = await db.execute(select(User).where(User.email == RHO_EMAIL))
    rho_user = result.scalar_one_or_none()
    if rho_user:
        changed = False
        if not rho_user.avatar_url:
            rho_user.avatar_url = RHO_AVATAR_URL
            changed = True
        return rho_user, changed

    rho_user = User(
        email=RHO_EMAIL,
        username=RHO_USERNAME,
        password_hash=get_password_hash(f"rho-{datetime.utcnow().isoformat()}"),
        bio="AI mathematical assistant (Gemini-backed)",
        avatar_url=RHO_AVATAR_URL,
    )
    db.add(rho_user)
    await db.flush()
    return rho_user, True


@router.get("/users", response_model=UserDirectoryResponse)
async def list_users(
    q: str | None = None,
    limit: int = Query(default=30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List users with optional search."""
    _, created_rho = await ensure_rho_user(db)
    if created_rho:
        await db.commit()
    query = select(User).where(User.id != current_user.id)
    if q:
        query = query.where(User.username.ilike(f"%{q}%"))
    query = query.order_by(User.created_at.desc()).limit(limit)

    result = await db.execute(query)
    users = result.scalars().all()
    following_ids, follower_ids = await get_follow_sets(db, current_user.id)
    payload = [build_social_user(user, following_ids, follower_ids) for user in users]
    return UserDirectoryResponse(users=payload, total=len(payload))


@router.get("/connections", response_model=ConnectionsResponse)
async def get_connections(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get current user's followers and following."""
    following_ids, follower_ids = await get_follow_sets(db, current_user.id)

    followers_result = await db.execute(
        select(User).join(Follow, Follow.follower_id == User.id).where(
            Follow.following_id == current_user.id
        )
    )
    following_result = await db.execute(
        select(User).join(Follow, Follow.following_id == User.id).where(
            Follow.follower_id == current_user.id
        )
    )

    followers = followers_result.scalars().all()
    following = following_result.scalars().all()

    follower_payload = [build_social_user(user, following_ids, follower_ids) for user in followers]
    following_payload = [build_social_user(user, following_ids, follower_ids) for user in following]

    return ConnectionsResponse(
        followers=follower_payload,
        following=following_payload,
        total_followers=len(follower_payload),
        total_following=len(following_payload),
    )


@router.post("/follow/{user_id}")
async def follow_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Follow a user."""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")

    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    existing = await db.execute(
        select(Follow).where(
            Follow.follower_id == current_user.id,
            Follow.following_id == user_id,
        )
    )
    if existing.scalar_one_or_none():
        return {"status": "already_following"}

    follow = Follow(follower_id=current_user.id, following_id=user_id)
    db.add(follow)
    db.add(
        Activity(
            user_id=current_user.id,
            type=ActivityType.FOLLOWED_USER,
            target_id=user_id,
            extra_data={"target_user_id": str(user_id), "target_username": target.username},
        )
    )
    await db.commit()
    return {"status": "followed"}


@router.delete("/follow/{user_id}")
async def unfollow_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Unfollow a user."""
    result = await db.execute(
        select(Follow).where(
            Follow.follower_id == current_user.id,
            Follow.following_id == user_id,
        )
    )
    follow = result.scalar_one_or_none()
    if not follow:
        return {"status": "not_following"}

    await db.delete(follow)
    await db.commit()
    return {"status": "unfollowed"}


@router.get("/users/{username}/activity", response_model=UserActivityResponse)
async def get_user_activity(
    username: str,
    discussions_limit: int = Query(default=25, ge=1, le=100),
    comments_limit: int = Query(default=25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get profile activity for a user: discussions and comments."""
    if username.lower() == RHO_USERNAME:
        _, created_rho = await ensure_rho_user(db)
        if created_rho:
            await db.commit()

    user_result = await db.execute(
        select(User).where(func.lower(User.username) == username.lower())
    )
    target_user = user_result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    following_ids, follower_ids = await get_follow_sets(db, current_user.id)

    discussions_result = await db.execute(
        select(Discussion)
        .options(selectinload(Discussion.author))
        .where(Discussion.author_id == target_user.id)
        .order_by(Discussion.created_at.desc())
        .limit(discussions_limit)
    )
    discussions = discussions_result.scalars().all()

    comments_result = await db.execute(
        select(Comment)
        .options(selectinload(Comment.author), selectinload(Comment.discussion))
        .where(Comment.author_id == target_user.id)
        .order_by(Comment.created_at.desc())
        .limit(comments_limit)
    )
    comments = comments_result.scalars().all()

    discussion_payload = []
    for discussion in discussions:
        comment_count_result = await db.execute(
            select(Comment).where(Comment.discussion_id == discussion.id)
        )
        discussion_payload.append(
            DiscussionResponse(
                id=discussion.id,
                title=discussion.title,
                content=discussion.content,
                author=build_social_user(discussion.author, following_ids, follower_ids),
                problem_id=discussion.problem_id,
                library_item_id=discussion.library_item_id,
                is_resolved=discussion.is_resolved,
                is_pinned=discussion.is_pinned,
                comment_count=len(comment_count_result.scalars().all()),
                created_at=discussion.created_at,
                updated_at=discussion.updated_at,
            )
        )

    comment_payload = []
    for comment in comments:
        reply_count_result = await db.execute(select(Comment).where(Comment.parent_id == comment.id))
        comment_payload.append(
            CommentResponse(
                id=comment.id,
                content=comment.content,
                author=build_social_user(comment.author, following_ids, follower_ids),
                discussion_id=comment.discussion_id,
                discussion_title=comment.discussion.title if comment.discussion else None,
                parent_id=comment.parent_id,
                reply_count=len(reply_count_result.scalars().all()),
                created_at=comment.created_at,
                updated_at=comment.updated_at,
            )
        )

    return UserActivityResponse(
        user=build_social_user(target_user, following_ids, follower_ids),
        discussions=discussion_payload,
        comments=comment_payload,
        total_discussions=len(discussion_payload),
        total_comments=len(comment_payload),
    )
