from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING
from sqlalchemy import String, Text, DateTime, ForeignKey, Boolean, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, ENUM

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class NotificationType(str, Enum):
    # Social
    FOLLOW = "follow"
    MENTION = "mention"
    
    # Discussions
    NEW_DISCUSSION = "new_discussion"
    NEW_COMMENT = "new_comment"
    REPLY_TO_COMMENT = "reply_to_comment"
    
    # Problems
    PROBLEM_FORKED = "problem_forked"
    PROBLEM_STARRED = "problem_starred"
    
    # Verification
    ITEM_VERIFIED = "item_verified"
    ITEM_REJECTED = "item_rejected"
    
    # Team
    TEAM_INVITE = "team_invite"
    TEAM_JOIN = "team_join"
    
    # System
    SYSTEM = "system"


class Notification(Base):
    """A notification for a user."""
    
    __tablename__ = "notifications"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    
    # Recipient
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    
    # Notification type
    type: Mapped[NotificationType] = mapped_column(
        ENUM(
            NotificationType,
            name="notification_type",
            create_type=True,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        nullable=False
    )
    
    # Title and content
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Actor (who triggered the notification)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    
    # Target reference (polymorphic via JSON)
    target_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    target_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    
    # Extra data (JSON for flexibility)
    extra_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    
    # Status
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    
    # Timestamp
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False, index=True
    )
    
    # Relationships
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], backref="notifications")
    actor: Mapped["User | None"] = relationship("User", foreign_keys=[actor_id])
