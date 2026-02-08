"""Activity feed, contributions, and seed endpoints."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.activity import Activity, ActivityType
from app.models.problem import Problem, ProblemVisibility
from app.models.library_item import LibraryItem, LibraryItemKind
from app.models.workspace_file import WorkspaceFile, WorkspaceFileType
from app.models.follow import Follow
from app.models.discussion import Discussion
from app.api.deps import get_current_user
from app.schemas.social import (
    FeedResponse,
    FeedItem,
    FeedActor,
    FeedProblem,
    ProblemContribution,
    ContributorSummary,
    ProblemContributionsResponse,
)
from app.services.auth import get_password_hash
from .utils import get_follow_sets

router = APIRouter()


def _feed_score(activity: Activity) -> float:
    """Score activities for Discover feed ranking."""
    timestamp = activity.created_at.timestamp() if activity.created_at else 0.0

    # Prefer conversational proof activity in Discover.
    if activity.type == ActivityType.CREATED_COMMENT:
        return timestamp + 7 * 24 * 60 * 60
    if activity.type == ActivityType.CREATED_DISCUSSION:
        return timestamp + 2 * 24 * 60 * 60
    if activity.type == ActivityType.FOLLOWED_USER:
        return timestamp - 30 * 24 * 60 * 60
    return timestamp


def _prioritize_global_activities(
    activities: list[Activity],
    *,
    limit: int,
    offset: int,
) -> list[Activity]:
    """Prefer comments/discussions and avoid follow-event dominance at the top."""
    if not activities:
        return []

    ranked = sorted(
        activities,
        key=lambda activity: (_feed_score(activity), activity.created_at),
        reverse=True,
    )

    # Build enough rows for current page while capping FOLLOWED_USER noise.
    desired_count = offset + limit
    follow_cap = max(1, desired_count // 6)  # ~16% follow events max in early window
    follow_used = 0
    selected: list[Activity] = []
    deferred_follows: list[Activity] = []

    for activity in ranked:
        if activity.type == ActivityType.FOLLOWED_USER and follow_used >= follow_cap:
            deferred_follows.append(activity)
            continue
        selected.append(activity)
        if activity.type == ActivityType.FOLLOWED_USER:
            follow_used += 1
        if len(selected) >= desired_count:
            break

    if len(selected) < desired_count and deferred_follows:
        selected.extend(deferred_follows[: desired_count - len(selected)])

    return selected[offset : offset + limit]


@router.get("/feed", response_model=FeedResponse)
async def get_feed(
    scope: str = Query(default="network", pattern="^(network|global)$"),
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get activity feed for network or global scope."""
    following_ids, _ = await get_follow_sets(db, current_user.id)
    ids = set(following_ids)
    ids.add(current_user.id)

    query = select(Activity).options(selectinload(Activity.user)).order_by(Activity.created_at.desc())
    if scope == "network":
        query = query.where(Activity.user_id.in_(ids))
        query = query.limit(limit).offset(offset)
    else:
        # Pull a larger window for Discover so we can re-rank toward comments/discussions.
        window_limit = min(600, max(120, (offset + limit) * 6))
        query = query.limit(window_limit).offset(0)

    result = await db.execute(query)
    activities = result.scalars().all()
    if scope == "global":
        activities = _prioritize_global_activities(activities, limit=limit, offset=offset)

    problem_ids: set[UUID] = set()
    discussion_ids: set[UUID] = set()
    library_item_ids: set[UUID] = set()
    for activity in activities:
        data = activity.extra_data or {}
        raw_discussion_id = data.get("discussion_id")
        if raw_discussion_id:
            try:
                discussion_ids.add(UUID(raw_discussion_id))
            except ValueError:
                pass
        elif activity.type == ActivityType.CREATED_DISCUSSION and activity.target_id:
            discussion_ids.add(activity.target_id)
        elif (
            activity.type == ActivityType.CREATED_PROBLEM
            and activity.target_id
            and (data.get("discussion_title") or data.get("discussion_content"))
        ):
            # Backward-compatibility for older discussion events.
            discussion_ids.add(activity.target_id)

        # Capture library item targets to hydrate status/verification state
        if activity.type in {
            ActivityType.PUBLISHED_LIBRARY,
            ActivityType.UPDATED_LIBRARY,
            ActivityType.VERIFIED_LIBRARY,
        } and activity.target_id:
            library_item_ids.add(activity.target_id)

    discussions = {}
    if discussion_ids:
        discussion_result = await db.execute(select(Discussion).where(Discussion.id.in_(discussion_ids)))
        discussions = {d.id: d for d in discussion_result.scalars().all()}

    for activity in activities:
        data = activity.extra_data or {}
        raw_id = data.get("problem_id")
        if raw_id:
            try:
                problem_ids.add(UUID(raw_id))
            except ValueError:
                continue
        discussion = None
        raw_discussion_id = data.get("discussion_id")
        if raw_discussion_id:
            try:
                discussion = discussions.get(UUID(raw_discussion_id))
            except ValueError:
                discussion = None
        elif activity.type == ActivityType.CREATED_DISCUSSION and activity.target_id:
            discussion = discussions.get(activity.target_id)
        elif (
            activity.type == ActivityType.CREATED_PROBLEM
            and activity.target_id
            and (data.get("discussion_title") or data.get("discussion_content"))
        ):
            discussion = discussions.get(activity.target_id)
        if discussion and discussion.problem_id:
            problem_ids.add(discussion.problem_id)

    problems = {}
    if problem_ids:
        prob_result = await db.execute(select(Problem).where(Problem.id.in_(problem_ids)))
        problems = {p.id: p for p in prob_result.scalars().all()}

    library_items = {}
    if library_item_ids:
        li_result = await db.execute(select(LibraryItem).where(LibraryItem.id.in_(library_item_ids)))
        library_items = {li.id: li for li in li_result.scalars().all()}

    items: list[FeedItem] = []
    for activity in activities:
        actor = activity.user
        data = dict(activity.extra_data or {})
        discussion = None
        raw_discussion_id = data.get("discussion_id")
        if raw_discussion_id:
            try:
                discussion = discussions.get(UUID(raw_discussion_id))
            except ValueError:
                discussion = None
        elif activity.type == ActivityType.CREATED_DISCUSSION and activity.target_id:
            discussion = discussions.get(activity.target_id)
        elif (
            activity.type == ActivityType.CREATED_PROBLEM
            and activity.target_id
            and (data.get("discussion_title") or data.get("discussion_content"))
        ):
            discussion = discussions.get(activity.target_id)
        if discussion:
            data.setdefault("discussion_id", str(discussion.id))
            data.setdefault("discussion_title", discussion.title)
            if activity.type in {ActivityType.CREATED_DISCUSSION, ActivityType.CREATED_PROBLEM}:
                data.setdefault("discussion_content", discussion.content)
            if discussion.problem_id:
                data.setdefault("problem_id", str(discussion.problem_id))

        problem = None
        raw_id = data.get("problem_id")
        if raw_id:
            try:
                pid = UUID(raw_id)
                p = problems.get(pid)
                if p:
                    data.setdefault("problem_title", p.title)
                    problem = FeedProblem(id=p.id, title=p.title, visibility=p.visibility.value)
            except ValueError:
                pass
        # Attach live node status (matches current DB state)
        lib = library_items.get(activity.target_id) if activity.target_id else None

        items.append(
            FeedItem(
                id=activity.id,
                type=activity.type.value,
                actor=FeedActor(id=actor.id, username=actor.username, avatar_url=actor.avatar_url),
                problem=problem,
                target_id=activity.target_id,
                item_status=lib.status.value if lib else None,
                item_kind=lib.kind.value if lib else None,
                verification_status=(lib.verification or {}).get("status") if lib else None,
                verification_method=(lib.verification or {}).get("method") if lib else None,
                has_lean_code=bool(lib.lean_code) if lib else None,
                extra_data=data,
                created_at=activity.created_at,
            )
        )

    return FeedResponse(items=items, total=len(items))


