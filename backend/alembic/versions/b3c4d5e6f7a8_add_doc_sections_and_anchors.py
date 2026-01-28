"""add doc_sections and doc_anchors

Revision ID: b3c4d5e6f7a8
Revises: a1b2c3d4e5f6
Create Date: 2026-01-28 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b3c4d5e6f7a8'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create doc_sections table
    op.create_table(
        'doc_sections',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('workspace_file_id', postgresql.UUID(as_uuid=True), 
                  sa.ForeignKey('workspace_files.id', ondelete='CASCADE'), nullable=False),
        sa.Column('slug', sa.String(255), nullable=False),
        sa.Column('title', sa.String(512), nullable=False),
        sa.Column('level', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('order_index', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('content_preview', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_doc_section_file_order', 'doc_sections', ['workspace_file_id', 'order_index'])

    # Create doc_anchors table
    op.create_table(
        'doc_anchors',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('section_id', postgresql.UUID(as_uuid=True), 
                  sa.ForeignKey('doc_sections.id', ondelete='CASCADE'), nullable=False),
        sa.Column('library_item_id', postgresql.UUID(as_uuid=True), 
                  sa.ForeignKey('library_items.id', ondelete='CASCADE'), nullable=False),
        sa.Column('library_item_updated_at', sa.DateTime(), nullable=False),
        sa.Column('is_stale', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('position_hint', sa.String(64), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_doc_anchor_library_item', 'doc_anchors', ['library_item_id'])
    op.create_index('ix_doc_anchor_section', 'doc_anchors', ['section_id'])


def downgrade() -> None:
    op.drop_index('ix_doc_anchor_section', 'doc_anchors')
    op.drop_index('ix_doc_anchor_library_item', 'doc_anchors')
    op.drop_table('doc_anchors')
    
    op.drop_index('ix_doc_section_file_order', 'doc_sections')
    op.drop_table('doc_sections')
