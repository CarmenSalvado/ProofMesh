"""User notification endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.notification import Notification
from app.api.deps import get_current_user
from app.schemas.social import NotificationResponse, NotificationListResponse, NotificationMarkRead
from .utils import get_follow_sets, build_social_user

router = APIRouter()


@router.get("/notifications", response_model=NotificationListResponse)
async def list_notifications(
    unread_only: bool = False,
    limit: int = Query(default=30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List user's notifications."""
    query = select(Notification).options(selectinload(Notification.actor)).where(
        Notification.user_id == current_user.id
    )
    
    if unread_only:
        query = query.where(Notification.is_read == False)
    
    query = query.order_by(Notification.created_at.desc()).limit(limit)
    result = await db.execute(query)
    notifications = result.scalars().all()
    
    unread_result = await db.execute(
        select(Notification).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
        )
    )
    unread_count = len(unread_result.scalars().all())
    
    following_ids, follower_ids = await get_follow_sets(db, current_user.id)
    
    payload = []
    for n in notifications:
        actor_user = None
        if n.actor:
            actor_user = build_social_user(n.actor, following_ids, follower_ids)
        
        payload.append(NotificationResponse(
            id=n.id,
            type=n.type.value,
            title=n.title,
            content=n.content,
            actor=actor_user,
            target_type=n.target_type,
            target_id=n.target_id,
            extra_data=n.extra_data,
            is_read=n.is_read,
            created_at=n.created_at,
        ))
    
    return NotificationListResponse(
        notifications=payload,
        total=len(payload),
        unread_count=unread_count,
    )


@router.post("/notifications/read")
async def mark_notifications_read(
    data: NotificationMarkRead,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark notifications as read."""
    result = await db.execute(
        select(Notification).where(
            Notification.user_id == current_user.id,
            Notification.id.in_(data.notification_ids),
        )
    )
    notifications = result.scalars().all()
    
    for n in notifications:
        n.is_read = True
    
    await db.commit()
    return {"status": "marked_read", "count": len(notifications)}


@router.post("/notifications/read-all")
async def mark_all_notifications_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark all notifications as read."""
    result = await db.execute(
        select(Notification).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
        )
    )
    notifications = result.scalars().all()
    
    for n in notifications:
        n.is_read = True
    
    await db.commit()
    return {"status": "all_marked_read", "count": len(notifications)}
