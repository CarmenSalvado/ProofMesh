"""ensure_lean_code_on_library_items

Revision ID: e3b0f1c2a9d7
Revises: b1d04ce8112a
Create Date: 2026-01-31 23:58:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "e3b0f1c2a9d7"
down_revision: Union[str, None] = "b1d04ce8112a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE library_items ADD COLUMN IF NOT EXISTS lean_code TEXT")


def downgrade() -> None:
    op.execute("ALTER TABLE library_items DROP COLUMN IF EXISTS lean_code")
