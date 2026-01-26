"""add_workspace_files

Revision ID: 1b1a4c1aa0d2
Revises: dfe7e590422d
Create Date: 2026-01-25 19:10:45.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '1b1a4c1aa0d2'
down_revision: Union[str, None] = 'dfe7e590422d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    workspace_type = postgresql.ENUM('file', 'directory', 'notebook', name='workspace_file_type', create_type=False)
    workspace_type.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'workspace_files',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('problem_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('problems.id', ondelete='CASCADE'), nullable=False),
        sa.Column('path', sa.String(length=1024), nullable=False),
        sa.Column('parent_path', sa.String(length=1024), nullable=False, server_default=''),
        sa.Column('type', workspace_type, nullable=False, server_default='file'),
        sa.Column('content', sa.Text(), nullable=True),
        sa.Column('format', sa.String(length=32), nullable=True, server_default='text'),
        sa.Column('mimetype', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_workspace_file_problem_parent', 'workspace_files', ['problem_id', 'parent_path'])
    op.create_unique_constraint('uq_workspace_file_problem_path', 'workspace_files', ['problem_id', 'path'])


def downgrade() -> None:
    op.drop_constraint('uq_workspace_file_problem_path', 'workspace_files', type_='unique')
    op.drop_index('ix_workspace_file_problem_parent', table_name='workspace_files')
    op.drop_table('workspace_files')
    op.execute('DROP TYPE IF EXISTS workspace_file_type')
