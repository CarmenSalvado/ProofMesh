"""merge_heads

Revision ID: a1b2c3d4e5f6
Revises: 2b7c4d1f0a9e, 9e3f5a7b8c1d
Create Date: 2026-01-28 12:00:00.000000

"""
from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: tuple[str, str] = ('2b7c4d1f0a9e', '9e3f5a7b8c1d')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Merge migration - no changes needed"""
    pass


def downgrade() -> None:
    """Merge migration - no changes needed"""
    pass
