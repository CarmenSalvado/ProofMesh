import uuid
from datetime import datetime
from enum import Enum
from sqlalchemy import String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, ENUM

from app.database import Base


class CanvasStatus(str, Enum):
    DRAFT = "draft"
    VERIFIED = "verified"
    REVIEWING = "reviewing"


class Canvas(Base):
    __tablename__ = "canvases"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    problem_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("problems.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    folder: Mapped[str] = mapped_column(String(512), nullable=False, default="/")
    
    # Fluid canvas: single markdown document
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    
    status: Mapped[CanvasStatus] = mapped_column(
        ENUM(CanvasStatus, name="canvas_status", create_type=True),
        nullable=False,
        default=CanvasStatus.DRAFT
    )
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )
    
    # Relationships
    problem: Mapped["Problem"] = relationship("Problem", back_populates="canvases")
    lines: Mapped[list["CanvasLine"]] = relationship(
        "CanvasLine", back_populates="canvas", cascade="all, delete-orphan"
    )
    agent_runs: Mapped[list["AgentRun"]] = relationship(
        "AgentRun", back_populates="canvas", cascade="all, delete-orphan"
    )
