"""Discussion and comment management endpoints."""

from __future__ import annotations

import os
import re
from datetime import datetime
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.problem import Problem
from app.models.activity import Activity, ActivityType
from app.models.discussion import Discussion
from app.models.comment import Comment
from app.models.notification import Notification, NotificationType
from app.api.deps import get_current_user
from app.services.auth import get_password_hash
from app.schemas.social import (
    DiscussionCreate,
    DiscussionUpdate,
    DiscussionResponse,
    DiscussionListResponse,
    CommentCreate,
    CommentResponse,
    CommentListResponse,
)
from .utils import get_follow_sets, build_social_user

router = APIRouter()
RHO_USERNAME = "rho"
RHO_EMAIL = "rho@proofmesh.org"
RHO_AVATAR_URL = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'%3E%3Crect width='128' height='128' rx='64' fill='%23111827'/%3E%3Ctext x='64' y='84' text-anchor='middle' font-size='72' font-family='Georgia%2Cserif' fill='white'%3E%26%23961%3B%3C/text%3E%3C/svg%3E"
RHO_MENTION_PATTERN = re.compile(r"(?:^|\s)@rho\b", flags=re.IGNORECASE)


def has_rho_mention(content: str) -> bool:
    return bool(RHO_MENTION_PATTERN.search(content or ""))


async def get_or_create_rho_user(db: AsyncSession) -> User:
    result = await db.execute(select(User).where(func.lower(User.username) == RHO_USERNAME))
    rho_user = result.scalar_one_or_none()
    if rho_user:
        if rho_user.avatar_url != RHO_AVATAR_URL:
            rho_user.avatar_url = RHO_AVATAR_URL
        return rho_user

    result = await db.execute(select(User).where(User.email == RHO_EMAIL))
    rho_user = result.scalar_one_or_none()
    if rho_user:
        if rho_user.avatar_url != RHO_AVATAR_URL:
            rho_user.avatar_url = RHO_AVATAR_URL
        return rho_user

    rho_user = User(
        email=RHO_EMAIL,
        username=RHO_USERNAME,
        password_hash=get_password_hash(f"rho-{datetime.utcnow().isoformat()}"),
        bio="AI mathematical assistant (Gemini-backed)",
        avatar_url=RHO_AVATAR_URL,
    )
    db.add(rho_user)
    await db.flush()
    return rho_user


async def generate_rho_reply(
    *,
    discussion: Discussion,
    question: str,
    recent_comments: list[Comment],
) -> str:
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_GENERATIVE_AI_API_KEY")
    if not api_key:
        return (
            "Rho: I can help critique this, but Gemini is not configured yet. "
            "Set GEMINI_API_KEY and mention @rho again."
        )

    try:
        from google import genai
        from google.genai import types

        history_lines = []
        for item in recent_comments[-6:]:
            history_lines.append(f"{item.author.username}: {item.content}")
        history_text = "\n".join(history_lines) if history_lines else "No prior comments."

        prompt = (
            "You are Rho, an AI mathematical collaborator inside ProofMesh.\n"
            "Give a concise reply (max 6 lines) focused on truth-checking and mathematical rigor.\n"
            "If uncertain, say what should be verified next.\n\n"
            f"Discussion title: {discussion.title}\n"
            f"Discussion content: {discussion.content[:1200]}\n\n"
            f"Recent thread:\n{history_text}\n\n"
            f"User mention: {question}\n"
        )

        client = genai.Client(api_key=api_key)
        response = await client.aio.models.generate_content(
            model="gemini-3-flash-preview",
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.3,
                max_output_tokens=420,
            ),
        )
        text = (response.text or "").strip()
        if not text:
            return "Rho: I could not produce a reliable answer. Please share more details or equations."
        return f"Rho: {text[:1800]}"
    except Exception:
        return (
            "Rho: I could not run a full verification right now. "
            "Please provide the exact claim and assumptions, and I will check it step by step."
        )


# ========================
# Discussion Endpoints
# ========================

