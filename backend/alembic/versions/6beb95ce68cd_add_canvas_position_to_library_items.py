"""add_canvas_position_to_library_items

Revision ID: 6beb95ce68cd
Revises: e3b0f1c2a9d7
Create Date: 2026-02-02 01:30:36.794441

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6beb95ce68cd'
down_revision: Union[str, None] = 'e3b0f1c2a9d7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('library_items', sa.Column('x', sa.Float(), nullable=True))
    op.add_column('library_items', sa.Column('y', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('library_items', 'y')
    op.drop_column('library_items', 'x')
