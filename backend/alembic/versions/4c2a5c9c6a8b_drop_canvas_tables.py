"""drop_canvas_tables

Revision ID: 4c2a5c9c6a8b
Revises: 1b1a4c1aa0d2
Create Date: 2026-01-25 21:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '4c2a5c9c6a8b'
down_revision: Union[str, None] = '1b1a4c1aa0d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_table('canvas_lines')
    op.drop_table('agent_runs')
    op.drop_table('canvases')

    op.execute('DROP TYPE IF EXISTS line_type')
    op.execute('DROP TYPE IF EXISTS author_type')
    op.execute('DROP TYPE IF EXISTS agent_run_status')
    op.execute('DROP TYPE IF EXISTS canvas_status')


def downgrade() -> None:
    canvas_status = postgresql.ENUM('DRAFT', 'VERIFIED', 'REVIEWING', name='canvas_status')
    canvas_status.create(op.get_bind(), checkfirst=True)
    agent_run_status = postgresql.ENUM('QUEUED', 'RUNNING', 'FAILED', 'DONE', name='agent_run_status')
    agent_run_status.create(op.get_bind(), checkfirst=True)
    line_type = postgresql.ENUM('TEXT', 'MATH', 'GOAL', 'AGENT_INSERT', 'LIBRARY_REF', 'VERIFICATION', name='line_type')
    line_type.create(op.get_bind(), checkfirst=True)
    author_type = postgresql.ENUM('HUMAN', 'AGENT', name='author_type')
    author_type.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'canvases',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('problem_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('problems.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('folder', sa.String(length=512), nullable=False, server_default='/'),
        sa.Column('content', sa.Text(), nullable=False, server_default=''),
        sa.Column('status', canvas_status, nullable=False, server_default='DRAFT'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )

    op.create_table(
        'agent_runs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('canvas_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('canvases.id', ondelete='CASCADE'), nullable=False),
        sa.Column('status', agent_run_status, nullable=False, server_default='QUEUED'),
        sa.Column('input_context', postgresql.JSONB(), nullable=False),
        sa.Column('output', postgresql.JSONB(), nullable=True),
        sa.Column('tool_logs', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
    )

    op.create_table(
        'canvas_lines',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('canvas_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('canvases.id', ondelete='CASCADE'), nullable=False),
        sa.Column('order_key', sa.String(length=64), nullable=False),
        sa.Column('type', line_type, nullable=False),
        sa.Column('content', sa.Text(), nullable=False, server_default=''),
        sa.Column('author_type', author_type, nullable=False),
        sa.Column('author_id', sa.String(length=255), nullable=False),
        sa.Column('agent_run_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('agent_runs.id', ondelete='SET NULL'), nullable=True),
        sa.Column('library_item_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('library_items.id', ondelete='SET NULL'), nullable=True),
        sa.Column('derived_from', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )
