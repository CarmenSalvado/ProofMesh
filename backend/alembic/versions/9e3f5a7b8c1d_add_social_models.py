"""Add social models (discussions, comments, stars, notifications, teams)

Revision ID: 9e3f5a7b8c1d
Revises: dfe7e590422d
Create Date: 2026-01-26 21:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '9e3f5a7b8c1d'
down_revision: Union[str, None] = 'dfe7e590422d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enums
    star_target_type = postgresql.ENUM('problem', 'library_item', 'discussion', name='star_target_type', create_type=False)
    star_target_type.create(op.get_bind(), checkfirst=True)
    
    notification_type = postgresql.ENUM(
        'follow', 'mention', 'new_discussion', 'new_comment', 'reply_to_comment',
        'problem_forked', 'problem_starred', 'item_verified', 'item_rejected',
        'team_invite', 'team_join', 'system',
        name='notification_type', create_type=False
    )
    notification_type.create(op.get_bind(), checkfirst=True)
    
    team_role = postgresql.ENUM('owner', 'admin', 'member', name='team_role', create_type=False)
    team_role.create(op.get_bind(), checkfirst=True)
    
    # Create discussions table
    op.create_table(
        'discussions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('content', sa.Text, nullable=False),
        sa.Column('author_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('problem_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('problems.id', ondelete='CASCADE'), nullable=True),
        sa.Column('library_item_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('library_items.id', ondelete='CASCADE'), nullable=True),
        sa.Column('is_resolved', sa.Boolean, default=False, nullable=False),
        sa.Column('is_pinned', sa.Boolean, default=False, nullable=False),
        sa.Column('created_at', sa.DateTime, nullable=False),
        sa.Column('updated_at', sa.DateTime, nullable=False),
    )
    op.create_index('ix_discussions_author_id', 'discussions', ['author_id'])
    op.create_index('ix_discussions_problem_id', 'discussions', ['problem_id'])
    op.create_index('ix_discussions_library_item_id', 'discussions', ['library_item_id'])
    
    # Create comments table
    op.create_table(
        'comments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('content', sa.Text, nullable=False),
        sa.Column('author_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('discussion_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('discussions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('parent_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('comments.id', ondelete='CASCADE'), nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False),
        sa.Column('updated_at', sa.DateTime, nullable=False),
    )
    op.create_index('ix_comments_author_id', 'comments', ['author_id'])
    op.create_index('ix_comments_discussion_id', 'comments', ['discussion_id'])
    op.create_index('ix_comments_parent_id', 'comments', ['parent_id'])
    
    # Create stars table
    op.create_table(
        'stars',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('target_type', star_target_type, nullable=False),
        sa.Column('target_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime, nullable=False),
        sa.UniqueConstraint('user_id', 'target_type', 'target_id', name='uq_user_star'),
    )
    op.create_index('ix_stars_user_id', 'stars', ['user_id'])
    op.create_index('ix_stars_target_id', 'stars', ['target_id'])
    
    # Create notifications table
    op.create_table(
        'notifications',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('type', notification_type, nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('content', sa.Text, nullable=True),
        sa.Column('actor_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('target_type', sa.String(50), nullable=True),
        sa.Column('target_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('extra_data', postgresql.JSON, nullable=True),
        sa.Column('is_read', sa.Boolean, default=False, nullable=False),
        sa.Column('created_at', sa.DateTime, nullable=False),
    )
    op.create_index('ix_notifications_user_id', 'notifications', ['user_id'])
    op.create_index('ix_notifications_is_read', 'notifications', ['is_read'])
    op.create_index('ix_notifications_created_at', 'notifications', ['created_at'])
    
    # Create teams table
    op.create_table(
        'teams',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('slug', sa.String(100), unique=True, nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('avatar_url', sa.String(500), nullable=True),
        sa.Column('is_public', sa.Boolean, default=True, nullable=False),
        sa.Column('created_at', sa.DateTime, nullable=False),
        sa.Column('updated_at', sa.DateTime, nullable=False),
    )
    op.create_index('ix_teams_slug', 'teams', ['slug'])
    
    # Create team_members table
    op.create_table(
        'team_members',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('team_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('teams.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role', team_role, nullable=False),
        sa.Column('joined_at', sa.DateTime, nullable=False),
        sa.UniqueConstraint('team_id', 'user_id', name='uq_team_member'),
    )
    op.create_index('ix_team_members_team_id', 'team_members', ['team_id'])
    op.create_index('ix_team_members_user_id', 'team_members', ['user_id'])
    
    # Create team_problems table
    op.create_table(
        'team_problems',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('team_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('teams.id', ondelete='CASCADE'), nullable=False),
        sa.Column('problem_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('problems.id', ondelete='CASCADE'), nullable=False),
        sa.Column('added_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('added_at', sa.DateTime, nullable=False),
        sa.UniqueConstraint('team_id', 'problem_id', name='uq_team_problem'),
    )
    op.create_index('ix_team_problems_team_id', 'team_problems', ['team_id'])
    op.create_index('ix_team_problems_problem_id', 'team_problems', ['problem_id'])


def downgrade() -> None:
    # Drop tables
    op.drop_table('team_problems')
    op.drop_table('team_members')
    op.drop_table('teams')
    op.drop_table('notifications')
    op.drop_table('stars')
    op.drop_table('comments')
    op.drop_table('discussions')
    
    # Drop enums
    op.execute('DROP TYPE IF EXISTS team_role')
    op.execute('DROP TYPE IF EXISTS notification_type')
    op.execute('DROP TYPE IF EXISTS star_target_type')
