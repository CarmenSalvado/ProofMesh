import uuid
from datetime import datetime
from enum import Enum
from sqlalchemy import ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, ENUM, JSONB

from app.database import Base


class ActivityType(str, Enum):
    CREATED_PROBLEM = "created_problem"
    CREATED_CANVAS = "created_canvas"
    PUBLISHED_LIBRARY = "published_library"
    FOLLOWED_USER = "followed_user"
    FORKED_PROBLEM = "forked_problem"


class Activity(Base):
    __tablename__ = "activities"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    type: Mapped[ActivityType] = mapped_column(
        ENUM(ActivityType, name="activity_type", create_type=True), nullable=False
    )
    target_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    extra_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False, index=True
    )
    
    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="activities")
