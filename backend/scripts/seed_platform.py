#!/usr/bin/env python3
"""
DEPRECATED: This script has been replaced by the modular seeding system.

Please use the new organized seeding system instead:
    python -m scripts.seed_realistic.run

For more information, see: scripts/seed_realistic/README.md

This file is kept for backwards compatibility but will redirect to the new system.
"""

import sys
import subprocess
from pathlib import Path

# Redirect to new seeding system
print("=" * 70)
print("⚠️  DEPRECATED SCRIPT".center(70))
print("=" * 70)
print()
print("This script has been replaced by the new modular seeding system.")
print("Redirecting to: python -m scripts.seed_realistic.run")
print()
print("For documentation, see: scripts/seed_realistic/README.md")
print("=" * 70)
print()

# Get the backend directory
backend_dir = Path(__file__).parent.parent

# Run the new seeding system
sys.exit(subprocess.call(
    [sys.executable, "-m", "scripts.seed_realistic.run"] + sys.argv[1:],
    cwd=backend_dir
))

# ============================================================================
# OLD CODE BELOW - KEPT FOR REFERENCE
# ============================================================================

import argparse
import asyncio
import random
from datetime import datetime, timedelta
from uuid import uuid4

from sqlalchemy import select, func

from app.database import async_session_maker
from app.models.user import User
from app.models.follow import Follow
from app.models.problem import Problem, ProblemVisibility
from app.models.workspace_file import WorkspaceFile, WorkspaceFileType
from app.models.library_item import LibraryItem, LibraryItemKind, LibraryItemStatus
from app.models.activity import Activity, ActivityType
from app.models.discussion import Discussion
from app.models.comment import Comment
from app.models.star import Star, StarTargetType
from app.services.auth import get_password_hash


# ============================================================================
# Sample Data
# ============================================================================

USERS = [
    {"username": "elena", "email": "elena@proofmesh.dev", "bio": "Category theory & topos. Working on synthetic homotopy."},
    {"username": "marcus", "email": "marcus@proofmesh.dev", "bio": "Analytic number theory. Prime distribution enthusiast."},
    {"username": "yuki", "email": "yuki@proofmesh.dev", "bio": "Algebraic geometry. Moduli spaces & deformation theory."},
    {"username": "david", "email": "david@proofmesh.dev", "bio": "Logic and foundations. Type theory advocate."},
    {"username": "priya", "email": "priya@proofmesh.dev", "bio": "Combinatorics, extremal graph theory, probabilistic methods."},
    {"username": "omar", "email": "omar@proofmesh.dev", "bio": "Differential geometry. Ricci flow & geometric analysis."},
    {"username": "sophie", "email": "sophie@proofmesh.dev", "bio": "Representation theory. Quantum groups researcher."},
    {"username": "liang", "email": "liang@proofmesh.dev", "bio": "Harmonic analysis. Operator theory on manifolds."},
    {"username": "anna", "email": "anna@proofmesh.dev", "bio": "Topology & knot theory. Low-dimensional manifolds."},
    {"username": "theo", "email": "theo@proofmesh.dev", "bio": "Mathematical physics. QFT & renormalization."},
    {"username": "carmen", "email": "carmen@proofmesh.dev", "bio": "Probability theory. Stochastic processes & SDEs."},
    {"username": "felix", "email": "felix@proofmesh.dev", "bio": "Cryptography & computational complexity."},
]

