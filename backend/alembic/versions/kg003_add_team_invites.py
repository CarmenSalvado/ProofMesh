"""Add team invite/join activity types

Revision ID: kg003_add_team_invites
Revises: kg002_add_activity_types
Create Date: 2026-02-02

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "kg003_add_team_invites"
down_revision: Union[str, None] = "kg002_add_activity_types"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_values = [
    "CREATED_PROBLEM",
    "CREATED_WORKSPACE_FILE",
    "PUBLISHED_LIBRARY",
    "UPDATED_LIBRARY",
    "VERIFIED_LIBRARY",
    "AGENT_GENERATED",
    "COMMENTED_LIBRARY",
    "FOLLOWED_USER",
    "FORKED_PROBLEM",
    "TEAM_INVITE",
    "TEAM_JOIN",
]


def upgrade() -> None:
    # create a new enum with the added values
    new_type = postgresql.ENUM(*_values, name="activity_type_new")
    new_type.create(op.get_bind(), checkfirst=True)

    op.execute(
        "ALTER TABLE activities ALTER COLUMN type TYPE activity_type_new "
        "USING type::text::activity_type_new"
    )

    op.execute("DROP TYPE activity_type")
    op.execute("ALTER TYPE activity_type_new RENAME TO activity_type")


def downgrade() -> None:
    # Remove the new values by recreating the enum without them
    downgrade_values = [v for v in _values if v not in {"TEAM_INVITE", "TEAM_JOIN"}]
    old_type = postgresql.ENUM(*downgrade_values, name="activity_type_old")
    old_type.create(op.get_bind(), checkfirst=True)

    op.execute(
        "ALTER TABLE activities ALTER COLUMN type TYPE activity_type_old "
        "USING type::text::activity_type_old"
    )

    op.execute("DROP TYPE activity_type")
    op.execute("ALTER TYPE activity_type_old RENAME TO activity_type")

    # Clean up any rows that used the new values to a safe default
    op.execute(
        "UPDATE activities SET type = 'FOLLOWED_USER'::activity_type "
        "WHERE type IN ('TEAM_INVITE', 'TEAM_JOIN')"
    )
