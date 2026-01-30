"""add_latex_ai_storage

Revision ID: c3f1a6b9d2e4
Revises: b3c4d5e6f7a8
Create Date: 2026-01-29 18:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "c3f1a6b9d2e4"
down_revision: Union[str, None] = "b3c4d5e6f7a8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "latex_ai_memory",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("problem_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("problems.id", ondelete="CASCADE"), nullable=False),
        sa.Column("memory", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("problem_id", name="uq_latex_ai_memory_problem"),
    )

    op.create_table(
        "latex_ai_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("problem_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("problems.id", ondelete="CASCADE"), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("steps", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("edits", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("file_path", sa.String(length=1024), nullable=True),
        sa.Column("selection", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_latex_ai_runs_problem_created", "latex_ai_runs", ["problem_id", "created_at"])

    op.create_table(
        "latex_ai_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("problem_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("problems.id", ondelete="CASCADE"), nullable=False),
        sa.Column("run_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("latex_ai_runs.id", ondelete="SET NULL"), nullable=True),
        sa.Column("role", sa.String(length=16), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_latex_ai_messages_problem_created", "latex_ai_messages", ["problem_id", "created_at"])

    op.create_table(
        "latex_ai_quick_actions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("problem_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("problems.id", ondelete="CASCADE"), nullable=False),
        sa.Column("label", sa.String(length=128), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_latex_ai_quick_actions_problem", "latex_ai_quick_actions", ["problem_id"])


def downgrade() -> None:
    op.drop_index("ix_latex_ai_quick_actions_problem", table_name="latex_ai_quick_actions")
    op.drop_table("latex_ai_quick_actions")
    op.drop_index("ix_latex_ai_messages_problem_created", table_name="latex_ai_messages")
    op.drop_table("latex_ai_messages")
    op.drop_index("ix_latex_ai_runs_problem_created", table_name="latex_ai_runs")
    op.drop_table("latex_ai_runs")
    op.drop_table("latex_ai_memory")