PROBLEMS = [
    {
        "title": "Spectral Gap Bounds for Expander Graphs",
        "description": "Establish sharp spectral gap estimates for random d-regular graphs using trace methods.",
        "author": "priya",
        "tags": ["graph-theory", "spectral", "combinatorics"],
        "difficulty": "hard",
        "visibility": "public",
    },
    {
        "title": "Cohomology of Moduli Spaces",
        "description": "Compute stable cohomology for moduli of curves using Grothendieck-Riemann-Roch.",
        "author": "yuki",
        "tags": ["algebraic-geometry", "cohomology", "moduli"],
        "difficulty": "hard",
        "visibility": "public",
    },
    {
        "title": "Prime Gaps Distribution",
        "description": "Analyze the distribution of gaps between consecutive primes using sieve methods.",
        "author": "marcus",
        "tags": ["number-theory", "primes", "analytic"],
        "difficulty": "medium",
        "visibility": "public",
    },
    {
        "title": "Univalent Foundations Formalization",
        "description": "Formalize basic results in HoTT using Lean 4 with focus on equivalence types.",
        "author": "david",
        "tags": ["type-theory", "hott", "lean"],
        "difficulty": "medium",
        "visibility": "public",
    },
    {
        "title": "Ricci Flow on Surfaces",
        "description": "Study long-time behavior of normalized Ricci flow on closed surfaces.",
        "author": "omar",
        "tags": ["differential-geometry", "pde", "ricci-flow"],
        "difficulty": "hard",
        "visibility": "public",
    },
    {
        "title": "Quantum Group Representations",
        "description": "Classify finite-dimensional irreducible representations of quantum sl(n).",
        "author": "sophie",
        "tags": ["representation-theory", "quantum-groups", "algebra"],
        "difficulty": "hard",
        "visibility": "public",
    },
    {
        "title": "Singular Integral Operators",
        "description": "Boundedness of Calderón-Zygmund operators on weighted Lebesgue spaces.",
        "author": "liang",
        "tags": ["harmonic-analysis", "operators", "functional-analysis"],
        "difficulty": "medium",
        "visibility": "public",
    },
    {
        "title": "Jones Polynomial Categorification",
        "description": "Develop Khovanov homology computations for torus knots.",
        "author": "anna",
        "tags": ["topology", "knot-theory", "homology"],
        "difficulty": "hard",
        "visibility": "public",
    },
    {
        "title": "Renormalization in QFT",
        "description": "Rigorous construction of phi-4 theory in 3 dimensions using RG flow.",
        "author": "theo",
        "tags": ["math-physics", "qft", "renormalization"],
        "difficulty": "hard",
        "visibility": "public",
    },
    {
        "title": "Stochastic Navier-Stokes",
        "description": "Well-posedness of 2D stochastic Navier-Stokes with multiplicative noise.",
        "author": "carmen",
        "tags": ["probability", "pde", "fluid-dynamics"],
        "difficulty": "hard",
        "visibility": "public",
    },
    {
        "title": "Topos-Theoretic Semantics",
        "description": "Internal language of elementary toposes for intuitionistic set theory.",
        "author": "elena",
        "tags": ["category-theory", "topos", "logic"],
        "difficulty": "medium",
        "visibility": "public",
    },
    {
        "title": "Lattice-Based Cryptography",
        "description": "Security analysis of NTRU-like schemes under quantum attacks.",
        "author": "felix",
        "tags": ["cryptography", "lattices", "post-quantum"],
        "difficulty": "hard",
        "visibility": "public",
    },
    {
        "title": "Random Matrix Universality",
        "description": "Prove edge universality for Wigner matrices with heavy-tailed entries.",
        "author": "carmen",
        "tags": ["probability", "random-matrices", "spectral"],
        "difficulty": "hard",
        "visibility": "public",
    },
    {
        "title": "Derived Categories Tutorial",
        "description": "Introduction to derived categories of coherent sheaves for beginners.",
        "author": "yuki",
        "tags": ["algebraic-geometry", "derived", "tutorial"],
        "difficulty": "easy",
        "visibility": "public",
    },
    {
        "title": "Graph Coloring Bounds",
        "description": "Improve chromatic number bounds for sparse random graphs.",
        "author": "priya",
        "tags": ["combinatorics", "graph-theory", "probabilistic"],
        "difficulty": "medium",
        "visibility": "public",
    },
]

