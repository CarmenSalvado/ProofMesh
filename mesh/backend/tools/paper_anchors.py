"""
Paper Anchors - Manages anchor papers for calibrated multi-agent review.
Based on Idea2Paper's review index system.

Anchor papers provide the "ground truth" for multi-agent review by allowing
the model to compare generated stories against real papers with known review
scores. This produces calibrated, auditable 1-10 scores.

The service implements quantile-based anchor selection and adaptive densification
for optimal calibration across the score distribution.
"""

from __future__ import annotations

import math
from typing import Optional, List, Dict

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func

from app.models.paper_anchor import PaperAnchor


class PaperAnchorService:
    """
    Service for managing anchor papers and their review statistics.

    Provides deterministic anchor selection for calibrated multi-agent review.
    Implements quantile-based selection and adaptive densification strategies.
    """

    def __init__(self):
        """Initialize the Paper Anchor Service."""
        pass

    async def add_anchor(
        self,
        session: AsyncSession,
        paper_id: str,
        title: str,
        abstract: str,
        avg_score: float,
        review_count: int,
        highest_score: float,
        lowest_score: float,
        pattern_id: Optional[str] = None,
        venue: Optional[str] = None,
        year: Optional[int] = None,
        domains: Optional[List[str]] = None,
        tags: Optional[List[str]] = None,
        is_exemplar: bool = False
    ) -> PaperAnchor:
        """
        Add a paper anchor with computed fields.

        Args:
            session: Database session
            paper_id: Unique identifier (e.g., OpenReview ID)
            title: Paper title
            abstract: Paper abstract
            avg_score: Average review score (normalized 0-1)
            review_count: Number of reviews
            highest_score: Highest review score
            lowest_score: Lowest review score
            pattern_id: Associated pattern ID
            venue: Conference/journal name
            year: Publication year
            domains: Academic domains
            tags: Research tags
            is_exemplar: Whether this is a high-quality exemplar

        Returns:
            Created PaperAnchor instance
        """
        # Convert avg_score from 0-1 to 1-10 scale
        score10 = 1 + 9 * avg_score

        # Compute dispersion on 1-10 scale
        highest10 = 1 + 9 * highest_score
        lowest10 = 1 + 9 * lowest_score
        dispersion10 = highest10 - lowest10

        # Compute weight: reliability based on review count and dispersion
        # More reviews + less dispersion = higher weight
        weight = math.log(1 + review_count) / (1 + max(dispersion10, 0.0))

        anchor = PaperAnchor(
            paper_id=paper_id,
            title=title,
            abstract=abstract,
            pattern_id=pattern_id,
            avg_score=avg_score,
            review_count=review_count,
            highest_score=highest_score,
            lowest_score=lowest_score,
            score10=score10,
            dispersion10=dispersion10,
            weight=weight,
            venue=venue,
            year=year,
            domains=domains or [],
            tags=tags or [],
            is_exemplar=is_exemplar
        )

        session.add(anchor)
        await session.flush()

        return anchor

    async def get_pattern_anchors(
        self,
        session: AsyncSession,
        pattern_id: str
    ) -> List[Dict]:
        """
        Get all anchors for a specific pattern.

        Args:
            session: Database session
            pattern_id: Pattern ID

        Returns:
            List of anchor dicts sorted by score10
        """
        stmt = select(PaperAnchor).where(
            PaperAnchor.pattern_id == pattern_id
        ).order_by(PaperAnchor.score10)

        result = await session.execute(stmt)
        anchors = result.scalars().all()

        return [
            {
                "paper_id": a.paper_id,
                "title": a.title,
                "pattern_id": a.pattern_id,
                "score10": a.score10,
                "review_count": a.review_count,
                "dispersion10": a.dispersion10,
                "weight": a.weight,
                "is_exemplar": a.is_exemplar
            }
            for a in anchors
        ]

    async def select_quantile_anchors(
        self,
        session: AsyncSession,
        pattern_id: str,
        quantiles: Optional[List[float]] = None
    ) -> List[Dict]:
        """
        Select anchors at specific quantiles of the score distribution.
        Used for initial anchor selection in review.

        Args:
            session: Database session
            pattern_id: Pattern ID
            quantiles: Quantiles to select (default: [0.1, 0.25, 0.5, 0.75, 0.9])

        Returns:
            List of selected anchor dicts
        """
        quantiles = quantiles or [0.1, 0.25, 0.5, 0.75, 0.9]

        # Get all anchors for pattern, ordered by score
        stmt = select(PaperAnchor).where(
            PaperAnchor.pattern_id == pattern_id
        ).order_by(PaperAnchor.score10)

        result = await session.execute(stmt)
        anchors = result.scalars().all()

        if not anchors:
            return []

        # Select by quantile
        selected = []
        n = len(anchors)

        for q in quantiles:
            idx = int(round(q * (n - 1)))
            idx = max(0, min(n - 1, idx))
            anchor = anchors[idx]
            selected.append({
                "paper_id": anchor.paper_id,
                "title": anchor.title,
                "pattern_id": anchor.pattern_id,
                "score10": anchor.score10,
                "review_count": anchor.review_count,
                "dispersion10": anchor.dispersion10,
                "weight": anchor.weight,
                "is_exemplar": anchor.is_exemplar
            })

        return selected

    async def add_exemplar_anchors(
        self,
        session: AsyncSession,
        pattern_id: str,
        current_anchors: List[Dict],
        max_exemplars: int = 2
    ) -> List[Dict]:
        """
        Add exemplar anchors (high-quality representatives).

        Args:
            session: Database session
            pattern_id: Pattern ID
            current_anchors: Currently selected anchors
            max_exemplars: Maximum number of exemplars to add

        Returns:
            Combined list of anchors with exemplars
        """
        anchor_ids = {a["paper_id"] for a in current_anchors}

        # Get exemplars not already in anchors
        stmt = select(PaperAnchor).where(
            and_(
                PaperAnchor.pattern_id == pattern_id,
                PaperAnchor.is_exemplar == True,
                PaperAnchor.paper_id.not_in(anchor_ids)
            )
        ).order_by(PaperAnchor.weight.desc(), PaperAnchor.review_count.desc())

        result = await session.execute(stmt)
        exemplars = result.scalars().all()

        added = []
        for exemplar in exemplars[:max_exemplars]:
            added.append({
                "paper_id": exemplar.paper_id,
                "title": exemplar.title,
                "pattern_id": exemplar.pattern_id,
                "score10": exemplar.score10,
                "review_count": exemplar.review_count,
                "dispersion10": exemplar.dispersion10,
                "weight": exemplar.weight,
                "is_exemplar": True
            })

        return current_anchors + added

    async def select_adaptive_anchors(
        self,
        session: AsyncSession,
        pattern_id: str,
        selected_ids: List[str],
        s_hint: float,
        offsets: Optional[List[float]] = None,
        max_total: int = 9
    ) -> List[Dict]:
        """
        Select additional anchors adaptively based on hint score.
        Used for densification in review.

        Args:
            session: Database session
            pattern_id: Pattern ID
            selected_ids: IDs of already selected anchors
            s_hint: Hint score for densification
            offsets: Offsets from hint score to target
            max_total: Maximum total anchors after densification

        Returns:
            Combined list of anchors with new selections
        """
        offsets = offsets or [-0.5, 0.5, -0.25, 0.25]

        target_scores = [s_hint + offset for offset in offsets]

        # Get anchors not already selected
        stmt = select(PaperAnchor).where(
            and_(
                PaperAnchor.pattern_id == pattern_id,
                PaperAnchor.paper_id.not_in(selected_ids)
            )
        )

        result = await session.execute(stmt)
        all_anchors = result.scalars().all()

        # Find closest anchors to target scores
        added = []
        used_ids = set()

        for target in target_scores:
            closest = min(
                [a for a in all_anchors if a.paper_id not in used_ids],
                key=lambda a: abs(a.score10 - target),
                default=None
            )
            if closest and len(current_anchors) + len(added) < max_total:
                used_ids.add(closest.paper_id)
                added.append({
                    "paper_id": closest.paper_id,
                    "title": closest.title,
                    "pattern_id": closest.pattern_id,
                    "score10": closest.score10,
                    "review_count": closest.review_count,
                    "dispersion10": closest.dispersion10,
                    "weight": closest.weight,
                    "is_exemplar": closest.is_exemplar
                })

        return added

    async def get_pattern_quantiles(
        self,
        session: AsyncSession,
        pattern_id: str,
        quantiles: Optional[List[float]] = None
    ) -> Dict:
        """
        Get quantile statistics for a pattern's score distribution.

        Args:
            session: Database session
            pattern_id: Pattern ID
            quantiles: Quantiles to compute

        Returns:
            Dict with quantile statistics
        """
        quantiles = quantiles or [0.5, 0.75]

        stmt = select(PaperAnchor.score10).where(
            PaperAnchor.pattern_id == pattern_id
        ).order_by(PaperAnchor.score10)

        result = await session.execute(stmt)
        scores = [r[0] for r in result.all()]

        if not scores:
            return {"n": 0}

        data = {"n": len(scores)}
        for q in quantiles:
            idx = int(round(q * (len(scores) - 1)))
            key = f"q{int(q * 100)}"
            data[key] = float(scores[idx])

        return data

    async def import_from_openreview(
        self,
        session: AsyncSession,
        papers_data: List[Dict],
        pattern_id: Optional[str] = None
    ) -> List[PaperAnchor]:
        """
        Bulk import papers from OpenReview format.

        Args:
            session: Database session
            papers_data: List of paper dicts with review data
            pattern_id: Optional pattern ID to associate with

        Returns:
            List of created PaperAnchor instances
        """
        anchors = []

        for paper_data in papers_data:
            try:
                anchor = await self.add_anchor(
                    session=session,
                    paper_id=paper_data.get("paper_id", ""),
                    title=paper_data.get("title", ""),
                    abstract=paper_data.get("abstract", ""),
                    avg_score=paper_data.get("avg_score", 0.5),
                    review_count=paper_data.get("review_count", 0),
                    highest_score=paper_data.get("highest_score", 1.0),
                    lowest_score=paper_data.get("lowest_score", 0.0),
                    pattern_id=pattern_id,
                    venue=paper_data.get("venue"),
                    year=paper_data.get("year"),
                    domains=paper_data.get("domains", []),
                    tags=paper_data.get("tags", []),
                    is_exemplar=paper_data.get("is_exemplar", False)
                )
                anchors.append(anchor)
            except Exception as e:
                print(f"Error importing paper {paper_data.get('paper_id')}: {e}")
                continue

        await session.commit()
        return anchors


# Singleton instance
_anchor_service: Optional[PaperAnchorService] = None


def get_paper_anchor_service() -> PaperAnchorService:
    """Get or create the singleton PaperAnchorService instance."""
    global _anchor_service
    if _anchor_service is None:
        _anchor_service = PaperAnchorService()
    return _anchor_service
