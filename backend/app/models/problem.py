import uuid
from datetime import datetime
from enum import Enum
from sqlalchemy import String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, ENUM, ARRAY

from app.database import Base


class ProblemVisibility(str, Enum):
    PUBLIC = "public"
    PRIVATE = "private"


class ProblemDifficulty(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class Problem(Base):
    __tablename__ = "problems"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    
    # New fields
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    visibility: Mapped[ProblemVisibility] = mapped_column(
        ENUM(ProblemVisibility, name="problem_visibility", create_type=True),
        nullable=False,
        default=ProblemVisibility.PRIVATE
    )
    difficulty: Mapped[ProblemDifficulty | None] = mapped_column(
        ENUM(ProblemDifficulty, name="problem_difficulty", create_type=True),
        nullable=True
    )
    tags: Mapped[list[str]] = mapped_column(
        ARRAY(String(50)), nullable=False, default=list
    )
    fork_of: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("problems.id", ondelete="SET NULL"), nullable=True
    )
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )
    
    # Relationships
    author: Mapped["User"] = relationship("User", back_populates="problems")
    canvases: Mapped[list["Canvas"]] = relationship(
        "Canvas", back_populates="problem", cascade="all, delete-orphan"
    )
    library_items: Mapped[list["LibraryItem"]] = relationship(
        "LibraryItem", back_populates="problem", cascade="all, delete-orphan"
    )
    forked_from: Mapped["Problem | None"] = relationship(
        "Problem", remote_side=[id], foreign_keys=[fork_of]
    )
