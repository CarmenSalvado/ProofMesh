"""add_lean_code_to_library_items

Revision ID: b1d04ce8112a
Revises: 2ba62a0adb59
Create Date: 2026-01-31 19:08:04.518044

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b1d04ce8112a'
down_revision: Union[str, None] = '2ba62a0adb59'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
