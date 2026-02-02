"""Shared utilities for social API routes."""

from __future__ import annotations

from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.follow import Follow
from app.schemas.social import SocialUser


async def get_follow_sets(db: AsyncSession, user_id: UUID) -> tuple[set[UUID], set[UUID]]:
    """Get the sets of users the given user follows and is followed by."""
    following_result = await db.execute(
        select(Follow.following_id).where(Follow.follower_id == user_id)
    )
    followers_result = await db.execute(
        select(Follow.follower_id).where(Follow.following_id == user_id)
    )
    following_ids = {row[0] for row in following_result.all()}
    follower_ids = {row[0] for row in followers_result.all()}
    return following_ids, follower_ids


def build_social_user(
    user: User,
    following_ids: set[UUID],
    follower_ids: set[UUID],
) -> SocialUser:
    """Build a SocialUser response with follow relationship info."""
    return SocialUser(
        id=user.id,
        username=user.username,
        avatar_url=user.avatar_url,
        bio=user.bio,
        is_following=user.id in following_ids,
        is_followed_by=user.id in follower_ids,
    )
