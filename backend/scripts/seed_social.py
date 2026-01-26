import argparse
import asyncio
from datetime import datetime

from sqlalchemy import select

from app.database import async_session_maker
from app.models.user import User
from app.models.follow import Follow
from app.models.problem import Problem, ProblemVisibility
from app.models.workspace_file import WorkspaceFile, WorkspaceFileType
from app.models.library_item import LibraryItem, LibraryItemKind
from app.models.activity import Activity, ActivityType
from app.services.auth import get_password_hash


SAMPLE_USERS = [
    {
        "email": "sofia@proofmesh.dev",
        "username": "sofia",
        "bio": "Geometry and synthetic methods.",
    },
    {
        "email": "liam@proofmesh.dev",
        "username": "liam",
        "bio": "Analytic number theory explorer.",
    },
    {
        "email": "amara@proofmesh.dev",
        "username": "amara",
        "bio": "Topology + category theory.",
    },
    {
        "email": "kai@proofmesh.dev",
        "username": "kai",
        "bio": "Computation and experiments.",
    },
    {
        "email": "noah@proofmesh.dev",
        "username": "noah",
        "bio": "Algebra and structures.",
    },
    {
        "email": "lucia@proofmesh.dev",
        "username": "lucia",
        "bio": "Combinatorics and probabilistic methods.",
    },
]

PROBLEM_TEMPLATES = [
    {
        "title": "Spectral Gaps in Expander Graphs",
        "description": "Estimate expansion constants and relate them to eigenvalue bounds.",
        "author": "lucia",
        "tags": ["graph theory", "spectral"],
    },
    {
        "title": "Cohomology Vanishing Patterns",
        "description": "Track vanishing ranges for twisted coefficients.",
        "author": "amara",
        "tags": ["topology", "cohomology"],
    },
    {
        "title": "Diophantine Approximation Flows",
        "description": "Study dynamics of flows on homogeneous spaces.",
        "author": "liam",
        "tags": ["number theory", "dynamics"],
    },
]

LIBRARY_TEMPLATES = [
    {
        "problem": "Spectral Gaps in Expander Graphs",
        "title": "Cheeger constant bounds",
        "kind": LibraryItemKind.LEMMA,
        "content": "Lower bounds on h(G) via the second eigenvalue.",
        "authors": ["lucia", "kai"],
    },
    {
        "problem": "Cohomology Vanishing Patterns",
        "title": "Vanishing conjecture draft",
        "kind": LibraryItemKind.IDEA,
        "content": "Outline candidate vanishing range using spectral sequences.",
        "authors": ["amara"],
    },
    {
        "problem": "Diophantine Approximation Flows",
        "title": "Flow normalization notes",
        "kind": LibraryItemKind.CONTENT,
        "content": "Normalize geodesic flow to compare Diophantine exponents.",
        "authors": ["liam", "sofia"],
    },
]


def build_workspace_markdown(title: str, description: str | None = None) -> str:
    summary = (description or "").strip() or "Describe the problem and its goals here."
    return f"""# {title}

{summary}

## Workspace
- Objectives
- Known results
- Open questions

## Notes
"""

async def get_or_create_user(db, email: str, username: str, bio: str | None = None):
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user:
        return user
    user = User(
        email=email,
        username=username,
        password_hash=get_password_hash("proofmesh"),
        bio=bio,
    )
    db.add(user)
    await db.flush()
    return user


async def ensure_follow(db, follower: User, following: User):
    result = await db.execute(
        select(Follow).where(
            Follow.follower_id == follower.id,
            Follow.following_id == following.id,
        )
    )
    if result.scalar_one_or_none():
        return
    db.add(Follow(follower_id=follower.id, following_id=following.id))
    db.add(
        Activity(
            user_id=follower.id,
            type=ActivityType.FOLLOWED_USER,
            target_id=following.id,
            extra_data={
                "target_user_id": str(following.id),
                "target_username": following.username,
            },
        )
    )


