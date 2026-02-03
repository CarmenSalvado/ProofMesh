"""
Pattern Store - Manages research pattern storage and retrieval.
Based on Idea2Paper's pattern system for research paradigms.

Patterns represent proven research methodologies/paradigms extracted from
clusters of real papers. They provide structured guidance for paper generation
including solution approaches and story packaging strategies.
"""

from __future__ import annotations

import uuid
from typing import Optional, List, Dict

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from .knowledge_graph import KnowledgeGraphService


class PatternStore:
    """
    Service for storing and retrieving research patterns.

    Patterns are stored as KnowledgeNodes with is_pattern=True and include:
    - Cluster size (number of papers in this pattern)
    - Representative ideas from papers in the cluster
    - Common problems addressed by this pattern
    - Solution approaches (technical means)
    - Story guides (narrative packaging strategies)
    - Skeleton examples (complete paper structures)
    """

    def __init__(self, kg_service: Optional[KnowledgeGraphService] = None):
        """
        Initialize the Pattern Store.

        Args:
            kg_service: Optional KnowledgeGraphService instance
        """
        self.kg_service = kg_service or KnowledgeGraphService()

    async def store_pattern(
        self,
        session: AsyncSession,
        name: str,
        cluster_size: int,
        representative_ideas: List[str],
        common_problems: List[str],
        solution_approaches: List[str],
        story_guides: List[str],
        skeleton_examples: List[Dict],
        domains: Optional[List[str]] = None,
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict] = None
    ) -> uuid.UUID:
        """
        Store a research pattern in the Knowledge Graph.

        Args:
            session: Database session
            name: Pattern name (e.g., "Contrastive Learning Frameworks")
            cluster_size: Number of papers in this pattern cluster
            representative_ideas: Sample ideas from papers in this pattern
            common_problems: Typical problems addressed by this pattern
            solution_approaches: Common technical solutions
            story_guides: Narrative strategies for packaging
            skeleton_examples: Example paper structures
            domains: Academic domains
            tags: Additional tags
            metadata: Additional metadata

        Returns:
            UUID of the created pattern node
        """
        # Build pattern content from components
        content = f"""Research Pattern: {name}
Cluster Size: {cluster_size} papers

Common Problems:
{chr(10).join(f'- {p}' for p in common_problems[:3])}

Solution Approaches:
{chr(10).join(f'- {s}' for s in solution_approaches[:3])}

Story Guides:
{chr(10).join(f'- {s}' for s in story_guides[:2])}"""

        # Build extra_data with pattern-specific information
        extra_data = {
            "is_pattern": True,
            "cluster_size": cluster_size,
            "representative_ideas": representative_ideas[:5],
            "common_problems": common_problems,
            "solution_approaches": solution_approaches,
            "story_guides": story_guides,
            "skeleton_examples": skeleton_examples[:3],
            **(metadata or {})
        }

        # Store as a KnowledgeNode with is_pattern=True
        node_id = await self.kg_service.add_node(
            session=session,
            title=name,
            content=content,
            node_type="CONCEPT",  # Patterns are conceptual structures
            source="imported",
            quality_score=0.7,  # Default quality
            domains=domains or [],
            tags=tags or [],
            metadata=extra_data
        )

        # Also set cluster_size and is_pattern directly
        from app.models.knowledge_graph import KnowledgeNode
        from sqlalchemy import update

        await session.execute(
            update(KnowledgeNode)
            .where(KnowledgeNode.id == node_id)
            .values(cluster_size=cluster_size, is_pattern=True)
        )
        await session.commit()

        return node_id

    async def recall_patterns(
        self,
        session: AsyncSession,
        query: str,
        top_k: int = 20,
        min_quality: float = 0.3
    ) -> List[Dict]:
        """
        Retrieve relevant patterns using three-path retrieval.

        Args:
            session: Database session
            query: Query text (e.g., user's research idea)
            top_k: Number of patterns to retrieve
            min_quality: Minimum quality score threshold

        Returns:
            List of pattern dicts with metadata
        """
        # Use Knowledge Graph's retrieve method
        result = await self.kg_service.retrieve(
            session=session,
            query=query,
            node_types=["CONCEPT"],  # Patterns are stored as CONCEPT nodes
            top_k=top_k * 3,  # Get more to filter for patterns
            min_quality=min_quality,
            use_all_paths=True
        )

        # Filter for pattern nodes and convert to dict format
        patterns = []

        # Import KnowledgeNode to check extra_data
        from app.models.knowledge_graph import KnowledgeNode

        # Need to get full nodes to check is_pattern flag
        node_ids = [n.id for n in result.nodes[:top_k * 3]]
        if not node_ids:
            return []

        # Query full nodes
        stmt = select(KnowledgeNode).where(KnowledgeNode.id.in_(node_ids))
        kg_result = await session.execute(stmt)
        nodes = {n.id: n for n in kg_result.scalars().all()}

        for retrieved_node in result.nodes:
            node = nodes.get(retrieved_node.id)
            if not node:
                continue

            # Only include nodes marked as patterns
            if not node.is_pattern:
                continue

            extra_data = node.extra_data or {}

            pattern_dict = {
                "pattern_id": str(node.id),
                "name": node.title,
                "size": node.cluster_size or extra_data.get("cluster_size", 0),
                "summary": {
                    "representative_ideas": extra_data.get("representative_ideas", []),
                    "common_problems": extra_data.get("common_problems", []),
                    "solution_approaches": extra_data.get("solution_approaches", []),
                    "story": extra_data.get("story_guides", [])
                },
                "skeleton_examples": extra_data.get("skeleton_examples", []),
                "domains": node.domains or [],
                "tags": node.tags or [],
                "recall_score": retrieved_node.combined_score,
                "idea_score": retrieved_node.idea_score,
                "domain_score": retrieved_node.domain_score,
                "technique_score": retrieved_node.technique_score
            }
            patterns.append(pattern_dict)

            if len(patterns) >= top_k:
                break

        return patterns

    async def get_pattern_by_id(
        self,
        session: AsyncSession,
        pattern_id: str
    ) -> Optional[Dict]:
        """
        Get pattern details by ID.

        Args:
            session: Database session
            pattern_id: Pattern UUID as string

        Returns:
            Pattern dict or None if not found
        """
        from app.models.knowledge_graph import KnowledgeNode

        try:
            node_uuid = uuid.UUID(pattern_id)
        except ValueError:
            return None

        stmt = select(KnowledgeNode).where(KnowledgeNode.id == node_uuid)
        result = await session.execute(stmt)
        node = result.scalar_one_or_none()

        if not node or not node.is_pattern:
            return None

        extra_data = node.extra_data or {}

        return {
            "pattern_id": str(node.id),
            "name": node.title,
            "size": node.cluster_size or extra_data.get("cluster_size", 0),
            "summary": {
                "representative_ideas": extra_data.get("representative_ideas", []),
                "common_problems": extra_data.get("common_problems", []),
                "solution_approaches": extra_data.get("solution_approaches", []),
                "story": extra_data.get("story_guides", [])
            },
            "skeleton_examples": extra_data.get("skeleton_examples", []),
            "domains": node.domains or [],
            "tags": node.tags or []
        }

    async import_patterns_from_idea2paper(
        self,
        session: AsyncSession,
        patterns_data: List[Dict]
    ) -> List[uuid.UUID]:
        """
        Bulk import patterns from Idea2Paper format.

        Args:
            session: Database session
            patterns_data: List of pattern dicts from Idea2Paper

        Returns:
            List of created pattern IDs
        """
        pattern_ids = []

        for pattern_data in patterns_data:
            try:
                pattern_id = await self.store_pattern(
                    session=session,
                    name=pattern_data.get("name", ""),
                    cluster_size=pattern_data.get("size", 0),
                    representative_ideas=pattern_data.get("representative_ideas", []),
                    common_problems=pattern_data.get("common_problems", []),
                    solution_approaches=pattern_data.get("solution_approaches", []),
                    story_guides=pattern_data.get("story_guides", []),
                    skeleton_examples=pattern_data.get("skeleton_examples", []),
                    domains=pattern_data.get("domains", []),
                    tags=pattern_data.get("tags", []),
                    metadata={"imported_from": "idea2paper"}
                )
                pattern_ids.append(pattern_id)
            except Exception as e:
                print(f"Error importing pattern {pattern_data.get('name')}: {e}")
                continue

        await session.commit()
        return pattern_ids


# Singleton instance
_pattern_store: Optional[PatternStore] = None


def get_pattern_store() -> PatternStore:
    """Get or create the singleton PatternStore instance."""
    global _pattern_store
    if _pattern_store is None:
        _pattern_store = PatternStore()
    return _pattern_store
