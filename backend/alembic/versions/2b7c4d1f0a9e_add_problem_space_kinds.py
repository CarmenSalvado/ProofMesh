"""add_problem_space_kinds

Revision ID: 2b7c4d1f0a9e
Revises: 6a1b8f2d4c3e
Create Date: 2026-01-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "2b7c4d1f0a9e"
down_revision: Union[str, None] = "6a1b8f2d4c3e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE library_item_kind ADD VALUE IF NOT EXISTS 'resource'")
    op.execute("ALTER TYPE library_item_kind ADD VALUE IF NOT EXISTS 'idea'")
    op.execute("ALTER TYPE library_item_kind ADD VALUE IF NOT EXISTS 'content'")


def downgrade() -> None:
    old_type = postgresql.ENUM(
        "lemma",
        "claim",
        "definition",
        "theorem",
        "counterexample",
        "computation",
        "note",
        name="library_item_kind_old",
    )
    old_type.create(op.get_bind(), checkfirst=True)

    op.execute(
        "ALTER TABLE library_items ALTER COLUMN kind TYPE library_item_kind_old "
        "USING kind::text::library_item_kind_old"
    )
    op.execute("DROP TYPE library_item_kind")
    op.execute("ALTER TYPE library_item_kind_old RENAME TO library_item_kind")
