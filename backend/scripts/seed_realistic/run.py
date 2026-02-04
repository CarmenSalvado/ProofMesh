#!/usr/bin/env python3
"""
Orchestrator script to seed realistic ProofMesh platform data.

This script runs all seeding modules in the correct order:
1. Users (professors/researchers)
2. Teams (research groups)
3. Problems (mathematical problems)
4. Workspaces (papers in progress)
5. Library Items (canvas nodes)
6. Social Activity (follows, stars, discussions)

Usage:
    python -m scripts.seed_realistic.run [--clear]
    # or from scripts directory:
    cd scripts && python -m seed_realistic.run [--clear]

Options:
    --clear       Clear existing data before seeding (WARNING: destructive!)
    --users N     Number of users to create (default: 80)
    --teams N     Number of teams to create (default: 25)
    --problems N  Number of problems to create (default: 120)
    --help        Show help message
"""
import asyncio
import sys
import argparse
from datetime import datetime
from sqlalchemy import text

# Add parent directory to path to import app modules
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.database import async_session_maker

# Import seeding functions from package
from . import (
    seed_users,
    seed_teams,
    seed_problems,
    seed_workspaces,
    seed_library_items,
    seed_social_activity,
)


async def clear_all_data():
    """Clear all data from the database (DESTRUCTIVE!)."""
    print("\n⚠️  WARNING: This will delete ALL data from the database!")
    print("Are you sure you want to continue? Type 'yes' to confirm: ", end="")
    confirmation = input().strip().lower()
    
    if confirmation != 'yes':
        print("❌ Aborted.")
        sys.exit(0)
    
    print("\n🗑️  Clearing all data...")
    
    async with async_session_maker() as db:
        # Order matters due to foreign keys
        tables = [
            'notifications',
            'activities',
            'comments',
            'discussions',
            'stars',
            'follows',
            'canvas_blocks',
            'library_items',
            'workspace_files',
            'team_problems',
            'team_members',
            'teams',
            'problems',
            'users',
            'knowledge_edges',
            'knowledge_nodes',
            'canvas_ai_messages',
            'canvas_ai_runs',
        ]
        
        for table in tables:
            try:
                await db.execute(text(f"TRUNCATE TABLE {table} CASCADE"))
                print(f"  ✓ Cleared {table}")
            except Exception as e:
                print(f"  ⚠ Could not clear {table}: {e}")
        
        await db.commit()
    
    print("✓ All data cleared\n")


async def run_seeding(num_users: int = 80, num_teams: int = 25, num_problems: int = 120):
    """Run all seeding scripts in order."""
    start_time = datetime.now()
    
    print("=" * 70)
    print("🌱 ProofMesh Realistic Platform Seeding".center(70))
    print("=" * 70)
    print()
    
    steps = [
        ("👥 Users (Professors & Researchers)", seed_users, (num_users,)),
        ("🏛️  Research Teams", seed_teams, (num_teams,)),
        ("📊 Mathematical Problems", seed_problems, (num_problems,)),
        ("📝 Workspace Files (Papers)", seed_workspaces, ()),
        ("🎨 Canvas Library Items", seed_library_items, ()),
        ("💬 Social Activity (Follows, Stars, Discussions)", seed_social_activity, ()),
    ]
    
    total_steps = len(steps)
    
    for i, (description, func, args) in enumerate(steps, 1):
        print(f"\n[{i}/{total_steps}] {description}")
        print("-" * 70)
        
        try:
            await func(*args)
        except Exception as e:
            print(f"❌ Error in step {i}: {e}")
            print(f"   Continuing with remaining steps...")
            import traceback
            traceback.print_exc()
    
    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()
    
    print("\n" + "=" * 70)
    print("✅ Seeding Complete!".center(70))
    print("=" * 70)
    print(f"\n⏱️  Total time: {duration:.1f} seconds")
    print("\n📊 Summary:")
    print("   - Realistic professors/researchers from top universities")
    print("   - Research teams with proper role hierarchy")
    print("   - Mathematical problems with academic titles")
    print("   - In-progress papers and research notes")
    print("   - Canvas nodes with definitions, theorems, lemmas")
    print("   - Active social network with discussions")
    print("\n🎉 Your ProofMesh platform is ready!")
    print("\n💡 Default password for all users: proofmesh123")
    print()


def print_usage():
    """Print usage information."""
    print("""
ProofMesh Realistic Platform Seeding
=====================================

This script generates realistic data for the ProofMesh platform:

🎓 Users: 80 professors and researchers from top universities
   - MIT, Stanford, Oxford, Cambridge, ETH Zürich, Princeton, etc.
   - Realistic names, emails, bios with research areas
   - Academic affiliations

🏛️  Teams: 25 research groups
   - University-based teams (e.g., "MIT Algebraic Geometry Group")
   - Proper role hierarchy (owners, admins, members)
   - Associated problems

📊 Problems: 120 mathematical problems
   - Academic titles and LaTeX descriptions
   - Tags by research area
   - Difficulty ratings and fork relationships

📝 Workspaces: In-progress papers
   - LaTeX paper drafts with TODOs
   - Research notes and scratch work
   - Bibliography files

🎨 Canvas: Library items (nodes)
   - 5-15 nodes per problem
   - Definitions, lemmas, theorems, proofs
   - Visual positioning and dependencies
   - Canvas blocks for organization

💬 Social: Active community
   - Follow networks
   - Stars on problems and items
   - Discussions with threaded comments
   - Activities and notifications

Usage:
    # From project root:
    python -m scripts.seed_realistic.run
    
    # From backend directory:
    cd backend && python -m scripts.seed_realistic.run
    
    # From scripts directory:
    cd backend/scripts && python -m seed_realistic.run

Options:
    --clear       Clear all existing data first (DESTRUCTIVE!)
    --users N     Number of users to create (default: 80)
    --teams N     Number of teams to create (default: 25)
    --problems N  Number of problems to create (default: 120)
    --help        Show this help message
    """)


async def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description='Seed realistic ProofMesh platform data',
        add_help=False
    )
    parser.add_argument('--clear', action='store_true', help='Clear existing data first')
    parser.add_argument('--users', type=int, default=80, help='Number of users (default: 80)')
    parser.add_argument('--teams', type=int, default=25, help='Number of teams (default: 25)')
    parser.add_argument('--problems', type=int, default=120, help='Number of problems (default: 120)')
    parser.add_argument('--help', action='store_true', help='Show help message')
    
    args = parser.parse_args()
    
    if args.help:
        print_usage()
        return
    
    if args.clear:
        await clear_all_data()
    
    await run_seeding(
        num_users=args.users,
        num_teams=args.teams,
        num_problems=args.problems
    )


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n❌ Interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