LIBRARY_ITEMS = [
    # For Spectral Gap
    {"problem_idx": 0, "title": "Cheeger Inequality Statement", "kind": "THEOREM", "content": "For a d-regular graph G, h(G)² / 2d ≤ λ₁ ≤ 2h(G)", "status": "VERIFIED"},
    {"problem_idx": 0, "title": "Random Regular Graph Mixing", "kind": "LEMMA", "content": "With high probability, λ₁(G_{n,d}) ≥ d - 2√(d-1) - ε for large n.", "status": "VERIFIED"},
    {"problem_idx": 0, "title": "Trace Method Bounds", "kind": "CONTENT", "content": "Using Tr(A^k) to bound eigenvalues via moment methods.", "status": "PROPOSED"},
    
    # For Moduli
    {"problem_idx": 1, "title": "GRR Formula", "kind": "THEOREM", "content": "ch(f_!E) = f_*(ch(E) · td(T_f))", "status": "VERIFIED"},
    {"problem_idx": 1, "title": "Stable Range Conjecture", "kind": "CLAIM", "content": "H^k(M_g) stabilizes for g ≥ 3k/2", "status": "PROPOSED"},
    
    # For Primes
    {"problem_idx": 2, "title": "Bombieri-Vinogradov", "kind": "THEOREM", "content": "The primes have level of distribution at least 1/2.", "status": "VERIFIED"},
    {"problem_idx": 2, "title": "Gap Heuristic", "kind": "IDEA", "content": "GPY sieve might push level of distribution to 1/2 + ε", "status": "PROPOSED"},
    
    # For HoTT
    {"problem_idx": 3, "title": "Equivalence Definition", "kind": "DEFINITION", "content": "f : A → B is an equivalence if isContr(fiber f b) for all b : B", "status": "VERIFIED"},
    {"problem_idx": 3, "title": "Univalence Axiom", "kind": "THEOREM", "content": "(A ≃ B) ≃ (A = B) for types in a universe", "status": "VERIFIED"},
    
    # For Ricci Flow
    {"problem_idx": 4, "title": "Hamilton's Theorem", "kind": "THEOREM", "content": "Any metric on S² with positive curvature converges to constant curvature.", "status": "VERIFIED"},
    {"problem_idx": 4, "title": "Entropy Functional", "kind": "CONTENT", "content": "Perelman's W-entropy is monotonic under Ricci flow.", "status": "VERIFIED"},
    
    # For Quantum Groups
    {"problem_idx": 5, "title": "Lusztig's Conjecture", "kind": "CLAIM", "content": "Character formula for irreducible modules at roots of unity.", "status": "PROPOSED"},
    
    # For Knots
    {"problem_idx": 7, "title": "Khovanov Complex", "kind": "DEFINITION", "content": "Chain complex from cube of resolutions of a knot diagram.", "status": "VERIFIED"},
    {"problem_idx": 7, "title": "Torus Knot Formula", "kind": "COMPUTATION", "content": "Kh(T_{p,q}) has specific diagonal grading pattern.", "status": "PROPOSED"},
    
    # For QFT
    {"problem_idx": 8, "title": "Wilson RG", "kind": "CONTENT", "content": "Integrate out high-momentum modes iteratively.", "status": "VERIFIED"},
    
    # For Stochastic NS
    {"problem_idx": 9, "title": "Itô Formula for SPDE", "kind": "LEMMA", "content": "Energy estimate using Itô calculus in Hilbert spaces.", "status": "VERIFIED"},
    
    # For Topos
    {"problem_idx": 10, "title": "Mitchell-Bénabou Language", "kind": "DEFINITION", "content": "Internal language interprets type theory in a topos.", "status": "VERIFIED"},
    
    # For Crypto
    {"problem_idx": 11, "title": "LWE Hardness", "kind": "THEOREM", "content": "LWE reduces to worst-case lattice problems.", "status": "VERIFIED"},
    {"problem_idx": 11, "title": "NTRU Security Bound", "kind": "LEMMA", "content": "Key recovery requires solving approx-SVP in dimension n.", "status": "PROPOSED"},
]

