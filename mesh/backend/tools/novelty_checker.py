"""
Novelty Checker - Embedding-based similarity detection for research ideas.
Based on Idea2Paper's novelty checking system with pivot strategies.

The NoveltyChecker detects potential plagiarism or excessive similarity
between generated stories and existing work (stories and knowledge nodes).
It uses embedding-based cosine similarity and provides risk assessments.
"""

from __future__ import annotations

import uuid
import math
from typing import Optional, List, Dict

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.models.story import Story
from app.models.knowledge_graph import KnowledgeNode

from .embeddings import EmbeddingService


class NoveltyChecker:
    """
    Checks novelty of research stories against existing papers/stories.

    Uses embedding-based similarity with configurable risk thresholds:
    - high risk: similarity >= 0.85
    - medium risk: similarity >= 0.75
    - low risk: similarity < 0.75
    """

    # Risk thresholds
    HIGH_RISK_THRESHOLD = 0.85
    MEDIUM_RISK_THRESHOLD = 0.75

    def __init__(self, embedding_service: Optional[EmbeddingService] = None):
        """
        Initialize the Novelty Checker.

        Args:
            embedding_service: Optional EmbeddingService instance
        """
        self.embedding_service = embedding_service or EmbeddingService()

    def _build_story_text(self, story: Dict) -> str:
        """
        Build searchable text from story dict.

        Args:
            story: Story dict with sections

        Returns:
            Combined text for embedding
        """
        parts = [
            story.get("title", ""),
            story.get("abstract", ""),
            story.get("problem_framing", ""),
            story.get("solution", ""),
            story.get("method_skeleton", ""),
            " ".join(story.get("innovation_claims", []))
        ]
        return " ".join(parts)

    async def check_novelty(
        self,
        session: AsyncSession,
        story: Dict,
        top_k: int = 10,
        exclude_story_id: Optional[str] = None
    ) -> Dict:
        """
        Check novelty against existing stories and knowledge nodes.

        Args:
            session: Database session
            story: Story dict to check
            top_k: Number of similar items to return
            exclude_story_id: ID to exclude from comparison (for revisions)

        Returns:
            Novelty report with risk level and similar items
        """
        story_text = self._build_story_text(story)

        # Generate embedding for the story
        story_embedding = await self.embedding_service.embed_for_document(story_text)

        # Check against existing stories
        candidates = []

        # 1. Check against Story table
        stmt = select(Story).where(
            and_(
                Story.embedding.isnot(None),
                Story.id != uuid.UUID(exclude_story_id) if exclude_story_id else True
            )
        )
        result = await session.execute(stmt)
        existing_stories = result.scalars().all()

        for existing in existing_stories:
            if existing.embedding:
                similarity = self._cosine_similarity(story_embedding, existing.embedding)
                candidates.append({
                    "type": "story",
                    "id": str(existing.id),
                    "title": existing.title,
                    "similarity": similarity,
                    "abstract": existing.abstract[:200] + "..." if len(existing.abstract) > 200 else existing.abstract
                })

        # 2. Check against KnowledgeNode (theorems, papers)
        kg_stmt = select(KnowledgeNode).where(
            and_(
                KnowledgeNode.embedding.isnot(None),
                KnowledgeNode.node_type.in_(["THEOREM", "PAPER", "PROPOSITION", "CONCEPT"])
            )
        )
        kg_result = await session.execute(kg_stmt)
        nodes = kg_result.scalars().all()

        for node in nodes[:100]:  # Limit to prevent excessive computation
            if node.embedding:
                similarity = self._cosine_similarity(story_embedding, node.embedding)
                candidates.append({
                    "type": "knowledge",
                    "id": str(node.id),
                    "title": node.title,
                    "similarity": similarity,
                    "content": node.content[:200] + "..." if len(node.content) > 200 else node.content
                })

        # Sort by similarity
        candidates.sort(key=lambda x: x["similarity"], reverse=True)
        top_candidates = candidates[:top_k]

        # Calculate risk level
        max_sim = max([c["similarity"] for c in top_candidates]) if top_candidates else 0.0

        if max_sim >= self.HIGH_RISK_THRESHOLD:
            risk_level = "high"
        elif max_sim >= self.MEDIUM_RISK_THRESHOLD:
            risk_level = "medium"
        else:
            risk_level = "low"

        return {
            "risk_level": risk_level,
            "max_similarity": max_sim,
            "candidates": top_candidates,
            "total_checked": len(candidates),
            "embedding_available": True
        }

    def _cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """
        Calculate cosine similarity between two vectors.

        Args:
            vec1: First vector
            vec2: Second vector

        Returns:
            Cosine similarity (0-1)
        """
        if not vec1 or not vec2:
            return 0.0

        dot = sum(a * b for a, b in zip(vec1, vec2))
        norm1 = math.sqrt(sum(a * a for a in vec1))
        norm2 = math.sqrt(sum(b * b for b in vec2))

        if norm1 == 0 or norm2 == 0:
            return 0.0

        return dot / (norm1 * norm2)

    async def update_story_embedding(
        self,
        session: AsyncSession,
        story_id: uuid.UUID
    ) -> bool:
        """
        Generate and store embedding for a story.

        Args:
            session: Database session
            story_id: Story ID

        Returns:
            True if successful, False otherwise
        """
        stmt = select(Story).where(Story.id == story_id)
        result = await session.execute(stmt)
        story = result.scalar_one_or_none()

        if not story:
            return False

        # Build text and generate embedding
        story_text = self._build_story_text({
            "title": story.title,
            "abstract": story.abstract,
            "problem_framing": story.problem_framing,
            "solution": story.solution,
            "method_skeleton": story.method_skeleton,
            "innovation_claims": story.innovation_claims
        })

        embedding = await self.embedding_service.embed_for_document(story_text)

        # Update story
        story.embedding = embedding
        await session.commit()

        return True


# Singleton instance
_novelty_checker: Optional[NoveltyChecker] = None


def get_novelty_checker() -> NoveltyChecker:
    """Get or create the singleton NoveltyChecker instance."""
    global _novelty_checker
    if _novelty_checker is None:
        _novelty_checker = NoveltyChecker()
    return _novelty_checker