async def get_or_create_problem(db, author: User, title: str, description: str, tags: list[str]):
    result = await db.execute(
        select(Problem).where(Problem.author_id == author.id, Problem.title == title)
    )
    existing = result.scalar_one_or_none()
    if existing:
        return existing
    problem = Problem(
        title=title,
        description=description,
        author_id=author.id,
        visibility=ProblemVisibility.PUBLIC,
        tags=tags,
    )
    db.add(problem)
    await db.flush()
    db.add(
        WorkspaceFile(
            problem_id=problem.id,
            path="workspace.md",
            parent_path="",
            type=WorkspaceFileType.FILE,
            content=build_workspace_markdown(problem.title, problem.description),
            format="markdown",
            mimetype="text/markdown",
        )
    )
    db.add(
        Activity(
            user_id=author.id,
            type=ActivityType.CREATED_PROBLEM,
            target_id=problem.id,
            extra_data={"problem_id": str(problem.id), "problem_title": problem.title},
        )
    )
    return problem


async def ensure_library_item(db, problem: Problem, title: str, kind, content: str, authors: list[User]):
    result = await db.execute(
        select(LibraryItem).where(LibraryItem.problem_id == problem.id, LibraryItem.title == title)
    )
    if result.scalar_one_or_none():
        return
    authors_payload = [
        {"type": "human", "id": str(author.id), "name": author.username}
        for author in authors
    ]
    item = LibraryItem(
        problem_id=problem.id,
        title=title,
        kind=kind,
        content=content,
        authors=authors_payload,
    )
    db.add(item)
    await db.flush()
    primary_author = authors[0]
    db.add(
        Activity(
            user_id=primary_author.id,
            type=ActivityType.PUBLISHED_LIBRARY,
            target_id=item.id,
            extra_data={
                "problem_id": str(problem.id),
                "problem_title": problem.title,
                "item_title": item.title,
            },
        )
    )


async def run(owner_email: str, owner_username: str, owner_bio: str | None):
    async with async_session_maker() as db:
        owner = await get_or_create_user(
            db,
            owner_email,
            owner_username,
            owner_bio,
        )

        created_users: list[User] = []
        for sample in SAMPLE_USERS:
            user = await get_or_create_user(
                db,
                sample["email"],
                sample["username"],
                sample["bio"],
            )
            created_users.append(user)

        user_lookup = {u.username: u for u in created_users}

        follow_pairs = [
            (owner, user_lookup["sofia"]),
            (owner, user_lookup["liam"]),
            (user_lookup["amara"], owner),
            (user_lookup["kai"], owner),
            (user_lookup["lucia"], user_lookup["noah"]),
            (user_lookup["sofia"], user_lookup["amara"]),
        ]

        for follower, following in follow_pairs:
            await ensure_follow(db, follower, following)

        problems = {}
        for template in PROBLEM_TEMPLATES:
            author = user_lookup[template["author"]]
            problem = await get_or_create_problem(
                db,
                author,
                template["title"],
                template["description"],
                template["tags"],
            )
            problems[template["title"]] = problem

        for template in LIBRARY_TEMPLATES:
            problem = problems.get(template["problem"])
            if not problem:
                continue
            authors = [user_lookup[name] for name in template["authors"] if name in user_lookup]
            if not authors:
                continue
            await ensure_library_item(
                db,
                problem,
                template["title"],
                template["kind"],
                template["content"],
                authors,
            )

        await db.commit()
        print("Seed complete at", datetime.utcnow().isoformat())


def main():
    parser = argparse.ArgumentParser(description="Seed social graph data.")
    parser.add_argument("--owner-email", default="demo@proofmesh.dev")
    parser.add_argument("--owner-username", default="demo")
    parser.add_argument("--owner-bio", default="Local demo researcher.")
    args = parser.parse_args()

    asyncio.run(run(args.owner_email, args.owner_username, args.owner_bio))


if __name__ == "__main__":
    main()