DISCUSSIONS = [
    {"title": "Best approach for spectral bounds?", "content": "Should we use probabilistic or algebraic methods for the expander gap proof?", "problem_idx": 0, "author": "marcus"},
    {"title": "GRR computation help", "content": "I'm stuck on the Todd class computation for the universal curve. Any tips?", "problem_idx": 1, "author": "elena"},
    {"title": "Lean 4 syntax questions", "content": "How do you define dependent types elegantly in Lean 4?", "problem_idx": 3, "author": "anna"},
    {"title": "Welcome to ProofMesh!", "content": "Excited to see this community grow. Let's collaborate on some beautiful mathematics!", "problem_idx": None, "author": "elena"},
    {"title": "Looking for collaborators on RMT", "content": "Anyone interested in random matrix theory? Working on universality problems.", "problem_idx": None, "author": "carmen"},
    {"title": "Type theory reading group", "content": "Starting a virtual reading group for HoTT book. DM if interested!", "problem_idx": None, "author": "david"},
]

COMMENTS = [
    {"discussion_idx": 0, "author": "priya", "content": "I'd suggest starting with the trace method - it's more elementary and gives good intuition."},
    {"discussion_idx": 0, "author": "liang", "content": "Agreed, the Friedman bound follows nicely from trace estimates."},
    {"discussion_idx": 1, "author": "yuki", "content": "Try using the splitting principle first to reduce to line bundles."},
    {"discussion_idx": 3, "author": "sophie", "content": "This is great! Looking forward to the discussions."},
    {"discussion_idx": 3, "author": "marcus", "content": "Thanks for starting this. Let's make mathematics more collaborative!"},
    {"discussion_idx": 4, "author": "theo", "content": "I'm working on related stuff in mathematical physics. Count me in!"},
    {"discussion_idx": 5, "author": "felix", "content": "Interested! I've been learning type theory for formal verification."},
]


# ============================================================================
# Helper Functions
# ============================================================================

def random_past_time(max_days: int = 30, min_days: int = 0) -> datetime:
    """Generate a random datetime in the past."""
    days = random.randint(min_days, max_days)
    hours = random.randint(0, 23)
    minutes = random.randint(0, 59)
    return datetime.utcnow() - timedelta(days=days, hours=hours, minutes=minutes)


def build_workspace_markdown(title: str, description: str | None = None) -> str:
    summary = (description or "").strip() or "Describe the problem and its goals here."
    return f"""# {title}

{summary}

## Objectives
- Define the problem precisely
- Survey existing results
- Identify key techniques

## Notes
Add your working notes here...
"""


async def get_or_create_user(db, data: dict) -> User:
    result = await db.execute(select(User).where(User.email == data["email"]))
    user = result.scalar_one_or_none()
    if user:
        return user
    
    user = User(
        email=data["email"],
        username=data["username"],
        password_hash=get_password_hash("proofmesh123"),
        bio=data.get("bio"),
        created_at=random_past_time(90, 30),
    )
    db.add(user)
    await db.flush()
    return user


async def get_or_create_problem(db, author: User, data: dict) -> Problem:
    result = await db.execute(
        select(Problem).where(Problem.author_id == author.id, Problem.title == data["title"])
    )
    existing = result.scalar_one_or_none()
    if existing:
        return existing
    
    created_at = random_past_time(60, 5)
    problem = Problem(
        title=data["title"],
        description=data["description"],
        author_id=author.id,
        visibility=ProblemVisibility.PUBLIC if data["visibility"] == "public" else ProblemVisibility.PRIVATE,
        difficulty=data.get("difficulty"),
        tags=data.get("tags", []),
        created_at=created_at,
        updated_at=created_at,
    )
    db.add(problem)
    await db.flush()
    
    # Create workspace file
    db.add(WorkspaceFile(
        problem_id=problem.id,
        path="workspace.md",
        parent_path="",
        type=WorkspaceFileType.FILE,
        content=build_workspace_markdown(problem.title, problem.description),
        format="markdown",
        mimetype="text/markdown",
    ))
    
    # Create activity
    db.add(Activity(
        user_id=author.id,
        type=ActivityType.CREATED_PROBLEM,
        target_id=problem.id,
        extra_data={"problem_id": str(problem.id), "problem_title": problem.title},
        created_at=created_at,
    ))
    
    return problem


