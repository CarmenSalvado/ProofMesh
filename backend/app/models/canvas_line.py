import uuid
from datetime import datetime
from enum import Enum
from sqlalchemy import String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, ENUM

from app.database import Base


class LineType(str, Enum):
    TEXT = "text"
    MATH = "math"
    GOAL = "goal"
    AGENT_INSERT = "agent_insert"
    LIBRARY_REF = "library_ref"
    VERIFICATION = "verification"


class AuthorType(str, Enum):
    HUMAN = "human"
    AGENT = "agent"


class CanvasLine(Base):
    __tablename__ = "canvas_lines"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    canvas_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("canvases.id", ondelete="CASCADE"), nullable=False
    )
    order_key: Mapped[str] = mapped_column(String(64), nullable=False)
    type: Mapped[LineType] = mapped_column(
        ENUM(LineType, name="line_type", create_type=True), nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    author_type: Mapped[AuthorType] = mapped_column(
        ENUM(AuthorType, name="author_type", create_type=True), nullable=False
    )
    author_id: Mapped[str] = mapped_column(String(255), nullable=False)
    
    # Optional references
    agent_run_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("agent_runs.id", ondelete="SET NULL"), nullable=True
    )
    library_item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("library_items.id", ondelete="SET NULL"), nullable=True
    )
    derived_from: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )
    
    # Relationships
    canvas: Mapped["Canvas"] = relationship("Canvas", back_populates="lines")
    agent_run: Mapped["AgentRun | None"] = relationship("AgentRun", back_populates="inserted_lines")
    library_item: Mapped["LibraryItem | None"] = relationship("LibraryItem", back_populates="canvas_refs")
