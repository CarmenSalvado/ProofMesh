from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING
from sqlalchemy import String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, ENUM

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class StarTargetType(str, Enum):
    PROBLEM = "problem"
    LIBRARY_ITEM = "library_item"
    DISCUSSION = "discussion"


class Star(Base):
    """A star (like/bookmark) on a problem, library item, or discussion."""
    
    __tablename__ = "stars"
    __table_args__ = (
        UniqueConstraint("user_id", "target_type", "target_id", name="uq_user_star"),
    )
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    
    # User who starred
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    
    # Target type and ID (polymorphic)
    target_type: Mapped[StarTargetType] = mapped_column(
        ENUM(StarTargetType, name="star_target_type", create_type=True),
        nullable=False
    )
    target_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    
    # Timestamp
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    
    # Relationships
    user: Mapped["User"] = relationship("User", backref="stars")
