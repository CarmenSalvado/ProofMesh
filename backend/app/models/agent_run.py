import uuid
from datetime import datetime
from enum import Enum
from sqlalchemy import DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, ENUM, JSONB

from app.database import Base


class AgentRunStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    FAILED = "failed"
    DONE = "done"


class AgentRun(Base):
    __tablename__ = "agent_runs"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    canvas_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("canvases.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[AgentRunStatus] = mapped_column(
        ENUM(AgentRunStatus, name="agent_run_status", create_type=True),
        nullable=False,
        default=AgentRunStatus.QUEUED
    )
    
    # JSON fields
    input_context: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    output: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    tool_logs: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    
    # Relationships
    canvas: Mapped["Canvas"] = relationship("Canvas", back_populates="agent_runs")
    inserted_lines: Mapped[list["CanvasLine"]] = relationship("CanvasLine", back_populates="agent_run")