async def create_library_item(db, problem: Problem, users: dict, data: dict) -> LibraryItem | None:
    result = await db.execute(
        select(LibraryItem).where(
            LibraryItem.problem_id == problem.id,
            LibraryItem.title == data["title"]
        )
    )
    if result.scalar_one_or_none():
        return None
    
    # Map string to enum members (uppercase to match DB enum values)
    kind_map = {
        "RESOURCE": LibraryItemKind.RESOURCE,
        "IDEA": LibraryItemKind.IDEA,
        "CONTENT": LibraryItemKind.CONTENT,
        "LEMMA": LibraryItemKind.LEMMA,
        "CLAIM": LibraryItemKind.CLAIM,
        "DEFINITION": LibraryItemKind.DEFINITION,
        "THEOREM": LibraryItemKind.THEOREM,
        "COUNTEREXAMPLE": LibraryItemKind.COUNTEREXAMPLE,
        "COMPUTATION": LibraryItemKind.COMPUTATION,
        "NOTE": LibraryItemKind.NOTE,
    }
    status_map = {
        "PROPOSED": LibraryItemStatus.PROPOSED,
        "VERIFIED": LibraryItemStatus.VERIFIED,
        "REJECTED": LibraryItemStatus.REJECTED,
    }
    
    kind = kind_map.get(data.get("kind", "CONTENT"), LibraryItemKind.CONTENT)
    status = status_map.get(data.get("status", "PROPOSED"), LibraryItemStatus.PROPOSED)
    
    # Pick random author from users
    author_name = random.choice(list(users.keys()))
    author = users[author_name]
    
    created_at = random_past_time(30, 1)
    item = LibraryItem(
        problem_id=problem.id,
        title=data["title"],
        kind=kind,
        content=data["content"],
        status=status,
        authors=[{"type": "human", "id": str(author.id), "name": author.username}],
        created_at=created_at,
        updated_at=created_at,
    )
    db.add(item)
    await db.flush()
    
    # Create activity for verified items
    if data.get("status") == "VERIFIED":
        db.add(Activity(
            user_id=author.id,
            type=ActivityType.PUBLISHED_LIBRARY,
            target_id=item.id,
            extra_data={
                "problem_id": str(problem.id),
                "problem_title": problem.title,
                "item_title": item.title,
            },
            created_at=created_at,
        ))
    
    return item


async def create_follows(db, users: dict):
    """Create a realistic follow network."""
    user_list = list(users.values())
    
    # Each user follows 3-7 other users
    for user in user_list:
        num_following = random.randint(3, min(7, len(user_list) - 1))
        others = [u for u in user_list if u.id != user.id]
        to_follow = random.sample(others, num_following)
        
        for target in to_follow:
            result = await db.execute(
                select(Follow).where(
                    Follow.follower_id == user.id,
                    Follow.following_id == target.id
                )
            )
            if result.scalar_one_or_none():
                continue
            
            created_at = random_past_time(45, 1)
            db.add(Follow(
                follower_id=user.id,
                following_id=target.id,
                created_at=created_at,
            ))
            db.add(Activity(
                user_id=user.id,
                type=ActivityType.FOLLOWED_USER,
                target_id=target.id,
                extra_data={
                    "target_user_id": str(target.id),
                    "target_username": target.username,
                },
                created_at=created_at,
            ))


