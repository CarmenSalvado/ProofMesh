"""
Knowledge Graph Service - Three-Path Retrieval inspired by Idea2Story

This implements semantic search over the mathematical knowledge graph using:
1. Idea Path (0.4): Direct semantic similarity to query
2. Domain Path (0.2): Domain/topic filtering  
3. Technique Path (0.4): Similar proof techniques and methods

The paths are combined to retrieve the most relevant mathematical knowledge.
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime
from dataclasses import dataclass, field
from typing import Optional, Any
from enum import Enum

from sqlalchemy import select, func, and_, or_, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert

from .embeddings import EmbeddingService, get_embedding_service


# Weight configuration for three-path retrieval
IDEA_WEIGHT = 0.4
DOMAIN_WEIGHT = 0.2
TECHNIQUE_WEIGHT = 0.4


class RetrievalPath(Enum):
    """The three paths for knowledge retrieval."""
    IDEA = "idea"  # Direct semantic similarity
    DOMAIN = "domain"  # Domain-based filtering
    TECHNIQUE = "technique"  # Technique similarity


@dataclass
class RetrievedNode:
    """A node retrieved from the Knowledge Graph."""
    id: uuid.UUID
    title: str
    content: str
    node_type: str
    formula: Optional[str] = None
    lean_code: Optional[str] = None
    source: str = "user_proposed"
    quality_score: float = 0.5
    domains: list[str] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)
    
    # Retrieval scores
    idea_score: float = 0.0
    domain_score: float = 0.0
    technique_score: float = 0.0
    combined_score: float = 0.0
    
    # Related edges
    edges_out: list[dict] = field(default_factory=list)
    edges_in: list[dict] = field(default_factory=list)


@dataclass
class RetrievalResult:
    """Result of a knowledge graph retrieval."""
    query: str
    nodes: list[RetrievedNode]
    total_candidates: int
    retrieval_time_ms: int
    paths_used: list[str] = field(default_factory=list)


class KnowledgeGraphService:
    """
    Service for interacting with the mathematical Knowledge Graph.
    
    Implements Three-Path Retrieval for finding relevant theorems,
    definitions, and proof techniques.
    """
    
    def __init__(
        self,
        embedding_service: Optional[EmbeddingService] = None
    ):
        """Initialize the Knowledge Graph service."""
        self.embedding_service = embedding_service or get_embedding_service()
    
    async def retrieve(
        self,
        session: AsyncSession,
        query: str,
        domains: Optional[list[str]] = None,
        node_types: Optional[list[str]] = None,
        top_k: int = 10,
        min_quality: float = 0.3,
        use_all_paths: bool = True
    ) -> RetrievalResult:
        """
        Retrieve relevant knowledge using Three-Path Retrieval.
        
        Args:
            session: Database session
            query: The query text (e.g., "prove sum of even numbers is even")
            domains: Optional domain filter (e.g., ["number_theory", "algebra"])
            node_types: Optional type filter (e.g., ["theorem", "lemma"])
            top_k: Number of results to return
            min_quality: Minimum quality score threshold
            use_all_paths: Whether to use all three paths or just idea path
            
        Returns:
            RetrievalResult with ranked nodes
        """
        start_time = datetime.now()
        
        # Generate query embedding
        query_embedding = await self.embedding_service.embed_for_query(query)
        
        # Build base query with vector similarity
        sql = f"""
            WITH scored_nodes AS (
                SELECT 
                    kn.id,
                    kn.title,
                    kn.content,
                    kn.node_type,
                    kn.formula,
                    kn.lean_code,
                    kn.source,
                    kn.quality_score,
                    kn.domains,
                    kn.tags,
                    1 - (kn.embedding <=> :query_embedding::vector) as idea_score
                FROM knowledge_nodes kn
                WHERE kn.embedding IS NOT NULL
                  AND kn.quality_score >= :min_quality
                  {"AND kn.node_type = ANY(:node_types)" if node_types else ""}
                  {"AND kn.domains && :domains" if domains else ""}
            )
            SELECT *,
                   idea_score * {IDEA_WEIGHT} as weighted_idea
            FROM scored_nodes
            ORDER BY idea_score DESC
            LIMIT :limit
        """
        
        params = {
            "query_embedding": str(query_embedding),
            "min_quality": min_quality,
            "limit": top_k * 3 if use_all_paths else top_k
        }
        
        if node_types:
            params["node_types"] = node_types
        if domains:
            params["domains"] = domains
        
        result = await session.execute(text(sql), params)
        rows = result.fetchall()
        
        if not rows:
            elapsed = int((datetime.now() - start_time).total_seconds() * 1000)
            return RetrievalResult(
                query=query,
                nodes=[],
                total_candidates=0,
                retrieval_time_ms=elapsed,
                paths_used=["idea"]
            )
        
        # Convert to RetrievedNode objects
        nodes: list[RetrievedNode] = []
        for row in rows:
            node = RetrievedNode(
                id=row.id,
                title=row.title,
                content=row.content,
                node_type=row.node_type,
                formula=row.formula,
                lean_code=row.lean_code,
                source=row.source,
                quality_score=row.quality_score,
                domains=row.domains or [],
                tags=row.tags or [],
                idea_score=row.idea_score
            )
            nodes.append(node)
        
        paths_used = ["idea"]
        
        if use_all_paths and domains:
            # Domain path: boost nodes matching specified domains
            for node in nodes:
                if node.domains:
                    domain_overlap = len(set(node.domains) & set(domains)) / len(domains)
                    node.domain_score = domain_overlap
                else:
                    node.domain_score = 0.0
            paths_used.append("domain")
        
        if use_all_paths:
            # Technique path: boost nodes with similar proof techniques
            # Look for technique-related keywords in content and tags
            technique_keywords = self._extract_technique_keywords(query)
            if technique_keywords:
                for node in nodes:
                    technique_matches = 0
                    content_lower = node.content.lower()
                    for kw in technique_keywords:
                        if kw in content_lower or kw in [t.lower() for t in node.tags]:
                            technique_matches += 1
                    node.technique_score = technique_matches / len(technique_keywords) if technique_keywords else 0
                paths_used.append("technique")
        
        # Calculate combined scores
        for node in nodes:
            node.combined_score = (
                node.idea_score * IDEA_WEIGHT +
                node.domain_score * DOMAIN_WEIGHT +
                node.technique_score * TECHNIQUE_WEIGHT
            )
        
        # Sort by combined score and take top_k
        nodes.sort(key=lambda n: n.combined_score, reverse=True)
        nodes = nodes[:top_k]
        
        # Fetch edges for top nodes
        await self._fetch_edges(session, nodes)
        
        elapsed = int((datetime.now() - start_time).total_seconds() * 1000)
        
        return RetrievalResult(
            query=query,
            nodes=nodes,
            total_candidates=len(rows),
            retrieval_time_ms=elapsed,
            paths_used=paths_used
        )
    
    async def add_node(
        self,
        session: AsyncSession,
        title: str,
        content: str,
        node_type: str,
        formula: Optional[str] = None,
        lean_code: Optional[str] = None,
        source: str = "user_proposed",
        source_url: Optional[str] = None,
        source_id: Optional[str] = None,
        quality_score: float = 0.5,
        domains: Optional[list[str]] = None,
        tags: Optional[list[str]] = None,
        user_id: Optional[uuid.UUID] = None,
        problem_id: Optional[uuid.UUID] = None,
        library_item_id: Optional[uuid.UUID] = None,
        metadata: Optional[dict] = None
    ) -> uuid.UUID:
        """
        Add a new node to the Knowledge Graph.
        
        Automatically generates embedding for the content.
        """
        # Generate embedding
        embedding = await self.embedding_service.embed_math_content(
            title=title,
            content=content,
            formula=formula,
            node_type=node_type
        )
        
        node_id = uuid.uuid4()
        
        sql = text("""
            INSERT INTO knowledge_nodes (
                id, title, content, node_type, formula, lean_code,
                embedding, source, source_url, source_id,
                quality_score, domains, tags,
                user_id, problem_id, library_item_id, metadata,
                created_at, updated_at
            ) VALUES (
                :id, :title, :content, :node_type, :formula, :lean_code,
                :embedding::vector, :source, :source_url, :source_id,
                :quality_score, :domains, :tags,
                :user_id, :problem_id, :library_item_id, :metadata,
                NOW(), NOW()
            )
            RETURNING id
        """)
        
        await session.execute(sql, {
            "id": node_id,
            "title": title,
            "content": content,
            "node_type": node_type,
            "formula": formula,
            "lean_code": lean_code,
            "embedding": str(embedding),
            "source": source,
            "source_url": source_url,
            "source_id": source_id,
            "quality_score": quality_score,
            "domains": domains or [],
            "tags": tags or [],
            "user_id": user_id,
            "problem_id": problem_id,
            "library_item_id": library_item_id,
            "metadata": metadata
        })
        
        return node_id
    
    async def add_edge(
        self,
        session: AsyncSession,
        from_node_id: uuid.UUID,
        to_node_id: uuid.UUID,
        edge_type: str,
        weight: float = 1.0,
        effectiveness_score: float = 0.5,
        confidence: float = 1.0,
        label: Optional[str] = None,
        metadata: Optional[dict] = None
    ) -> uuid.UUID:
        """
        Add an edge between two nodes in the Knowledge Graph.
        
        Uses ON CONFLICT to update existing edges.
        """
        edge_id = uuid.uuid4()
        
        sql = text("""
            INSERT INTO knowledge_edges (
                id, from_node_id, to_node_id, edge_type,
                weight, effectiveness_score, confidence,
                label, metadata, created_at
            ) VALUES (
                :id, :from_node_id, :to_node_id, :edge_type,
                :weight, :effectiveness_score, :confidence,
                :label, :metadata, NOW()
            )
            ON CONFLICT (from_node_id, to_node_id, edge_type)
            DO UPDATE SET
                weight = EXCLUDED.weight,
                effectiveness_score = EXCLUDED.effectiveness_score,
                metadata = EXCLUDED.metadata
            RETURNING id
        """)
        
        result = await session.execute(sql, {
            "id": edge_id,
            "from_node_id": from_node_id,
            "to_node_id": to_node_id,
            "edge_type": edge_type,
            "weight": weight,
            "effectiveness_score": effectiveness_score,
            "confidence": confidence,
            "label": label,
            "metadata": metadata
        })
        
        return result.scalar_one()
    
    async def update_node_quality(
        self,
        session: AsyncSession,
        node_id: uuid.UUID,
        quality_delta: float
    ):
        """Update a node's quality score (e.g., after successful proof)."""
        sql = text("""
            UPDATE knowledge_nodes
            SET quality_score = LEAST(1.0, GREATEST(0.0, quality_score + :delta)),
                usage_count = usage_count + 1,
                updated_at = NOW()
            WHERE id = :node_id
        """)
        
        await session.execute(sql, {"node_id": node_id, "delta": quality_delta})
    
    async def update_edge_effectiveness(
        self,
        session: AsyncSession,
        edge_id: uuid.UUID,
        success: bool
    ):
        """Update edge effectiveness score based on usage outcome."""
        # Simple exponential moving average
        delta = 0.1 if success else -0.05
        
        sql = text("""
            UPDATE knowledge_edges
            SET effectiveness_score = LEAST(1.0, GREATEST(0.0, effectiveness_score + :delta))
            WHERE id = :edge_id
        """)
        
        await session.execute(sql, {"edge_id": edge_id, "delta": delta})
    
    async def find_similar_nodes(
        self,
        session: AsyncSession,
        node_id: uuid.UUID,
        top_k: int = 5
    ) -> list[RetrievedNode]:
        """Find nodes similar to a given node."""
        sql = text("""
            SELECT 
                n2.id, n2.title, n2.content, n2.node_type,
                n2.formula, n2.lean_code, n2.source,
                n2.quality_score, n2.domains, n2.tags,
                1 - (n1.embedding <=> n2.embedding) as similarity
            FROM knowledge_nodes n1
            JOIN knowledge_nodes n2 ON n1.id != n2.id
            WHERE n1.id = :node_id
              AND n2.embedding IS NOT NULL
            ORDER BY n1.embedding <=> n2.embedding
            LIMIT :limit
        """)
        
        result = await session.execute(sql, {"node_id": node_id, "limit": top_k})
        rows = result.fetchall()
        
        nodes = []
        for row in rows:
            node = RetrievedNode(
                id=row.id,
                title=row.title,
                content=row.content,
                node_type=row.node_type,
                formula=row.formula,
                lean_code=row.lean_code,
                source=row.source,
                quality_score=row.quality_score,
                domains=row.domains or [],
                tags=row.tags or [],
                idea_score=row.similarity,
                combined_score=row.similarity
            )
            nodes.append(node)
        
        return nodes
    
    async def get_node_neighborhood(
        self,
        session: AsyncSession,
        node_id: uuid.UUID,
        max_depth: int = 2
    ) -> dict[str, Any]:
        """Get the neighborhood of a node (nodes and edges within max_depth hops)."""
        sql = text("""
            WITH RECURSIVE neighborhood AS (
                -- Base case: the starting node
                SELECT 
                    kn.id, kn.title, kn.node_type, 0 as depth
                FROM knowledge_nodes kn
                WHERE kn.id = :node_id
                
                UNION
                
                -- Recursive case: connected nodes
                SELECT 
                    kn.id, kn.title, kn.node_type, n.depth + 1
                FROM neighborhood n
                JOIN knowledge_edges ke ON ke.from_node_id = n.id OR ke.to_node_id = n.id
                JOIN knowledge_nodes kn ON 
                    (ke.from_node_id = kn.id AND ke.to_node_id = n.id)
                    OR (ke.to_node_id = kn.id AND ke.from_node_id = n.id)
                WHERE n.depth < :max_depth
            )
            SELECT DISTINCT id, title, node_type, MIN(depth) as depth
            FROM neighborhood
            GROUP BY id, title, node_type
            ORDER BY depth, title
        """)
        
        result = await session.execute(sql, {"node_id": node_id, "max_depth": max_depth})
        nodes = [{"id": str(r.id), "title": r.title, "type": r.node_type, "depth": r.depth} 
                 for r in result.fetchall()]
        
        # Get edges between these nodes
        node_ids = [n["id"] for n in nodes]
        if node_ids:
            edge_sql = text("""
                SELECT ke.from_node_id, ke.to_node_id, ke.edge_type, ke.weight
                FROM knowledge_edges ke
                WHERE ke.from_node_id = ANY(:node_ids)
                  AND ke.to_node_id = ANY(:node_ids)
            """)
            
            edge_result = await session.execute(edge_sql, {"node_ids": node_ids})
            edges = [{"from": str(r.from_node_id), "to": str(r.to_node_id), 
                     "type": r.edge_type, "weight": r.weight}
                    for r in edge_result.fetchall()]
        else:
            edges = []
        
        return {"nodes": nodes, "edges": edges}
    
    async def _fetch_edges(
        self,
        session: AsyncSession,
        nodes: list[RetrievedNode]
    ):
        """Fetch edges for a list of nodes."""
        if not nodes:
            return
        
        node_ids = [str(n.id) for n in nodes]
        
        sql = text("""
            SELECT 
                ke.from_node_id, ke.to_node_id, ke.edge_type, ke.weight,
                kn.title as connected_title
            FROM knowledge_edges ke
            JOIN knowledge_nodes kn ON 
                (ke.from_node_id = ANY(:node_ids) AND ke.to_node_id = kn.id)
                OR (ke.to_node_id = ANY(:node_ids) AND ke.from_node_id = kn.id)
            WHERE ke.from_node_id = ANY(:node_ids) OR ke.to_node_id = ANY(:node_ids)
        """)
        
        result = await session.execute(sql, {"node_ids": node_ids})
        
        # Build lookup
        node_lookup = {str(n.id): n for n in nodes}
        
        for row in result.fetchall():
            from_id = str(row.from_node_id)
            to_id = str(row.to_node_id)
            
            edge_data = {
                "type": row.edge_type,
                "weight": row.weight,
                "connected_title": row.connected_title
            }
            
            if from_id in node_lookup:
                edge_data["to"] = to_id
                node_lookup[from_id].edges_out.append(edge_data)
            
            if to_id in node_lookup:
                edge_data["from"] = from_id
                node_lookup[to_id].edges_in.append(edge_data)
    
    def _extract_technique_keywords(self, query: str) -> list[str]:
        """Extract proof technique keywords from query."""
        technique_terms = [
            "induction", "contradiction", "contrapositive",
            "direct proof", "construction", "exhaustion",
            "pigeonhole", "counting", "combinatorial",
            "algebraic", "geometric", "analytic",
            "recursion", "well-ordering", "strong induction",
            "cases", "without loss of generality", "wlog",
            "bijection", "injection", "surjection",
            "modular", "divisibility", "congruence"
        ]
        
        query_lower = query.lower()
        found = []
        
        for term in technique_terms:
            if term in query_lower:
                found.append(term)
        
        return found


# Singleton instance
_kg_service: Optional[KnowledgeGraphService] = None


def get_knowledge_graph_service() -> KnowledgeGraphService:
    """Get or create the singleton Knowledge Graph service."""
    global _kg_service
    if _kg_service is None:
        _kg_service = KnowledgeGraphService()
    return _kg_service
