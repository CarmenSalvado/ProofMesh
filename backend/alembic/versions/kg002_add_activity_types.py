"""Add new activity types for library item tracking

Revision ID: kg002_add_activity_types
Revises: kg001_knowledge_graph
Create Date: 2026-02-02

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'kg002_add_activity_types'
down_revision: Union[str, None] = 'kg001_knowledge_graph'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create new enum type with additional values
    new_type = postgresql.ENUM(
        'CREATED_PROBLEM',
        'CREATED_WORKSPACE_FILE',
        'PUBLISHED_LIBRARY',
        'UPDATED_LIBRARY',
        'VERIFIED_LIBRARY',
        'AGENT_GENERATED',
        'COMMENTED_LIBRARY',
        'FOLLOWED_USER',
        'FORKED_PROBLEM',
        name='activity_type_new',
    )
    new_type.create(op.get_bind(), checkfirst=True)

    # Convert existing data to new type
    op.execute(
        "ALTER TABLE activities ALTER COLUMN type TYPE activity_type_new "
        "USING type::text::activity_type_new"
    )

    # Drop old type and rename new type
    op.execute("DROP TYPE activity_type")
    op.execute("ALTER TYPE activity_type_new RENAME TO activity_type")


def downgrade() -> None:
    # Revert to old enum type without new values
    # First, convert any new values to PUBLISHED_LIBRARY
    op.execute("""
        UPDATE activities 
        SET type = 'PUBLISHED_LIBRARY'::activity_type 
        WHERE type IN ('UPDATED_LIBRARY', 'VERIFIED_LIBRARY', 'AGENT_GENERATED', 'COMMENTED_LIBRARY')
    """)
    
    old_type = postgresql.ENUM(
        'CREATED_PROBLEM',
        'CREATED_WORKSPACE_FILE',
        'PUBLISHED_LIBRARY',
        'FOLLOWED_USER',
        'FORKED_PROBLEM',
        name='activity_type_old',
    )
    old_type.create(op.get_bind(), checkfirst=True)

    op.execute(
        "ALTER TABLE activities ALTER COLUMN type TYPE activity_type_old "
        "USING type::text::activity_type_old"
    )

    op.execute("DROP TYPE activity_type")
    op.execute("ALTER TYPE activity_type_old RENAME TO activity_type")