async def create_stars(db, users: dict, problems: list[Problem]):
    """Create stars on popular problems."""
    user_list = list(users.values())
    
    for problem in problems:
        # 30-80% of users star each public problem
        num_stars = random.randint(len(user_list) // 3, len(user_list) * 4 // 5)
        stargazers = random.sample(user_list, num_stars)
        
        for user in stargazers:
            result = await db.execute(
                select(Star).where(
                    Star.user_id == user.id,
                    Star.target_type == StarTargetType.PROBLEM,
                    Star.target_id == problem.id
                )
            )
            if result.scalar_one_or_none():
                continue
            
            db.add(Star(
                user_id=user.id,
                target_type=StarTargetType.PROBLEM,
                target_id=problem.id,
                created_at=random_past_time(20, 0),
            ))


async def create_discussions(db, users: dict, problems: list[Problem]):
    """Create discussions and comments."""
    created_discussions = []
    
    for disc_data in DISCUSSIONS:
        author = users[disc_data["author"]]
        problem = problems[disc_data["problem_idx"]] if disc_data["problem_idx"] is not None else None
        
        result = await db.execute(
            select(Discussion).where(
                Discussion.author_id == author.id,
                Discussion.title == disc_data["title"]
            )
        )
        if result.scalar_one_or_none():
            continue
        
        created_at = random_past_time(15, 1)
        discussion = Discussion(
            title=disc_data["title"],
            content=disc_data["content"],
            author_id=author.id,
            problem_id=problem.id if problem else None,
            created_at=created_at,
            updated_at=created_at,
        )
        db.add(discussion)
        await db.flush()
        created_discussions.append(discussion)
    
    # Add comments
    for comment_data in COMMENTS:
        if comment_data["discussion_idx"] >= len(created_discussions):
            continue
        
        discussion = created_discussions[comment_data["discussion_idx"]]
        author = users[comment_data["author"]]
        
        created_at = random_past_time(10, 0)
        comment = Comment(
            discussion_id=discussion.id,
            author_id=author.id,
            content=comment_data["content"],
            created_at=created_at,
            updated_at=created_at,
        )
        db.add(comment)


# ============================================================================
# Main
# ============================================================================

async def run_seed():
    print("🌱 Starting ProofMesh platform seed...")
    
    async with async_session_maker() as db:
        # Create users
        print("  Creating users...")
        users = {}
        for user_data in USERS:
            user = await get_or_create_user(db, user_data)
            users[user.username] = user
        print(f"    ✓ {len(users)} users")
        
        # Create problems
        print("  Creating problems...")
        problems = []
        for prob_data in PROBLEMS:
            author = users[prob_data["author"]]
            problem = await get_or_create_problem(db, author, prob_data)
            problems.append(problem)
        print(f"    ✓ {len(problems)} problems")
        
        # Create library items
        print("  Creating library items...")
        item_count = 0
        for item_data in LIBRARY_ITEMS:
            problem = problems[item_data["problem_idx"]]
            item = await create_library_item(db, problem, users, item_data)
            if item:
                item_count += 1
        print(f"    ✓ {item_count} library items")
        
        # Create follows
        print("  Creating follow network...")
        await create_follows(db, users)
        
        # Skip stars and discussions for now - tables don't exist yet
        # # Create stars
        # print("  Creating stars...")
        # await create_stars(db, users, problems)
        
        # # Create discussions
        # print("  Creating discussions...")
        # await create_discussions(db, users, problems)
        
        await db.commit()
        print("✅ Seed complete!")


def main():
    parser = argparse.ArgumentParser(description="Seed ProofMesh with sample data")
    parser.add_argument("--clean", action="store_true", help="Clean existing data first (not implemented)")
    args = parser.parse_args()
    
    asyncio.run(run_seed())


if __name__ == "__main__":
    main()
