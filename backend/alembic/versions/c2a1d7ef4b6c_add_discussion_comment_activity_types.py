"""Add activity types for discussions and comments

Revision ID: c2a1d7ef4b6c
Revises: f17c8c2b9a10
Create Date: 2026-02-07

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "c2a1d7ef4b6c"
down_revision: Union[str, None] = "f17c8c2b9a10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'CREATED_DISCUSSION'")
    op.execute("ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'CREATED_COMMENT'")


def downgrade() -> None:
    op.execute(
        """
        UPDATE activities
        SET type = 'CREATED_PROBLEM'::activity_type
        WHERE type IN ('CREATED_DISCUSSION', 'CREATED_COMMENT')
        """
    )
    op.execute(
        """
        CREATE TYPE activity_type_old AS ENUM (
            'CREATED_PROBLEM',
            'CREATED_WORKSPACE_FILE',
            'PUBLISHED_LIBRARY',
            'UPDATED_LIBRARY',
            'VERIFIED_LIBRARY',
            'AGENT_GENERATED',
            'COMMENTED_LIBRARY',
            'FOLLOWED_USER',
            'FORKED_PROBLEM',
            'TEAM_INVITE',
            'TEAM_JOIN'
        )
        """
    )
    op.execute(
        """
        ALTER TABLE activities
        ALTER COLUMN type TYPE activity_type_old
        USING type::text::activity_type_old
        """
    )
    op.execute("DROP TYPE activity_type")
    op.execute("ALTER TYPE activity_type_old RENAME TO activity_type")
