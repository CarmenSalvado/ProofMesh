"""normalize_library_item_kind_enum

Revision ID: f17c8c2b9a10
Revises: kg004_add_idea2paper_models
Create Date: 2026-02-05 22:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "f17c8c2b9a10"
down_revision: Union[str, None] = "kg004_add_idea2paper_models"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Normalize library_item_kind enum to the backend's uppercase contract."""
    bind = op.get_bind()

    normalized_type = postgresql.ENUM(
        "RESOURCE",
        "IDEA",
        "CONTENT",
        "FORMAL_TEST",
        "LEMMA",
        "CLAIM",
        "DEFINITION",
        "THEOREM",
        "COUNTEREXAMPLE",
        "COMPUTATION",
        "NOTE",
        name="library_item_kind_new",
    )
    normalized_type.create(bind, checkfirst=True)

    op.execute(
        """
        ALTER TABLE library_items
        ALTER COLUMN kind TYPE library_item_kind_new
        USING (
            CASE kind::text
                WHEN 'resource' THEN 'RESOURCE'
                WHEN 'idea' THEN 'IDEA'
                WHEN 'content' THEN 'CONTENT'
                WHEN 'formal_test' THEN 'FORMAL_TEST'
                WHEN 'lemma' THEN 'LEMMA'
                WHEN 'claim' THEN 'CLAIM'
                WHEN 'definition' THEN 'DEFINITION'
                WHEN 'theorem' THEN 'THEOREM'
                WHEN 'counterexample' THEN 'COUNTEREXAMPLE'
                WHEN 'computation' THEN 'COMPUTATION'
                WHEN 'note' THEN 'NOTE'
                ELSE upper(kind::text)
            END
        )::library_item_kind_new
        """
    )

    op.execute("DROP TYPE library_item_kind")
    op.execute("ALTER TYPE library_item_kind_new RENAME TO library_item_kind")


def downgrade() -> None:
    """Return to previous enum shape (uppercase legacy + lowercase problem-space kinds)."""
    bind = op.get_bind()

    previous_type = postgresql.ENUM(
        "LEMMA",
        "CLAIM",
        "COUNTEREXAMPLE",
        "COMPUTATION",
        "NOTE",
        "resource",
        "idea",
        "content",
        name="library_item_kind_old",
    )
    previous_type.create(bind, checkfirst=True)

    op.execute(
        """
        ALTER TABLE library_items
        ALTER COLUMN kind TYPE library_item_kind_old
        USING (
            CASE kind::text
                WHEN 'RESOURCE' THEN 'resource'
                WHEN 'IDEA' THEN 'idea'
                WHEN 'CONTENT' THEN 'content'
                WHEN 'FORMAL_TEST' THEN 'note'
                WHEN 'DEFINITION' THEN 'LEMMA'
                WHEN 'THEOREM' THEN 'CLAIM'
                ELSE kind::text
            END
        )::library_item_kind_old
        """
    )

    op.execute("DROP TYPE library_item_kind")
    op.execute("ALTER TYPE library_item_kind_old RENAME TO library_item_kind")