@router.get("/discussions", response_model=DiscussionListResponse)
async def list_discussions(
    problem_id: UUID | None = None,
    library_item_id: UUID | None = None,
    limit: int = Query(default=30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List discussions for a problem or library item."""
    query = select(Discussion).options(selectinload(Discussion.author))
    
    if problem_id:
        query = query.where(Discussion.problem_id == problem_id)
    elif library_item_id:
        query = query.where(Discussion.library_item_id == library_item_id)
    
    query = query.order_by(Discussion.is_pinned.desc(), Discussion.created_at.desc()).limit(limit)
    result = await db.execute(query)
    discussions = result.scalars().all()
    
    following_ids, follower_ids = await get_follow_sets(db, current_user.id)
    
    payload = []
    for d in discussions:
        comment_count_result = await db.execute(
            select(Comment).where(Comment.discussion_id == d.id)
        )
        comment_count = len(comment_count_result.scalars().all())
        
        payload.append(DiscussionResponse(
            id=d.id,
            title=d.title,
            content=d.content,
            author=build_social_user(d.author, following_ids, follower_ids),
            problem_id=d.problem_id,
            library_item_id=d.library_item_id,
            is_resolved=d.is_resolved,
            is_pinned=d.is_pinned,
            comment_count=comment_count,
            created_at=d.created_at,
            updated_at=d.updated_at,
        ))
    
    return DiscussionListResponse(discussions=payload, total=len(payload))


@router.post("/discussions", response_model=DiscussionResponse)
async def create_discussion(
    data: DiscussionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new discussion."""
    discussion = Discussion(
        title=data.title,
        content=data.content,
        author_id=current_user.id,
        problem_id=data.problem_id,
        library_item_id=data.library_item_id,
    )
    db.add(discussion)
    await db.flush()
    
    extra_data = {
        "discussion_id": str(discussion.id),
        "discussion_title": data.title,
        "discussion_content": data.content,
    }
    if data.problem_id:
        problem_result = await db.execute(select(Problem).where(Problem.id == data.problem_id))
        problem = problem_result.scalar_one_or_none()
        if problem:
            extra_data["problem_id"] = str(problem.id)
            extra_data["problem_title"] = problem.title
    
    db.add(Activity(
        user_id=current_user.id,
        type=ActivityType.CREATED_DISCUSSION,
        target_id=discussion.id,
        extra_data=extra_data,
    ))
    
    await db.commit()
    await db.refresh(discussion)
    
    following_ids, follower_ids = await get_follow_sets(db, current_user.id)
    
    return DiscussionResponse(
        id=discussion.id,
        title=discussion.title,
        content=discussion.content,
        author=build_social_user(current_user, following_ids, follower_ids),
        problem_id=discussion.problem_id,
        library_item_id=discussion.library_item_id,
        is_resolved=discussion.is_resolved,
        is_pinned=discussion.is_pinned,
        comment_count=0,
        created_at=discussion.created_at,
        updated_at=discussion.updated_at,
    )


@router.get("/discussions/{discussion_id}", response_model=DiscussionResponse)
async def get_discussion(
    discussion_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific discussion."""
    result = await db.execute(
        select(Discussion).options(selectinload(Discussion.author)).where(Discussion.id == discussion_id)
    )
    discussion = result.scalar_one_or_none()
    if not discussion:
        raise HTTPException(status_code=404, detail="Discussion not found")
    
    following_ids, follower_ids = await get_follow_sets(db, current_user.id)
    
    comment_count_result = await db.execute(
        select(Comment).where(Comment.discussion_id == discussion.id)
    )
    comment_count = len(comment_count_result.scalars().all())
    
    return DiscussionResponse(
        id=discussion.id,
        title=discussion.title,
        content=discussion.content,
        author=build_social_user(discussion.author, following_ids, follower_ids),
        problem_id=discussion.problem_id,
        library_item_id=discussion.library_item_id,
        is_resolved=discussion.is_resolved,
        is_pinned=discussion.is_pinned,
        comment_count=comment_count,
        created_at=discussion.created_at,
        updated_at=discussion.updated_at,
    )


@router.patch("/discussions/{discussion_id}", response_model=DiscussionResponse)
async def update_discussion(
    discussion_id: UUID,
    data: DiscussionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a discussion (author only)."""
    result = await db.execute(
        select(Discussion).options(selectinload(Discussion.author)).where(Discussion.id == discussion_id)
    )
    discussion = result.scalar_one_or_none()
    if not discussion:
        raise HTTPException(status_code=404, detail="Discussion not found")
    
    if discussion.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this discussion")
    
    if data.title is not None:
        discussion.title = data.title
    if data.content is not None:
        discussion.content = data.content
    if data.is_resolved is not None:
        discussion.is_resolved = data.is_resolved
    if data.is_pinned is not None:
        discussion.is_pinned = data.is_pinned
    
    await db.commit()
    await db.refresh(discussion)
    
    following_ids, follower_ids = await get_follow_sets(db, current_user.id)
    
    comment_count_result = await db.execute(
        select(Comment).where(Comment.discussion_id == discussion.id)
    )
    comment_count = len(comment_count_result.scalars().all())
    
    return DiscussionResponse(
        id=discussion.id,
        title=discussion.title,
        content=discussion.content,
        author=build_social_user(discussion.author, following_ids, follower_ids),
        problem_id=discussion.problem_id,
        library_item_id=discussion.library_item_id,
        is_resolved=discussion.is_resolved,
        is_pinned=discussion.is_pinned,
        comment_count=comment_count,
        created_at=discussion.created_at,
        updated_at=discussion.updated_at,
    )


@router.delete("/discussions/{discussion_id}")
async def delete_discussion(
    discussion_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a discussion (author only)."""
    result = await db.execute(
        select(Discussion).where(Discussion.id == discussion_id)
    )
    discussion = result.scalar_one_or_none()
    if not discussion:
        raise HTTPException(status_code=404, detail="Discussion not found")
    
    if discussion.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this discussion")
    
    comments = (await db.execute(select(Comment).where(Comment.discussion_id == discussion_id))).scalars().all()
    for comment in comments:
        await db.delete(comment)
    
    await db.delete(discussion)
    await db.commit()
    
    return {"status": "deleted"}


# ========================
# Comment Endpoints
# ========================

@router.get("/discussions/{discussion_id}/comments", response_model=CommentListResponse)
async def list_comments(
    discussion_id: UUID,
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List comments for a discussion."""
    result = await db.execute(
        select(Comment).options(selectinload(Comment.author), selectinload(Comment.discussion))
        .where(Comment.discussion_id == discussion_id)
        .order_by(Comment.created_at.asc())
        .limit(limit)
    )
    comments = result.scalars().all()
    
    following_ids, follower_ids = await get_follow_sets(db, current_user.id)
    
    payload = []
    for c in comments:
        reply_count_result = await db.execute(
            select(Comment).where(Comment.parent_id == c.id)
        )
        reply_count = len(reply_count_result.scalars().all())
        
        payload.append(CommentResponse(
            id=c.id,
            content=c.content,
            author=build_social_user(c.author, following_ids, follower_ids),
            discussion_id=c.discussion_id,
            discussion_title=c.discussion.title if c.discussion else None,
            parent_id=c.parent_id,
            reply_count=reply_count,
            created_at=c.created_at,
            updated_at=c.updated_at,
        ))
    
    return CommentListResponse(comments=payload, total=len(payload))


@router.post("/discussions/{discussion_id}/comments", response_model=CommentResponse)
async def create_comment(
    discussion_id: UUID,
    data: CommentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a comment on a discussion."""
    discussion_result = await db.execute(select(Discussion).where(Discussion.id == discussion_id))
    discussion = discussion_result.scalar_one_or_none()
    if not discussion:
        raise HTTPException(status_code=404, detail="Discussion not found")
    
    comment = Comment(
        content=data.content,
        author_id=current_user.id,
        discussion_id=discussion_id,
        parent_id=data.parent_id,
    )
    db.add(comment)
    await db.flush()
    db.add(
        Activity(
            user_id=current_user.id,
            type=ActivityType.CREATED_COMMENT,
            target_id=comment.id,
            extra_data={
                "discussion_id": str(discussion.id),
                "discussion_title": discussion.title,
                "comment_content": data.content,
                "parent_id": str(data.parent_id) if data.parent_id else None,
                "problem_id": str(discussion.problem_id) if discussion.problem_id else None,
            },
        )
    )
    
    if discussion.author_id != current_user.id:
        notification = Notification(
            user_id=discussion.author_id,
            type=NotificationType.NEW_COMMENT,
            title="New comment on your discussion",
            content=data.content[:100],
            actor_id=current_user.id,
            target_type="discussion",
            target_id=discussion_id,
        )
        db.add(notification)

    if has_rho_mention(data.content):
        recent_result = await db.execute(
            select(Comment)
            .options(selectinload(Comment.author))
            .where(Comment.discussion_id == discussion_id)
            .order_by(Comment.created_at.desc())
            .limit(8)
        )
        recent_comments = list(reversed(recent_result.scalars().all()))
        rho_user = await get_or_create_rho_user(db)
        rho_reply = await generate_rho_reply(
            discussion=discussion,
            question=data.content,
            recent_comments=recent_comments,
        )
        db.add(
            Comment(
                content=rho_reply,
                author_id=rho_user.id,
                discussion_id=discussion_id,
                parent_id=comment.id,
            )
        )
    
    await db.commit()
    await db.refresh(comment)
    
    following_ids, follower_ids = await get_follow_sets(db, current_user.id)
    
    return CommentResponse(
        id=comment.id,
        content=comment.content,
        author=build_social_user(current_user, following_ids, follower_ids),
        discussion_id=comment.discussion_id,
        discussion_title=discussion.title,
        parent_id=comment.parent_id,
        reply_count=0,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
    )
