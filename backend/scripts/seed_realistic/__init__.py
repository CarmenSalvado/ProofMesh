"""
ProofMesh Realistic Platform Seeding Package

This package contains modular scripts for seeding a realistic academic research platform
with professors, researchers, teams, problems, workspaces, and social activity.
"""

from .seed_users import seed_users
from .seed_teams import seed_teams
from .seed_problems import seed_problems
from .seed_workspaces import seed_workspaces
from .seed_library_items import seed_library_items
from .seed_social_activity import seed_social_activity

__all__ = [
    'seed_users',
    'seed_teams',
    'seed_problems',
    'seed_workspaces',
    'seed_library_items',
    'seed_social_activity',
]