@router.get("/contributions", response_model=ProblemContributionsResponse)
async def get_contributions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get problem contributions for current user."""
    query = (
        select(Problem)
        .options(selectinload(Problem.library_items))
        .options(selectinload(Problem.author))
        .where(
            (Problem.visibility == ProblemVisibility.PUBLIC)
            | (Problem.author_id == current_user.id)
        )
    )
    result = await db.execute(query)
    problems = result.scalars().all()

    author_ids: set[UUID] = set()
    for problem in problems:
        author_ids.add(problem.author_id)
        for item in problem.library_items:
            for author in item.authors or []:
                if author.get("type") == "human" and author.get("id"):
                    try:
                        author_ids.add(UUID(author["id"]))
                    except ValueError:
                        continue

    users = {}
    if author_ids:
        user_result = await db.execute(select(User).where(User.id.in_(author_ids)))
        users = {u.id: u for u in user_result.scalars().all()}

    payload: list[ProblemContribution] = []
    for problem in problems:
        contributions: dict[UUID, dict] = {}
        last_activity: datetime | None = None
        for item in problem.library_items:
            last_activity = max(last_activity or item.updated_at, item.updated_at)
            for author in item.authors or []:
                if author.get("type") != "human" or not author.get("id"):
                    continue
                try:
                    uid = UUID(author["id"])
                except ValueError:
                    continue
                entry = contributions.setdefault(uid, {"count": 0, "last": None})
                entry["count"] += 1
                entry["last"] = max(entry["last"] or item.updated_at, item.updated_at)

        contributors: list[ContributorSummary] = []
        for uid, data in contributions.items():
            user = users.get(uid)
            if not user:
                continue
            contributors.append(
                ContributorSummary(
                    id=user.id,
                    username=user.username,
                    avatar_url=user.avatar_url,
                    contributions=data["count"],
                    last_contributed_at=data["last"],
                )
            )

        contributors.sort(key=lambda c: (-c.contributions, c.username))
        total_contributions = sum(c.contributions for c in contributors)
        payload.append(
            ProblemContribution(
                problem_id=problem.id,
                problem_title=problem.title,
                visibility=problem.visibility.value,
                total_contributions=total_contributions,
                last_activity_at=last_activity or problem.updated_at,
                contributors=contributors,
            )
        )

    payload.sort(key=lambda p: p.total_contributions, reverse=True)
    return ProblemContributionsResponse(problems=payload, total=len(payload))


@router.post("/seed")
async def seed_social(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Seed demo users, connections, problems, and activities."""
    samples = [
        {"email": "sofia@proofmesh.dev", "username": "sofia", "bio": "Geometry and synthetic methods."},
        {"email": "liam@proofmesh.dev", "username": "liam", "bio": "Analytic number theory explorer."},
        {"email": "amara@proofmesh.dev", "username": "amara", "bio": "Topology + category theory."},
        {"email": "kai@proofmesh.dev", "username": "kai", "bio": "Computation and experiments."},
        {"email": "noah@proofmesh.dev", "username": "noah", "bio": "Algebra and structures."},
        {"email": "lucia@proofmesh.dev", "username": "lucia", "bio": "Combinatorics and probabilistic methods."},
    ]

    existing_result = await db.execute(select(User).where(User.email.in_([s["email"] for s in samples])))
    existing = {u.email: u for u in existing_result.scalars().all()}

    created_users: list[User] = []
    for sample in samples:
        if sample["email"] in existing:
            created_users.append(existing[sample["email"]])
            continue
        user = User(
            email=sample["email"],
            username=sample["username"],
            password_hash=get_password_hash("proofmesh"),
            bio=sample["bio"],
        )
        db.add(user)
        created_users.append(user)

    await db.flush()

    user_lookup = {u.username: u for u in created_users}
    all_users = list(created_users)
    if current_user not in all_users:
        all_users.append(current_user)

    follow_pairs = [
        (current_user, user_lookup["sofia"]),
        (current_user, user_lookup["liam"]),
        (user_lookup["amara"], current_user),
        (user_lookup["kai"], current_user),
        (user_lookup["lucia"], user_lookup["noah"]),
        (user_lookup["sofia"], user_lookup["amara"]),
    ]

    for follower, following in follow_pairs:
        existing_follow = await db.execute(
            select(Follow).where(
                Follow.follower_id == follower.id,
                Follow.following_id == following.id,
            )
        )
        if existing_follow.scalar_one_or_none():
            continue
        db.add(Follow(follower_id=follower.id, following_id=following.id))
        db.add(
            Activity(
                user_id=follower.id,
                type=ActivityType.FOLLOWED_USER,
                target_id=following.id,
                extra_data={"target_user_id": str(following.id), "target_username": following.username},
            )
        )

    problem_templates = [
        {
            "title": "Spectral Gaps in Expander Graphs",
            "description": "Estimate expansion constants and relate them to eigenvalue bounds.",
            "author": user_lookup["lucia"],
            "tags": ["graph theory", "spectral"],
        },
        {
            "title": "Cohomology Vanishing Patterns",
            "description": "Track vanishing ranges for twisted coefficients.",
            "author": user_lookup["amara"],
            "tags": ["topology", "cohomology"],
        },
        {
            "title": "Diophantine Approximation Flows",
            "description": "Study dynamics of flows on homogeneous spaces.",
            "author": user_lookup["liam"],
            "tags": ["number theory", "dynamics"],
        },
    ]

    created_problems: list[Problem] = []
    for template in problem_templates:
        exists = await db.execute(
            select(Problem).where(
                Problem.author_id == template["author"].id,
                Problem.title == template["title"],
            )
        )
        existing_problem = exists.scalar_one_or_none()
        if existing_problem:
            created_problems.append(existing_problem)
            continue
        problem = Problem(
            title=template["title"],
            description=template["description"],
            author_id=template["author"].id,
            visibility=ProblemVisibility.PUBLIC,
            tags=template["tags"],
        )
        db.add(problem)
        await db.flush()
        db.add(
            WorkspaceFile(
                problem_id=problem.id,
                path="workspace.md",
                parent_path="",
                type=WorkspaceFileType.FILE,
                content=f"# {problem.title}\n\n{problem.description}\n\n## Notes\n",
                format="markdown",
                mimetype="text/markdown",
            )
        )
        db.add(
            Activity(
                user_id=template["author"].id,
                type=ActivityType.CREATED_PROBLEM,
                target_id=problem.id,
                extra_data={"problem_id": str(problem.id), "problem_title": problem.title},
            )
        )
        created_problems.append(problem)

    await db.flush()

    library_templates = [
        {
            "problem": problem_templates[0]["title"],
            "title": "Cheeger constant bounds",
            "kind": LibraryItemKind.LEMMA,
            "content": "Lower bounds on h(G) via the second eigenvalue.",
            "authors": [user_lookup["lucia"], user_lookup["kai"]],
        },
        {
            "problem": problem_templates[1]["title"],
            "title": "Vanishing conjecture draft",
            "kind": LibraryItemKind.IDEA,
            "content": "Outline candidate vanishing range using spectral sequences.",
            "authors": [user_lookup["amara"]],
        },
        {
            "problem": problem_templates[2]["title"],
            "title": "Flow normalization notes",
            "kind": LibraryItemKind.CONTENT,
            "content": "Normalize geodesic flow to compare Diophantine exponents.",
            "authors": [user_lookup["liam"], user_lookup["sofia"]],
        },
    ]

    for template in library_templates:
        problem = next((p for p in created_problems if p.title == template["problem"]), None)
        if not problem:
            continue
        existing_item = await db.execute(
            select(LibraryItem).where(
                LibraryItem.problem_id == problem.id,
                LibraryItem.title == template["title"],
            )
        )
        if existing_item.scalar_one_or_none():
            continue
        authors_payload = [
            {"type": "human", "id": str(author.id), "name": author.username}
            for author in template["authors"]
        ]
        item = LibraryItem(
            problem_id=problem.id,
            title=template["title"],
            kind=template["kind"],
            content=template["content"],
            authors=authors_payload,
        )
        db.add(item)
        await db.flush()
        primary_author = template["authors"][0]
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

    await db.commit()
    return {"status": "seeded"}
