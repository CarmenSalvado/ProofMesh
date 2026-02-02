"""User directory, connections, and follow/unfollow endpoints."""

from __future__ import annotations

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.follow import Follow
from app.models.activity import Activity, ActivityType
from app.api.deps import get_current_user
from app.schemas.social import SocialUser, UserDirectoryResponse, ConnectionsResponse
from .utils import get_follow_sets, build_social_user

router = APIRouter()


@router.get("/users", response_model=UserDirectoryResponse)
async def list_users(
    q: str | None = None,
    limit: int = Query(default=30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List users with optional search."""
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
