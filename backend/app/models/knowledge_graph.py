"""
Knowledge Graph Models for mathematical knowledge storage and retrieval.
Inspired by Idea2Story's pre-computed graph with semantic relationships.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    String, Text, Float, Integer, Boolean, DateTime, ForeignKey, Index, JSON,
    Enum as SQLEnum, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class KnowledgeNodeType(str, Enum):
    """Types of knowledge nodes in the graph."""
    THEOREM = "theorem"
    LEMMA = "lemma"
    DEFINITION = "definition"
    AXIOM = "axiom"
    COROLLARY = "corollary"
    PROPOSITION = "proposition"
    PROOF_TECHNIQUE = "proof_technique"
    CONCEPT = "concept"
    DOMAIN = "domain"
    PAPER = "paper"
    EXAMPLE = "example"
    COUNTEREXAMPLE = "counterexample"


class KnowledgeEdgeType(str, Enum):
    """Types of relationships between knowledge nodes."""
    USES = "uses"  # Node A uses Node B
    IMPLIES = "implies"  # Node A implies Node B
    GENERALIZES = "generalizes"  # Node A is a generalization of Node B
    SPECIALIZES = "specializes"  # Node A is a specialization of Node B
    CONTRADICTS = "contradicts"  # Node A contradicts Node B
    PROVED_BY = "proved_by"  # Node A is proved by technique/lemma B
    REQUIRES = "requires"  # Node A requires Node B as prerequisite
    RELATED = "related"  # Semantic similarity relation
    CITES = "cites"  # Paper A cites Paper B
    BELONGS_TO = "belongs_to"  # Node A belongs to domain B


class KnowledgeSource(str, Enum):
    """Source of the knowledge node."""
    MATHLIB = "mathlib"  # Lean's Mathlib library
    ARXIV = "arxiv"  # arXiv papers
    WIKIPEDIA = "wikipedia"  # Mathematical Wikipedia
    USER_VERIFIED = "user_verified"  # User-created and Lean-verified
    USER_PROPOSED = "user_proposed"  # User-created but not verified
    IMPORTED = "imported"  # Imported from external source


class KnowledgeNode(Base):
    """
    A node in the knowledge graph representing a mathematical concept,
    theorem, lemma, definition, proof technique, etc.
    """
    __tablename__ = "knowledge_nodes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    
    # Core content
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    node_type: Mapped[str] = mapped_column(
        SQLEnum(KnowledgeNodeType, name="knowledge_node_type"),
        nullable=False
    )
    
    # Mathematical formalization
    formula: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # LaTeX
    lean_code: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Lean 4
    
    # Semantic embedding (768 dimensions for text-embedding-004)
    embedding: Mapped[Optional[list]] = mapped_column(Vector(768), nullable=True)
    
    # Metadata
    source: Mapped[str] = mapped_column(
        SQLEnum(KnowledgeSource, name="knowledge_source"),
        default=KnowledgeSource.USER_PROPOSED
    )
    source_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    source_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # arXiv ID, Mathlib path, etc.
    
    # Quality metrics (Idea2Story-style)
    quality_score: Mapped[float] = mapped_column(Float, default=0.5)  # 0-1
    citation_count: Mapped[int] = mapped_column(default=0)
    usage_count: Mapped[int] = mapped_column(default=0)  # How often retrieved

    # Domain classification
    domains: Mapped[Optional[list]] = mapped_column(ARRAY(String(100)), nullable=True)
    tags: Mapped[Optional[list]] = mapped_column(ARRAY(String(100)), nullable=True)

    # Pattern-specific fields (for Idea2Paper integration)
    # Cluster size: Number of papers in this pattern cluster
    cluster_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True)
    # Flag indicating this node represents a research pattern
    is_pattern: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    
    # User linkage (if created by a user)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    problem_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("problems.id", ondelete="SET NULL"), nullable=True
    )
    library_item_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("library_items.id", ondelete="SET NULL"), nullable=True
    )
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    
    # Extra metadata (using extra_data to avoid conflict with SQLAlchemy's metadata)
    extra_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    # Relationships
    outgoing_edges: Mapped[list["KnowledgeEdge"]] = relationship(
        "KnowledgeEdge",
        foreign_keys="KnowledgeEdge.from_node_id",
        back_populates="from_node",
        cascade="all, delete-orphan"
    )
    incoming_edges: Mapped[list["KnowledgeEdge"]] = relationship(
        "KnowledgeEdge",
        foreign_keys="KnowledgeEdge.to_node_id",
        back_populates="to_node",
        cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_knowledge_nodes_embedding", "embedding", postgresql_using="ivfflat"),
        Index("ix_knowledge_nodes_node_type", "node_type"),
        Index("ix_knowledge_nodes_source", "source"),
        Index("ix_knowledge_nodes_domains", "domains", postgresql_using="gin"),
        Index("ix_knowledge_nodes_quality", "quality_score"),
        Index("ix_knowledge_nodes_cluster_size", "cluster_size"),
        Index("ix_knowledge_nodes_is_pattern", "is_pattern"),
    )


class KnowledgeEdge(Base):
    """
    An edge in the knowledge graph representing a relationship between nodes.
    Edges have weights based on quality and effectiveness (Idea2Story-style).
    """
    __tablename__ = "knowledge_edges"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    
    # Source and target nodes
    from_node_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("knowledge_nodes.id", ondelete="CASCADE"),
        nullable=False
    )
    to_node_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("knowledge_nodes.id", ondelete="CASCADE"),
        nullable=False
    )
    
    # Edge type and weight
    edge_type: Mapped[str] = mapped_column(
        SQLEnum(KnowledgeEdgeType, name="knowledge_edge_type"),
        nullable=False
    )
    weight: Mapped[float] = mapped_column(Float, default=1.0)  # Strength of relationship
    
    # Quality-based weighting (Idea2Story-style)
    effectiveness_score: Mapped[float] = mapped_column(Float, default=0.5)  # How well this pattern works
    confidence: Mapped[float] = mapped_column(Float, default=1.0)  # Confidence in the relationship
    
    # Optional label/description
    label: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Extra data
    extra_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    # Relationships
    from_node: Mapped[KnowledgeNode] = relationship(
        "KnowledgeNode",
        foreign_keys=[from_node_id],
        back_populates="outgoing_edges"
    )
    to_node: Mapped[KnowledgeNode] = relationship(
        "KnowledgeNode",
        foreign_keys=[to_node_id],
        back_populates="incoming_edges"
    )

    __table_args__ = (
        UniqueConstraint("from_node_id", "to_node_id", "edge_type", name="uq_knowledge_edge"),
        Index("ix_knowledge_edges_from", "from_node_id"),
        Index("ix_knowledge_edges_to", "to_node_id"),
        Index("ix_knowledge_edges_type", "edge_type"),
        Index("ix_knowledge_edges_weight", "weight"),
    )


class ReasoningTrace(Base):
    """
    Stores the reasoning trace/chain for AI runs.
    Allows visibility into the model's thought process.
    """
    __tablename__ = "reasoning_traces"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    
    # Link to the AI run
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("canvas_ai_runs.id", ondelete="CASCADE"),
        nullable=False
    )
    
    # Reasoning content
    step_number: Mapped[int] = mapped_column(default=0)
    step_type: Mapped[str] = mapped_column(String(50), nullable=False)  # "thinking", "retrieval", "fusion", "critique"
    content: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Knowledge graph context used
    kg_nodes_used: Mapped[Optional[list]] = mapped_column(ARRAY(UUID(as_uuid=True)), nullable=True)
    
    # Sub-agent info (if applicable)
    agent_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    agent_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    
    # Timing
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    duration_ms: Mapped[Optional[int]] = mapped_column(nullable=True)
    
    # Extra data
    extra_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    __table_args__ = (
        Index("ix_reasoning_traces_run", "run_id"),
        Index("ix_reasoning_traces_step", "run_id", "step_number"),
    )
