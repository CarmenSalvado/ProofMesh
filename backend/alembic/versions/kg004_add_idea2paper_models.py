"""Add Idea2Paper models: PaperAnchor and Story

Revision ID: kg004_add_idea2paper_models
Revises: kg003_add_team_invites
Create Date: 2026-02-03

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from pgvector.sqlalchemy import Vector

# revision identifiers, used by Alembic.
revision: str = 'kg004_add_idea2paper_models'
down_revision: Union[str, None] = 'kg003_add_team_invites'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add pattern fields to knowledge_nodes table
    op.add_column('knowledge_nodes',
        sa.Column('cluster_size', sa.Integer(), nullable=True)
    )
    op.add_column('knowledge_nodes',
        sa.Column('is_pattern', sa.Boolean(), nullable=True, server_default='false')
    )

    # Create indexes for pattern fields
    op.create_index('ix_knowledge_nodes_cluster_size', 'knowledge_nodes', ['cluster_size'])
    op.create_index('ix_knowledge_nodes_is_pattern', 'knowledge_nodes', ['is_pattern'])

    # Create paper_anchors table
    op.create_table(
        'paper_anchors',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('paper_id', sa.String(255), unique=True, nullable=False),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('abstract', sa.String(2000), nullable=True),
        sa.Column('pattern_id', sa.String(255), nullable=True),
        sa.Column('avg_score', sa.Float(), default=0.0),
        sa.Column('review_count', sa.Integer(), default=0),
        sa.Column('highest_score', sa.Float(), default=0.0),
        sa.Column('lowest_score', sa.Float(), default=0.0),
        sa.Column('score10', sa.Float(), default=5.0),
        sa.Column('dispersion10', sa.Float(), default=0.0),
        sa.Column('weight', sa.Float(), default=1.0),
        sa.Column('venue', sa.String(100), nullable=True),
        sa.Column('year', sa.Integer(), nullable=True),
        sa.Column('domains', postgresql.ARRAY(sa.String(100)), nullable=True),
        sa.Column('tags', postgresql.ARRAY(sa.String(100)), nullable=True),
        sa.Column('is_exemplar', sa.Boolean(), default=False),
        sa.Column('extra_data', postgresql.JSON, nullable=True),
        sa.Column('created_at', sa.DateTime(), default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), default=sa.func.now(), onupdate=sa.func.now()),
    )

    # Create indexes for paper_anchors
    op.create_index('ix_paper_anchors_pattern', 'paper_anchors', ['pattern_id'])
    op.create_index('ix_paper_anchors_score10', 'paper_anchors', ['score10'])
    op.create_index('ix_paper_anchors_weight', 'paper_anchors', ['weight'])
    op.create_index('ix_paper_anchors_exemplar', 'paper_anchors', ['is_exemplar'])

    # Create stories table
    op.create_table(
        'stories',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('problem_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('problems.id', ondelete='SET NULL'), nullable=True),
        sa.Column('canvas_ai_run_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('canvas_ai_runs.id', ondelete='SET NULL'), nullable=True),
        sa.Column('user_idea', sa.Text(), nullable=False),
        sa.Column('pattern_id', sa.String(255), nullable=True),
        sa.Column('pattern_name', sa.String(500), nullable=True),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('abstract', sa.Text(), nullable=False),
        sa.Column('problem_framing', sa.Text(), nullable=False),
        sa.Column('gap_pattern', sa.Text(), nullable=False),
        sa.Column('solution', sa.Text(), nullable=False),
        sa.Column('method_skeleton', sa.Text(), nullable=False),
        sa.Column('innovation_claims', postgresql.ARRAY(sa.String(1000)), nullable=False),
        sa.Column('experiments_plan', sa.Text(), nullable=False),
        sa.Column('fused_idea_data', postgresql.JSON, nullable=True),
        sa.Column('review_scores', postgresql.JSON, nullable=True),
        sa.Column('avg_score', sa.Float(), default=0.0),
        sa.Column('passed_review', sa.Boolean(), default=False),
        sa.Column('novelty_report', postgresql.JSON, nullable=True),
        sa.Column('max_similarity', sa.Float(), default=0.0),
        sa.Column('risk_level', sa.String(20), default='unknown'),
        sa.Column('version', sa.Integer(), default=1),
        sa.Column('parent_story_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('stories.id', ondelete='SET NULL'), nullable=True),
        sa.Column('embedding', Vector(768), nullable=True),
        sa.Column('generation_metadata', postgresql.JSON, nullable=True),
        sa.Column('created_at', sa.DateTime(), default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), default=sa.func.now(), onupdate=sa.func.now()),
    )

    # Create indexes for stories
    op.create_index('ix_stories_user', 'stories', ['user_id'])
    op.create_index('ix_stories_problem', 'stories', ['problem_id'])
    op.create_index('ix_stories_pattern', 'stories', ['pattern_id'])
    op.create_index('ix_stories_avg_score', 'stories', ['avg_score'])
    op.create_index('ix_stories_passed', 'stories', ['passed_review'])
    op.create_index('ix_stories_risk', 'stories', ['risk_level'])
    op.create_index('ix_stories_parent', 'stories', ['parent_story_id'])


def downgrade() -> None:
    # Drop stories table
    op.drop_table('stories')

    # Drop paper_anchors table
    op.drop_table('paper_anchors')

    # Drop indexes from knowledge_nodes
    op.drop_index('ix_knowledge_nodes_is_pattern', table_name='knowledge_nodes')
    op.drop_index('ix_knowledge_nodes_cluster_size', table_name='knowledge_nodes')

    # Remove pattern fields from knowledge_nodes
    op.drop_column('knowledge_nodes', 'is_pattern')
    op.drop_column('knowledge_nodes', 'cluster_size')
