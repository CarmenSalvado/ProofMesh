"""Add knowledge graph tables

Revision ID: kg001_knowledge_graph
Revises: ea7c51c4ad89
Create Date: 2026-02-02

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from pgvector.sqlalchemy import Vector

# revision identifiers, used by Alembic.
revision: str = 'kg001_knowledge_graph'
down_revision: Union[str, None] = 'ea7c51c4ad89'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable pgvector extension
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    
    # Create enum types
    op.execute("""
        CREATE TYPE knowledge_node_type AS ENUM (
            'theorem', 'lemma', 'definition', 'axiom', 'corollary',
            'proposition', 'proof_technique', 'concept', 'domain',
            'paper', 'example', 'counterexample'
        )
    """)
    
    op.execute("""
        CREATE TYPE knowledge_edge_type AS ENUM (
            'uses', 'implies', 'generalizes', 'specializes',
            'contradicts', 'proved_by', 'requires', 'related',
            'cites', 'belongs_to'
        )
    """)
    
    op.execute("""
        CREATE TYPE knowledge_source AS ENUM (
            'mathlib', 'arxiv', 'wikipedia', 'user_verified',
            'user_proposed', 'imported'
        )
    """)
    
    # Create knowledge_nodes table
    op.create_table(
        'knowledge_nodes',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('content', sa.Text, nullable=False),
        sa.Column('node_type', postgresql.ENUM('theorem', 'lemma', 'definition', 'axiom', 'corollary',
            'proposition', 'proof_technique', 'concept', 'domain', 'paper', 'example', 'counterexample',
            name='knowledge_node_type', create_type=False), nullable=False),
        sa.Column('formula', sa.Text, nullable=True),
        sa.Column('lean_code', sa.Text, nullable=True),
        sa.Column('embedding', Vector(768), nullable=True),
        sa.Column('source', postgresql.ENUM('mathlib', 'arxiv', 'wikipedia', 'user_verified',
            'user_proposed', 'imported', name='knowledge_source', create_type=False),
            default='user_proposed'),
        sa.Column('source_url', sa.String(1000), nullable=True),
        sa.Column('source_id', sa.String(255), nullable=True),
        sa.Column('quality_score', sa.Float, default=0.5),
        sa.Column('citation_count', sa.Integer, default=0),
        sa.Column('usage_count', sa.Integer, default=0),
        sa.Column('domains', postgresql.ARRAY(sa.String(100)), nullable=True),
        sa.Column('tags', postgresql.ARRAY(sa.String(100)), nullable=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('problem_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('problems.id', ondelete='SET NULL'), nullable=True),
        sa.Column('library_item_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('library_items.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime, default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('extra_data', postgresql.JSON, nullable=True),
    )
    
    # Create knowledge_edges table
    op.create_table(
        'knowledge_edges',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('from_node_id', postgresql.UUID(as_uuid=True), 
                  sa.ForeignKey('knowledge_nodes.id', ondelete='CASCADE'), nullable=False),
        sa.Column('to_node_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('knowledge_nodes.id', ondelete='CASCADE'), nullable=False),
        sa.Column('edge_type', postgresql.ENUM('uses', 'implies', 'generalizes', 'specializes',
            'contradicts', 'proved_by', 'requires', 'related', 'cites', 'belongs_to',
            name='knowledge_edge_type', create_type=False), nullable=False),
        sa.Column('weight', sa.Float, default=1.0),
        sa.Column('effectiveness_score', sa.Float, default=0.5),
        sa.Column('confidence', sa.Float, default=1.0),
        sa.Column('label', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime, default=sa.func.now()),
        sa.Column('extra_data', postgresql.JSON, nullable=True),
        sa.UniqueConstraint('from_node_id', 'to_node_id', 'edge_type', name='uq_knowledge_edge'),
    )
    
    # Create reasoning_traces table
    op.create_table(
        'reasoning_traces',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('run_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('canvas_ai_runs.id', ondelete='CASCADE'), nullable=False),
        sa.Column('step_number', sa.Integer, default=0),
        sa.Column('step_type', sa.String(50), nullable=False),
        sa.Column('content', sa.Text, nullable=False),
        sa.Column('kg_nodes_used', postgresql.ARRAY(postgresql.UUID(as_uuid=True)), nullable=True),
        sa.Column('agent_name', sa.String(100), nullable=True),
        sa.Column('agent_type', sa.String(50), nullable=True),
        sa.Column('started_at', sa.DateTime, default=sa.func.now()),
        sa.Column('completed_at', sa.DateTime, nullable=True),
        sa.Column('duration_ms', sa.Integer, nullable=True),
        sa.Column('extra_data', postgresql.JSON, nullable=True),
    )
    
    # Create indexes
    op.create_index('ix_knowledge_nodes_node_type', 'knowledge_nodes', ['node_type'])
    op.create_index('ix_knowledge_nodes_source', 'knowledge_nodes', ['source'])
    op.create_index('ix_knowledge_nodes_quality', 'knowledge_nodes', ['quality_score'])
    op.create_index('ix_knowledge_nodes_domains', 'knowledge_nodes', ['domains'], postgresql_using='gin')
    
    op.create_index('ix_knowledge_edges_from', 'knowledge_edges', ['from_node_id'])
    op.create_index('ix_knowledge_edges_to', 'knowledge_edges', ['to_node_id'])
    op.create_index('ix_knowledge_edges_type', 'knowledge_edges', ['edge_type'])
    op.create_index('ix_knowledge_edges_weight', 'knowledge_edges', ['weight'])
    
    op.create_index('ix_reasoning_traces_run', 'reasoning_traces', ['run_id'])
    op.create_index('ix_reasoning_traces_step', 'reasoning_traces', ['run_id', 'step_number'])
    
    # Create IVFFlat index for vector similarity search (after inserting some data)
    # This will be created manually after initial data load for better performance
    # op.execute("CREATE INDEX ix_knowledge_nodes_embedding ON knowledge_nodes USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)")


def downgrade() -> None:
    op.drop_table('reasoning_traces')
    op.drop_table('knowledge_edges')
    op.drop_table('knowledge_nodes')
    
    op.execute("DROP TYPE IF EXISTS knowledge_source")
    op.execute("DROP TYPE IF EXISTS knowledge_edge_type")
    op.execute("DROP TYPE IF EXISTS knowledge_node_type")
