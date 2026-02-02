"""
Canvas AI models for persistent exploration runs and chat history.
Follows the same pattern as latex_ai.py but for Canvas reasoning.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import String, Text, DateTime, ForeignKey, Index, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.problem import Problem


class CanvasAIRunStatus(str, Enum):
    """Status of a Canvas AI exploration run."""
    QUEUED = "queued"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class CanvasAIRunType(str, Enum):
    """Type of Canvas AI operation."""
    EXPLORE = "explore"
    FORMALIZE = "formalize"
    VERIFY = "verify"
    CRITIQUE = "critique"
    PIPELINE = "pipeline"
    CHAT = "chat"


class CanvasAIRun(Base):
    """
    Represents a long-running AI exploration/reasoning operation.
    Persists across page reloads and can be resumed.
    """
    __tablename__ = "canvas_ai_runs"
    __table_args__ = (
        Index("ix_canvas_ai_runs_problem_created", "problem_id", "created_at"),
        Index("ix_canvas_ai_runs_status", "status"),
        Index("ix_canvas_ai_runs_problem_status", "problem_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    problem_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("problems.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    
    # Run configuration
    run_type: Mapped[str] = mapped_column(String(32), nullable=False, default=CanvasAIRunType.EXPLORE.value)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    context: Mapped[dict | None] = mapped_column(JSONB, nullable=True)  # Selected nodes, options, etc.
    
    # Status tracking
    status: Mapped[str] = mapped_column(String(32), nullable=False, default=CanvasAIRunStatus.QUEUED.value)
    progress: Mapped[int] = mapped_column(Integer, nullable=False, default=0)  # 0-100
    current_step: Mapped[str | None] = mapped_column(String(128), nullable=True)  # e.g., "Generating node 3/5"
    
    # Results
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    steps: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)  # List of step descriptions
    created_nodes: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)  # List of node IDs created
    created_edges: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)  # List of edge definitions
    result: Mapped[dict | None] = mapped_column(JSONB, nullable=True)  # Final result data
    error: Mapped[str | None] = mapped_column(Text, nullable=True)  # Error message if failed
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    
    # Redis job tracking
    redis_job_id: Mapped[str | None] = mapped_column(String(128), nullable=True)

    # Relationships
    problem: Mapped["Problem"] = relationship("Problem")
    user: Mapped["User"] = relationship("User")
    messages: Mapped[list["CanvasAIMessage"]] = relationship("CanvasAIMessage", back_populates="run", order_by="CanvasAIMessage.created_at")


class CanvasAIMessage(Base):
    """
    Chat messages in the Canvas AI assistant.
    Can be standalone or linked to a run.
    """
    __tablename__ = "canvas_ai_messages"
    __table_args__ = (
        Index("ix_canvas_ai_messages_problem_created", "problem_id", "created_at"),
        Index("ix_canvas_ai_messages_run", "run_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    problem_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("problems.id", ondelete="CASCADE"), nullable=False
    )
    run_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("canvas_ai_runs.id", ondelete="SET NULL"), nullable=True
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    
    # Message content
    role: Mapped[str] = mapped_column(String(16), nullable=False)  # "user", "assistant", "system", "action"
    content: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Structured content for rich rendering (action summaries, node cards, etc.)
    message_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # Example message_data for action message:
    # {
    #   "type": "action_summary",
    #   "action": "explore",
    #   "nodes_created": [{"id": "...", "title": "...", "type": "LEMMA"}],
    #   "edges_created": [{"from": "...", "to": "...", "type": "implies"}],
    #   "run_id": "..."
    # }
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    problem: Mapped["Problem"] = relationship("Problem")
    run: Mapped["CanvasAIRun"] = relationship("CanvasAIRun", back_populates="messages")
    user: Mapped["User"] = relationship("User")


class CanvasAINodeState(Base):
    """
    Tracks real-time state of nodes during AI operations.
    Used for animations and visual feedback.
    """
    __tablename__ = "canvas_ai_node_states"
    __table_args__ = (
        Index("ix_canvas_ai_node_states_run", "run_id"),
        Index("ix_canvas_ai_node_states_node", "node_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("canvas_ai_runs.id", ondelete="CASCADE"), nullable=False
    )
    node_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("library_items.id", ondelete="CASCADE"), nullable=True
    )
    
    # For nodes being created (before they exist in library_items)
    temp_node_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    
    # Visual state
    state: Mapped[str] = mapped_column(String(32), nullable=False, default="idle")
    # States: "idle", "thinking", "generating", "verifying", "complete", "error"
    
    # Additional info for rendering
    state_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # e.g., {"message": "Formalizing...", "progress": 50}
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    run: Mapped["CanvasAIRun"] = relationship("CanvasAIRun")
