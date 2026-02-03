"""
Story Model - Generated paper stories from Idea2Paper pipeline.
Stores structured narratives for research papers with all sections.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Text, Float, Boolean, Integer, JSON, Index, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Story(Base):
    """
    A structured paper story generated from an idea and pattern.

    A story contains all sections needed for a research paper narrative:
    - Title and abstract
    - Problem framing and gap identification
    - Solution approach and method skeleton
    - Innovation claims and experiments plan

    Stories can be refined over multiple iterations based on review feedback.
    Each refinement creates a new version with parent_story_id pointing to
    the previous version.
    """
    __tablename__ = "stories"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Linkage
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    problem_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("problems.id", ondelete="SET NULL"), nullable=True
    )
    canvas_ai_run_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("canvas_ai_runs.id", ondelete="SET NULL"), nullable=True
    )

    # Source information
    user_idea: Mapped[str] = mapped_column(Text, nullable=False)
    pattern_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    pattern_name: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Story content (structured paper narrative)
    # All text fields support LaTeX formatting
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    abstract: Mapped[str] = mapped_column(Text, nullable=False)

    # Problem framing: What problem does this address?
    problem_framing: Mapped[str] = mapped_column(Text, nullable=False)

    # Gap pattern: What's missing in current approaches?
    gap_pattern: Mapped[str] = mapped_column(Text, nullable=False)

    # Solution: What's the proposed approach?
    solution: Mapped[str] = mapped_column(Text, nullable=False)

    # Method skeleton: High-level method steps (semicolon-separated)
    method_skeleton: Mapped[str] = mapped_column(Text, nullable=False)

    # Innovation claims: Key claims of novelty/contribution
    innovation_claims: Mapped[list] = mapped_column(ARRAY(String(1000)), nullable=False)

    # Experiments plan: How to validate the approach?
    experiments_plan: Mapped[str] = mapped_column(Text, nullable=False)

    # Fusion information (if idea fusion was used)
    fused_idea_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Review scores (from Enhanced Critic with anchors)
    review_scores: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    avg_score: Mapped[float] = mapped_column(Float, default=0.0)  # 1-10 scale
    passed_review: Mapped[bool] = mapped_column(default=False, index=True)

    # Novelty check results (embedding-based similarity detection)
    novelty_report: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    max_similarity: Mapped[float] = mapped_column(Float, default=0.0)  # 0-1
    risk_level: Mapped[str] = mapped_column(String(20), default="unknown")  # low, medium, high

    # Version tracking for iterative refinement
    version: Mapped[int] = mapped_column(Integer, default=1)
    parent_story_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stories.id", ondelete="SET NULL"), nullable=True
    )

    # Embedding for similarity search
    embedding: Mapped[Optional[list]] = mapped_column(nullable=True)  # Will use Vector type

    # Metadata
    generation_metadata: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    __table_args__ = (
        Index('ix_stories_user', 'user_id'),
        Index('ix_stories_problem', 'problem_id'),
        Index('ix_stories_pattern', 'pattern_id'),
        Index('ix_stories_avg_score', 'avg_score'),
        Index('ix_stories_passed', 'passed_review'),
        Index('ix_stories_risk', 'risk_level'),
        Index('ix_stories_parent', 'parent_story_id'),
    )

    def __repr__(self) -> str:
        return f"<Story(id={str(self.id)[:8]}, title='{self.title[:30]}...', version={self.version})>"
