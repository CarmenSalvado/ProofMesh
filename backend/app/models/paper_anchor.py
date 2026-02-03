"""
Paper Anchor Model - Stores real papers with review statistics for anchored criticism.
Based on Idea2Paper's review index system for calibrated multi-agent review.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Float, Integer, Boolean, DateTime, JSON, Index
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class PaperAnchor(Base):
    """
    A real paper with review statistics, used as anchor for calibrated scoring.
    Papers are typically imported from ICLR/OpenReview data.

    Anchors provide the "ground truth" for multi-agent review by allowing
    the model to compare generated stories against real papers with known
    review scores. This produces calibrated, auditable 1-10 scores.

    The score10 field represents the average review score on a 1-10 scale,
    as used by conferences like ICLR. The weight field combines review count
    and score dispersion to measure reliability.
    """
    __tablename__ = "paper_anchors"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Paper identification
    paper_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    abstract: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)

    # Link to pattern (if from Idea2Paper KG)
    pattern_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)

    # Review statistics (from OpenReview/ICLR)
    # avg_score is normalized 0-1 for internal use
    avg_score: Mapped[float] = mapped_column(Float, default=0.0)
    review_count: Mapped[int] = mapped_column(Integer, default=0)
    highest_score: Mapped[float] = mapped_column(Float, default=0.0)
    lowest_score: Mapped[float] = mapped_column(Float, default=0.0)

    # Computed fields for anchor selection
    # score10: Average score on 1-10 scale (what conferences actually use)
    # dispersion10: Score spread (highest - lowest) on 1-10 scale
    # weight: Reliability weight = log(1 + review_count) / (1 + dispersion10)
    score10: Mapped[float] = mapped_column(Float, default=5.0)
    dispersion10: Mapped[float] = mapped_column(Float, default=0.0)
    weight: Mapped[float] = mapped_column(Float, default=1.0)

    # Metadata
    venue: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # ICLR, NeurIPS, etc.
    year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    domains: Mapped[Optional[list]] = mapped_column(ARRAY(String(100)), nullable=True)
    tags: Mapped[Optional[list]] = mapped_column(ARRAY(String(100)), nullable=True)

    # Flag for exemplar papers (high-quality representatives)
    # Exemplars are papers that best represent their pattern cluster
    is_exemplar: Mapped[bool] = mapped_column(default=False, index=True)

    # Extra metadata
    extra_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    __table_args__ = (
        Index('ix_paper_anchors_pattern', 'pattern_id'),
        Index('ix_paper_anchors_score10', 'score10'),
        Index('ix_paper_anchors_weight', 'weight'),
        Index('ix_paper_anchors_exemplar', 'is_exemplar'),
    )

    def __repr__(self) -> str:
        return f"<PaperAnchor({self.paper_id}, score10={self.score10:.1f}, reviews={self.review_count})>"
