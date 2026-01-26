"""update_activity_type

Revision ID: 6a1b8f2d4c3e
Revises: 4c2a5c9c6a8b
Create Date: 2026-01-25 21:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '6a1b8f2d4c3e'
down_revision: Union[str, None] = '4c2a5c9c6a8b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    new_type = postgresql.ENUM(
        'CREATED_PROBLEM',
        'CREATED_WORKSPACE_FILE',
        'PUBLISHED_LIBRARY',
        'FOLLOWED_USER',
        'FORKED_PROBLEM',
        name='activity_type_new',
    )
    new_type.create(op.get_bind(), checkfirst=True)

    op.execute(
        "ALTER TABLE activities ALTER COLUMN type TYPE activity_type_new "
        "USING (CASE WHEN type='CREATED_CANVAS' THEN 'CREATED_WORKSPACE_FILE' ELSE type::text END)::activity_type_new"
    )

    op.execute("DROP TYPE activity_type")
    op.execute("ALTER TYPE activity_type_new RENAME TO activity_type")


def downgrade() -> None:
    old_type = postgresql.ENUM(
        'CREATED_PROBLEM',
        'CREATED_CANVAS',
        'PUBLISHED_LIBRARY',
        'FOLLOWED_USER',
        'FORKED_PROBLEM',
        name='activity_type_old',
    )
    old_type.create(op.get_bind(), checkfirst=True)

    op.execute(
        "ALTER TABLE activities ALTER COLUMN type TYPE activity_type_old "
        "USING (CASE WHEN type='CREATED_WORKSPACE_FILE' THEN 'CREATED_CANVAS' ELSE type::text END)::activity_type_old"
    )

    op.execute("DROP TYPE activity_type")
    op.execute("ALTER TYPE activity_type_old RENAME TO activity_type")
