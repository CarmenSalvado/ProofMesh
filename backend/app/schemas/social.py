from __future__ import annotations

from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class SocialUser(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    username: str
    avatar_url: str | None = None
    bio: str | None = None
    is_following: bool = False
    is_followed_by: bool = False


class UserDirectoryResponse(BaseModel):
    users: list[SocialUser]
    total: int


class ConnectionsResponse(BaseModel):
    followers: list[SocialUser]
    following: list[SocialUser]
    total_followers: int
    total_following: int


class FeedActor(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    username: str
    avatar_url: str | None = None


class FeedProblem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    visibility: str


class FeedItem(BaseModel):
    id: UUID
    type: str
    actor: FeedActor
    problem: FeedProblem | None = None
    target_id: UUID | None = None
    extra_data: dict | None = None
    created_at: datetime


class FeedResponse(BaseModel):
    items: list[FeedItem]
    total: int


class ContributorSummary(BaseModel):
    id: UUID
    username: str
    avatar_url: str | None = None
    contributions: int
    last_contributed_at: datetime | None = None


class ProblemContribution(BaseModel):
    problem_id: UUID
    problem_title: str
    visibility: str
    total_contributions: int
    last_activity_at: datetime | None = None
    contributors: list[ContributorSummary]


class ProblemContributionsResponse(BaseModel):
    problems: list[ProblemContribution]
    total: int


# ========================
# Discussion Schemas
# ========================

class DiscussionBase(BaseModel):
    title: str
    content: str


class DiscussionCreate(DiscussionBase):
    problem_id: UUID | None = None
    library_item_id: UUID | None = None


class DiscussionUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    is_resolved: bool | None = None
    is_pinned: bool | None = None


class DiscussionResponse(DiscussionBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    author: SocialUser
    problem_id: UUID | None = None
    library_item_id: UUID | None = None
    is_resolved: bool
    is_pinned: bool
    comment_count: int = 0
    created_at: datetime
    updated_at: datetime


class DiscussionListResponse(BaseModel):
    discussions: list[DiscussionResponse]
    total: int


# ========================
# Comment Schemas
# ========================

class CommentBase(BaseModel):
    content: str


class CommentCreate(CommentBase):
    parent_id: UUID | None = None


class CommentUpdate(BaseModel):
    content: str


class CommentResponse(CommentBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    author: SocialUser
    discussion_id: UUID
    parent_id: UUID | None = None
    reply_count: int = 0
    created_at: datetime
    updated_at: datetime


class CommentListResponse(BaseModel):
    comments: list[CommentResponse]
    total: int


# ========================
# Star Schemas
# ========================

class StarCreate(BaseModel):
    target_type: str  # problem, library_item, discussion
    target_id: UUID


class StarResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    target_type: str
    target_id: UUID
    created_at: datetime


class StarListResponse(BaseModel):
    stars: list[StarResponse]
    total: int


# ========================
# Notification Schemas
# ========================

class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    type: str
    title: str
    content: str | None = None
    actor: SocialUser | None = None
    target_type: str | None = None
    target_id: UUID | None = None
    extra_data: dict | None = None
    is_read: bool
    created_at: datetime


class NotificationListResponse(BaseModel):
    notifications: list[NotificationResponse]
    total: int
    unread_count: int


class NotificationMarkRead(BaseModel):
    notification_ids: list[UUID]


# ========================
# Team Schemas
# ========================

class TeamBase(BaseModel):
    name: str
    description: str | None = None
    is_public: bool = True


class TeamCreate(TeamBase):
    slug: str


class TeamUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    is_public: bool | None = None
    avatar_url: str | None = None


class TeamMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user: SocialUser
    role: str
    joined_at: datetime


class TeamResponse(TeamBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    slug: str
    avatar_url: str | None = None
    member_count: int = 0
    problem_count: int = 0
    created_at: datetime
    updated_at: datetime


class TeamDetailResponse(TeamResponse):
    members: list[TeamMemberResponse] = []


class TeamListResponse(BaseModel):
    teams: list[TeamResponse]
    total: int


class TeamInvite(BaseModel):
    user_id: UUID
    role: str = "member"  # admin or member


class TeamAddProblem(BaseModel):
    problem_id: UUID


# ========================
# Trending Schemas
# ========================

class TrendingProblem(BaseModel):
    id: UUID
    title: str
    description: str | None = None
    author: SocialUser
    tags: list[str] = []
    star_count: int = 0
    activity_score: float = 0.0
    recent_activity_count: int = 0
    trend_label: str | None = None  # "Hot", "+12%", etc.


class TrendingResponse(BaseModel):
    problems: list[TrendingProblem]
    total: int


class PlatformStats(BaseModel):
    total_users: int = 0
    total_problems: int = 0
    total_verified_items: int = 0
    total_discussions: int = 0
    active_users_today: int = 0
