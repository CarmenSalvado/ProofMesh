from __future__ import annotations

import os
import re
from datetime import datetime
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.follow import Follow
from app.models.activity import Activity, ActivityType
from app.models.problem import Problem, ProblemVisibility
from app.models.library_item import LibraryItem, LibraryItemKind
from app.models.workspace_file import WorkspaceFile, WorkspaceFileType
from app.models.discussion import Discussion
from app.models.comment import Comment
from app.models.star import Star, StarTargetType
from app.models.notification import Notification, NotificationType
from app.models.team import Team, TeamMember, TeamProblem, TeamRole
from app.api.deps import get_current_user
from app.schemas.social import (
    SocialUser,
    UserDirectoryResponse,
    ConnectionsResponse,
    FeedResponse,
    FeedItem,
    FeedActor,
    FeedProblem,
    ProblemContribution,
    ContributorSummary,
    ProblemContributionsResponse,
    DiscussionCreate,
    DiscussionUpdate,
    DiscussionResponse,
    DiscussionListResponse,
    CommentCreate,
    CommentUpdate,
    CommentResponse,
    CommentListResponse,
    StarCreate,
    StarResponse,
    StarListResponse,
    NotificationResponse,
    NotificationListResponse,
    NotificationMarkRead,
    TeamCreate,
    TeamUpdate,
    TeamResponse,
    TeamDetailResponse,
    TeamListResponse,
    TeamMemberResponse,
    TeamInvite,
    TeamAddProblem,
)
from app.services.auth import get_password_hash

router = APIRouter(prefix="/api/social", tags=["social"])

RHO_USERNAME = "rho"
RHO_EMAIL = "rho@proofmesh.org"
RHO_AVATAR_URL = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'%3E%3Crect width='128' height='128' rx='64' fill='%23111827'/%3E%3Ctext x='64' y='84' text-anchor='middle' font-size='72' font-family='Georgia%2Cserif' fill='white'%3E%26%23961%3B%3C/text%3E%3C/svg%3E"
RHO_MENTION_PATTERN = re.compile(r"(?:^|\s)@rho\b", flags=re.IGNORECASE)
RHO_PREFIX_PATTERN = re.compile(r"^\s*(?:@?rho)\s*[:\\-–—]\\s*", flags=re.IGNORECASE)


def has_rho_mention(content: str) -> bool:
    return bool(RHO_MENTION_PATTERN.search(content or ""))

def normalize_rho_text(text: str) -> str:
    """Remove redundant 'Rho:' prefix if present (UI already shows author)."""
    raw = (text or "").strip()
    raw = RHO_PREFIX_PATTERN.sub("", raw).strip()
    return raw

def normalize_rho_question(text: str) -> str:
    """Remove @rho mention and redundant prefix to focus the model on the actual question."""
    raw = (text or "").strip()
    raw = RHO_MENTION_PATTERN.sub("", raw).strip()
    raw = normalize_rho_text(raw)
    return raw

async def _load_comment(db: AsyncSession, comment_id: UUID) -> Comment | None:
    result = await db.execute(
        select(Comment)
        .options(selectinload(Comment.author))
        .where(Comment.id == comment_id)
    )
    return result.scalar_one_or_none()

async def build_rho_thread_context(
    *,
    db: AsyncSession,
    discussion: Discussion,
    trigger_comment: Comment,
    max_parent_depth: int = 6,
    recent_limit: int = 14,
    sibling_limit: int = 6,
) -> dict[str, str]:
    """Build a context bundle for Rho, including parent chain for subreplies."""
    # Parent chain: root -> ... -> direct parent
    parent_chain: list[Comment] = []
    parent_id = trigger_comment.parent_id
    seen: set[UUID] = set()
    while parent_id and parent_id not in seen and len(parent_chain) < max_parent_depth:
        seen.add(parent_id)
        parent = await _load_comment(db, parent_id)
        if not parent:
            break
        parent_chain.append(parent)
        parent_id = parent.parent_id
    parent_chain.reverse()

    # Siblings: other replies to the same parent (useful for subthreads).
    sibling_comments: list[Comment] = []
    if trigger_comment.parent_id:
        sib_result = await db.execute(
            select(Comment)
            .options(selectinload(Comment.author))
            .where(
                Comment.discussion_id == discussion.id,
                Comment.parent_id == trigger_comment.parent_id,
                Comment.id != trigger_comment.id,
            )
            .order_by(Comment.created_at.desc())
            .limit(sibling_limit)
        )
        sibling_comments = list(reversed(sib_result.scalars().all()))

    # Recent thread: last messages anywhere in the discussion.
    recent_result = await db.execute(
        select(Comment)
        .options(selectinload(Comment.author))
        .where(Comment.discussion_id == discussion.id)
        .order_by(Comment.created_at.desc())
        .limit(recent_limit)
    )
    recent_comments = list(reversed(recent_result.scalars().all()))

    def fmt(items: list[Comment]) -> str:
        lines: list[str] = []
        for item in items:
            author = getattr(item.author, "username", "unknown")
            content = (item.content or "").strip()
            if len(content) > 600:
                content = content[:600] + "…"
            lines.append(f"{author}: {content}")
        return "\n".join(lines) if lines else "None."

    return {
        "parent_chain": fmt(parent_chain),
        "siblings": fmt(sibling_comments),
        "recent": fmt(recent_comments),
    }


async def get_or_create_rho_user(db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.username == RHO_USERNAME))
    rho_user = result.scalar_one_or_none()
    if rho_user:
        if rho_user.avatar_url != RHO_AVATAR_URL:
            rho_user.avatar_url = RHO_AVATAR_URL
        return rho_user

    result = await db.execute(select(User).where(User.email == RHO_EMAIL))
    rho_user = result.scalar_one_or_none()
    if rho_user:
        if rho_user.avatar_url != RHO_AVATAR_URL:
            rho_user.avatar_url = RHO_AVATAR_URL
        return rho_user

    rho_user = User(
        email=RHO_EMAIL,
        username=RHO_USERNAME,
        password_hash=get_password_hash(f"rho-{datetime.utcnow().isoformat()}"),
        bio="AI mathematical assistant (Gemini-backed)",
        avatar_url=RHO_AVATAR_URL,
    )
    db.add(rho_user)
    await db.flush()
    return rho_user


async def generate_rho_reply(
    *,
    discussion: Discussion,
    question: str,
    thread_context: dict[str, str],
) -> str:
    api_key = (
        os.environ.get("GEMINI_API_KEY")
        or os.environ.get("GOOGLE_GENERATIVE_AI_API_KEY")
    )
    if not api_key:
        return (
            "I can help critique this, but Gemini is not configured yet. "
            "Set GEMINI_API_KEY and mention @rho again."
        )

    try:
        from google import genai
        from google.genai import types

        parent_chain_text = (thread_context.get("parent_chain") or "None.").strip() or "None."
        sibling_text = (thread_context.get("siblings") or "None.").strip() or "None."
        recent_text = (thread_context.get("recent") or "None.").strip() or "None."
        focused_question = normalize_rho_question(question) or (question or "").strip()

        prompt = (
            "You are Rho, an AI mathematical collaborator inside ProofMesh.\n"
            "Give a concise reply (max 6 lines) focused on truth-checking and mathematical rigor.\n"
            "If uncertain, say what should be verified next.\n\n"
            f"Discussion title: {discussion.title}\n"
            f"Discussion content: {discussion.content[:1200]}\n\n"
            "Parent chain (root -> direct parent):\n"
            f"{parent_chain_text}\n\n"
            "Sibling replies (same parent):\n"
            f"{sibling_text}\n\n"
            "Recent thread (for overall context):\n"
            f"{recent_text}\n\n"
            "User message (answer this):\n"
            f"{focused_question}\n"
        )

        client = genai.Client(api_key=api_key)
        response = await client.aio.models.generate_content(
            model="gemini-3-flash-preview",
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.3,
                max_output_tokens=420,
            ),
        )
        text = (response.text or "").strip()
        text = normalize_rho_text(text)
        if not text:
            return "I could not produce a reliable answer. Please share more details or equations."
        return text[:1800]
    except Exception:
        return (
            "I could not run a full verification right now. "
            "Please provide the exact claim and assumptions, and I will check it step by step."
        )


async def get_follow_sets(db: AsyncSession, user_id: UUID):
    following_result = await db.execute(
        select(Follow.following_id).where(Follow.follower_id == user_id)
    )
    followers_result = await db.execute(
        select(Follow.follower_id).where(Follow.following_id == user_id)
    )
    following_ids = {row[0] for row in following_result.all()}
    follower_ids = {row[0] for row in followers_result.all()}
    return following_ids, follower_ids


def build_social_user(
    user: User,
    following_ids: set[UUID],
    follower_ids: set[UUID],
) -> SocialUser:
    return SocialUser(
        id=user.id,
        username=user.username,
        avatar_url=user.avatar_url,
        bio=user.bio,
        is_following=user.id in following_ids,
        is_followed_by=user.id in follower_ids,
    )


@router.get("/users", response_model=UserDirectoryResponse)
async def list_users(
    q: str | None = None,
    limit: int = Query(default=30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(User).where(User.id != current_user.id)
    if q:
        query = query.where(User.username.ilike(f"%{q}%"))
    query = query.order_by(User.created_at.desc()).limit(limit)

    result = await db.execute(query)
    users = result.scalars().all()
    following_ids, follower_ids = await get_follow_sets(db, current_user.id)
    payload = [build_social_user(user, following_ids, follower_ids) for user in users]
    return UserDirectoryResponse(users=payload, total=len(payload))


@router.get("/connections", response_model=ConnectionsResponse)
async def get_connections(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    following_ids, follower_ids = await get_follow_sets(db, current_user.id)

    followers_result = await db.execute(
        select(User).join(Follow, Follow.follower_id == User.id).where(
            Follow.following_id == current_user.id
        )
    )
    following_result = await db.execute(
        select(User).join(Follow, Follow.following_id == User.id).where(
            Follow.follower_id == current_user.id
        )
    )

    followers = followers_result.scalars().all()
    following = following_result.scalars().all()

    follower_payload = [build_social_user(user, following_ids, follower_ids) for user in followers]
    following_payload = [build_social_user(user, following_ids, follower_ids) for user in following]

    return ConnectionsResponse(
        followers=follower_payload,
        following=following_payload,
        total_followers=len(follower_payload),
        total_following=len(following_payload),
    )


@router.post("/follow/{user_id}")
async def follow_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")

    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    existing = await db.execute(
        select(Follow).where(
            Follow.follower_id == current_user.id,
            Follow.following_id == user_id,
        )
    )
    if existing.scalar_one_or_none():
        return {"status": "already_following"}

    follow = Follow(follower_id=current_user.id, following_id=user_id)
    db.add(follow)
    db.add(
        Activity(
            user_id=current_user.id,
            type=ActivityType.FOLLOWED_USER,
            target_id=user_id,
            extra_data={"target_user_id": str(user_id), "target_username": target.username},
        )
    )
    await db.commit()
    return {"status": "followed"}


@router.delete("/follow/{user_id}")
async def unfollow_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Follow).where(
            Follow.follower_id == current_user.id,
            Follow.following_id == user_id,
        )
    )
    follow = result.scalar_one_or_none()
    if not follow:
        return {"status": "not_following"}

    await db.delete(follow)
    await db.commit()
    return {"status": "unfollowed"}


@router.get("/feed", response_model=FeedResponse)
async def get_feed(
    scope: str = Query(default="network", pattern="^(network|global)$"),
    limit: int = Query(default=30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    following_ids, _ = await get_follow_sets(db, current_user.id)
    ids = set(following_ids)
    ids.add(current_user.id)

    query = select(Activity).options(selectinload(Activity.user)).order_by(Activity.created_at.desc())
    if scope == "network":
        query = query.where(Activity.user_id.in_(ids))
    query = query.limit(limit)

    result = await db.execute(query)
    activities = result.scalars().all()

    problem_ids: set[UUID] = set()
    library_item_ids: set[UUID] = set()
    for activity in activities:
        data = activity.extra_data or {}
        raw_id = data.get("problem_id")
        if raw_id:
            try:
                problem_ids.add(UUID(raw_id))
            except ValueError:
                continue
        if activity.type in {
            ActivityType.PUBLISHED_LIBRARY,
            ActivityType.UPDATED_LIBRARY,
            ActivityType.VERIFIED_LIBRARY,
        } and activity.target_id:
            library_item_ids.add(activity.target_id)

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
        data = activity.extra_data or {}
        problem = None
        raw_id = data.get("problem_id")
        if raw_id:
            try:
                pid = UUID(raw_id)
                p = problems.get(pid)
                if p:
                    problem = FeedProblem(id=p.id, title=p.title, visibility=p.visibility.value)
            except ValueError:
                pass
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
                entry = contributions.setdefault(
                    uid,
                    {"count": 0, "last": None},
                )
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
        {
            "email": "sofia@proofmesh.org",
            "username": "sofia",
            "bio": "Geometry and synthetic methods.",
        },
        {
            "email": "liam@proofmesh.org",
            "username": "liam",
            "bio": "Analytic number theory explorer.",
        },
        {
            "email": "amara@proofmesh.org",
            "username": "amara",
            "bio": "Topology + category theory.",
        },
        {
            "email": "kai@proofmesh.org",
            "username": "kai",
            "bio": "Computation and experiments.",
        },
        {
            "email": "noah@proofmesh.org",
            "username": "noah",
            "bio": "Algebra and structures.",
        },
        {
            "email": "lucia@proofmesh.org",
            "username": "lucia",
            "bio": "Combinatorics and probabilistic methods.",
        },
    ]

    existing_result = await db.execute(
        select(User).where(User.username.in_([s["username"] for s in samples]))
    )
    existing = {u.username: u for u in existing_result.scalars().all()}

    created_users: list[User] = []
    for sample in samples:
        if sample["username"] in existing:
            user = existing[sample["username"]]
            # Keep seed idempotent even if email domain changes over time.
            if user.email != sample["email"]:
                user.email = sample["email"]
            if user.bio != sample["bio"]:
                user.bio = sample["bio"]
            created_users.append(user)
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


# ========================
# Discussion Endpoints
# ========================

@router.get("/discussions", response_model=DiscussionListResponse)
async def list_discussions(
    problem_id: UUID | None = None,
    library_item_id: UUID | None = None,
    limit: int = Query(default=30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List discussions for a problem or library item."""
    query = select(Discussion).options(selectinload(Discussion.author))
    
    if problem_id:
        query = query.where(Discussion.problem_id == problem_id)
    elif library_item_id:
        query = query.where(Discussion.library_item_id == library_item_id)
    
    query = query.order_by(Discussion.is_pinned.desc(), Discussion.created_at.desc()).limit(limit)
    result = await db.execute(query)
    discussions = result.scalars().all()
    
    following_ids, follower_ids = await get_follow_sets(db, current_user.id)
    
    payload = []
    for d in discussions:
        # Count comments
        comment_count_result = await db.execute(
            select(Comment).where(Comment.discussion_id == d.id)
        )
        comment_count = len(comment_count_result.scalars().all())
        
        payload.append(DiscussionResponse(
            id=d.id,
            title=d.title,
            content=d.content,
            author=build_social_user(d.author, following_ids, follower_ids),
            problem_id=d.problem_id,
            library_item_id=d.library_item_id,
            is_resolved=d.is_resolved,
            is_pinned=d.is_pinned,
            comment_count=comment_count,
            created_at=d.created_at,
            updated_at=d.updated_at,
        ))
    
    return DiscussionListResponse(discussions=payload, total=len(payload))


@router.post("/discussions", response_model=DiscussionResponse)
async def create_discussion(
    data: DiscussionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new discussion."""
    discussion = Discussion(
        title=data.title,
        content=data.content,
        author_id=current_user.id,
        problem_id=data.problem_id,
        library_item_id=data.library_item_id,
    )
    db.add(discussion)
    
    # Create activity
    extra_data = {
        "discussion_title": data.title,
        "discussion_content": data.content,
    }
    if data.problem_id:
        problem_result = await db.execute(select(Problem).where(Problem.id == data.problem_id))
        problem = problem_result.scalar_one_or_none()
        if problem:
            extra_data["problem_id"] = str(problem.id)
            extra_data["problem_title"] = problem.title
    
    db.add(Activity(
        user_id=current_user.id,
        type=ActivityType.CREATED_PROBLEM,  # Reuse for now, could add CREATED_DISCUSSION
        target_id=discussion.id,
        extra_data=extra_data,
    ))
    
    await db.commit()
    await db.refresh(discussion)
    
    following_ids, follower_ids = await get_follow_sets(db, current_user.id)
    
    return DiscussionResponse(
        id=discussion.id,
        title=discussion.title,
        content=discussion.content,
        author=build_social_user(current_user, following_ids, follower_ids),
        problem_id=discussion.problem_id,
        library_item_id=discussion.library_item_id,
        is_resolved=discussion.is_resolved,
        is_pinned=discussion.is_pinned,
        comment_count=0,
        created_at=discussion.created_at,
        updated_at=discussion.updated_at,
    )


@router.get("/discussions/{discussion_id}", response_model=DiscussionResponse)
async def get_discussion(
    discussion_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific discussion."""
    result = await db.execute(
        select(Discussion).options(selectinload(Discussion.author)).where(Discussion.id == discussion_id)
    )
    discussion = result.scalar_one_or_none()
    if not discussion:
        raise HTTPException(status_code=404, detail="Discussion not found")
    
    following_ids, follower_ids = await get_follow_sets(db, current_user.id)
    
    comment_count_result = await db.execute(
        select(Comment).where(Comment.discussion_id == discussion.id)
    )
    comment_count = len(comment_count_result.scalars().all())
    
    return DiscussionResponse(
        id=discussion.id,
        title=discussion.title,
        content=discussion.content,
        author=build_social_user(discussion.author, following_ids, follower_ids),
        problem_id=discussion.problem_id,
        library_item_id=discussion.library_item_id,
        is_resolved=discussion.is_resolved,
        is_pinned=discussion.is_pinned,
        comment_count=comment_count,
        created_at=discussion.created_at,
        updated_at=discussion.updated_at,
    )


@router.patch("/discussions/{discussion_id}", response_model=DiscussionResponse)
async def update_discussion(
    discussion_id: UUID,
    data: DiscussionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a discussion (author only)."""
    result = await db.execute(
        select(Discussion).options(selectinload(Discussion.author)).where(Discussion.id == discussion_id)
    )
    discussion = result.scalar_one_or_none()
    if not discussion:
        raise HTTPException(status_code=404, detail="Discussion not found")
    
    if discussion.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this discussion")
    
    if data.title is not None:
        discussion.title = data.title
    if data.content is not None:
        discussion.content = data.content
    if data.is_resolved is not None:
        discussion.is_resolved = data.is_resolved
    if data.is_pinned is not None:
        discussion.is_pinned = data.is_pinned
    
    await db.commit()
    await db.refresh(discussion)
    
    following_ids, follower_ids = await get_follow_sets(db, current_user.id)
    
    comment_count_result = await db.execute(
        select(Comment).where(Comment.discussion_id == discussion.id)
    )
    comment_count = len(comment_count_result.scalars().all())
    
    return DiscussionResponse(
        id=discussion.id,
        title=discussion.title,
        content=discussion.content,
        author=build_social_user(discussion.author, following_ids, follower_ids),
        problem_id=discussion.problem_id,
        library_item_id=discussion.library_item_id,
        is_resolved=discussion.is_resolved,
        is_pinned=discussion.is_pinned,
        comment_count=comment_count,
        created_at=discussion.created_at,
        updated_at=discussion.updated_at,
    )


@router.delete("/discussions/{discussion_id}")
async def delete_discussion(
    discussion_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a discussion (author only)."""
    result = await db.execute(
        select(Discussion).where(Discussion.id == discussion_id)
    )
    discussion = result.scalar_one_or_none()
    if not discussion:
        raise HTTPException(status_code=404, detail="Discussion not found")
    
    if discussion.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this discussion")
    
    # Delete comments first
    await db.execute(
        select(Comment).where(Comment.discussion_id == discussion_id)
    )
    comments = (await db.execute(select(Comment).where(Comment.discussion_id == discussion_id))).scalars().all()
    for comment in comments:
        await db.delete(comment)
    
    await db.delete(discussion)
    await db.commit()
    
    return {"status": "deleted"}


# ========================
# Comment Endpoints
# ========================

@router.get("/discussions/{discussion_id}/comments", response_model=CommentListResponse)
async def list_comments(
    discussion_id: UUID,
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List comments for a discussion."""
    result = await db.execute(
        select(Comment).options(selectinload(Comment.author))
        .where(Comment.discussion_id == discussion_id)
        .order_by(Comment.created_at.asc())
        .limit(limit)
    )
    comments = result.scalars().all()
    
    following_ids, follower_ids = await get_follow_sets(db, current_user.id)
    
    payload = []
    for c in comments:
        # Count replies
        reply_count_result = await db.execute(
            select(Comment).where(Comment.parent_id == c.id)
        )
        reply_count = len(reply_count_result.scalars().all())
        
        payload.append(CommentResponse(
            id=c.id,
            content=c.content,
            author=build_social_user(c.author, following_ids, follower_ids),
            discussion_id=c.discussion_id,
            parent_id=c.parent_id,
            reply_count=reply_count,
            created_at=c.created_at,
            updated_at=c.updated_at,
        ))
    
    return CommentListResponse(comments=payload, total=len(payload))


@router.post("/discussions/{discussion_id}/comments", response_model=CommentResponse)
async def create_comment(
    discussion_id: UUID,
    data: CommentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a comment on a discussion."""
    # Verify discussion exists
    discussion_result = await db.execute(select(Discussion).where(Discussion.id == discussion_id))
    discussion = discussion_result.scalar_one_or_none()
    if not discussion:
        raise HTTPException(status_code=404, detail="Discussion not found")
    
    comment = Comment(
        content=data.content,
        author_id=current_user.id,
        discussion_id=discussion_id,
        parent_id=data.parent_id,
    )
    db.add(comment)
    await db.flush()
    
    # Create notification for discussion author (if not self)
    if discussion.author_id != current_user.id:
        notification = Notification(
            user_id=discussion.author_id,
            type=NotificationType.NEW_COMMENT,
            title=f"New comment on your discussion",
            content=data.content[:100],
            actor_id=current_user.id,
            target_type="discussion",
            target_id=discussion_id,
        )
        db.add(notification)

    if has_rho_mention(data.content):
        rho_user = await get_or_create_rho_user(db)
        thread_context = await build_rho_thread_context(
            db=db,
            discussion=discussion,
            trigger_comment=comment,
        )
        rho_reply = await generate_rho_reply(
            discussion=discussion,
            question=data.content,
            thread_context=thread_context,
        )
        db.add(
            Comment(
                content=rho_reply,
                author_id=rho_user.id,
                discussion_id=discussion_id,
                parent_id=comment.id,
            )
        )
    
    await db.commit()
    await db.refresh(comment)
    
    following_ids, follower_ids = await get_follow_sets(db, current_user.id)
    
    return CommentResponse(
        id=comment.id,
        content=comment.content,
        author=build_social_user(current_user, following_ids, follower_ids),
        discussion_id=comment.discussion_id,
        parent_id=comment.parent_id,
        reply_count=0,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
    )


# ========================
# Star Endpoints
# ========================

@router.post("/stars", response_model=StarResponse)
async def create_star(
    data: StarCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Star a problem, library item, or discussion."""
    target_type_enum = StarTargetType(data.target_type)
    
    # Check if already starred
    existing = await db.execute(
        select(Star).where(
            Star.user_id == current_user.id,
            Star.target_type == target_type_enum,
            Star.target_id == data.target_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already starred")
    
    star = Star(
        user_id=current_user.id,
        target_type=target_type_enum,
        target_id=data.target_id,
    )
    db.add(star)
    await db.commit()
    await db.refresh(star)
    
    return StarResponse(
        id=star.id,
        user_id=star.user_id,
        target_type=star.target_type.value,
        target_id=star.target_id,
        created_at=star.created_at,
    )


@router.delete("/stars/{target_type}/{target_id}")
async def remove_star(
    target_type: str,
    target_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a star from a problem, library item, or discussion."""
    target_type_enum = StarTargetType(target_type)
    
    result = await db.execute(
        select(Star).where(
            Star.user_id == current_user.id,
            Star.target_type == target_type_enum,
            Star.target_id == target_id,
        )
    )
    star = result.scalar_one_or_none()
    if not star:
        return {"status": "not_starred"}
    
    await db.delete(star)
    await db.commit()
    return {"status": "unstarred"}


@router.get("/stars", response_model=StarListResponse)
async def list_my_stars(
    target_type: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List user's stars."""
    query = select(Star).where(Star.user_id == current_user.id)
    
    if target_type:
        query = query.where(Star.target_type == StarTargetType(target_type))
    
    query = query.order_by(Star.created_at.desc()).limit(limit)
    result = await db.execute(query)
    stars = result.scalars().all()
    
    payload = [
        StarResponse(
            id=s.id,
            user_id=s.user_id,
            target_type=s.target_type.value,
            target_id=s.target_id,
            created_at=s.created_at,
        )
        for s in stars
    ]
    
    return StarListResponse(stars=payload, total=len(payload))


@router.get("/stars/check/{target_type}/{target_id}")
async def check_is_starred(
    target_type: str,
    target_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Check if the current user has starred a specific item."""
    target_type_enum = StarTargetType(target_type)
    
    result = await db.execute(
        select(Star.id).where(
            Star.user_id == current_user.id,
            Star.target_type == target_type_enum,
            Star.target_id == target_id,
        )
    )
    exists = result.scalar_one_or_none() is not None
    
    return {"is_starred": exists}


# ========================
# Notification Endpoints
# ========================

@router.get("/notifications", response_model=NotificationListResponse)
async def list_notifications(
    unread_only: bool = False,
    limit: int = Query(default=30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List user's notifications."""
    query = select(Notification).options(selectinload(Notification.actor)).where(
        Notification.user_id == current_user.id
    )
    
    if unread_only:
        query = query.where(Notification.is_read == False)
    
    query = query.order_by(Notification.created_at.desc()).limit(limit)
    result = await db.execute(query)
    notifications = result.scalars().all()
    
    # Count unread
    unread_result = await db.execute(
        select(Notification).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
        )
    )
    unread_count = len(unread_result.scalars().all())
    
    following_ids, follower_ids = await get_follow_sets(db, current_user.id)
    
    payload = []
    for n in notifications:
        actor_user = None
        if n.actor:
            actor_user = build_social_user(n.actor, following_ids, follower_ids)
        
        payload.append(NotificationResponse(
            id=n.id,
            type=n.type.value,
            title=n.title,
            content=n.content,
            actor=actor_user,
            target_type=n.target_type,
            target_id=n.target_id,
            extra_data=n.extra_data,
            is_read=n.is_read,
            created_at=n.created_at,
        ))
    
    return NotificationListResponse(
        notifications=payload,
        total=len(payload),
        unread_count=unread_count,
    )


@router.post("/notifications/read")
async def mark_notifications_read(
    data: NotificationMarkRead,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark notifications as read."""
    result = await db.execute(
        select(Notification).where(
            Notification.user_id == current_user.id,
            Notification.id.in_(data.notification_ids),
        )
    )
    notifications = result.scalars().all()
    
    for n in notifications:
        n.is_read = True
    
    await db.commit()
    return {"status": "marked_read", "count": len(notifications)}


@router.post("/notifications/read-all")
async def mark_all_notifications_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark all notifications as read."""
    result = await db.execute(
        select(Notification).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
        )
    )
    notifications = result.scalars().all()
    
    for n in notifications:
        n.is_read = True
    
    await db.commit()
    return {"status": "all_marked_read", "count": len(notifications)}


# ========================
# Team Endpoints
# ========================

@router.get("/teams", response_model=TeamListResponse)
async def list_teams(
    my_teams: bool = False,
    limit: int = Query(default=30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List teams."""
    if my_teams:
        query = (
            select(Team)
            .join(TeamMember, TeamMember.team_id == Team.id)
            .where(TeamMember.user_id == current_user.id)
        )
    else:
        query = select(Team).where(Team.is_public == True)
    
    query = query.order_by(Team.created_at.desc()).limit(limit)
    result = await db.execute(query)
    teams = result.scalars().all()
    
    payload = []
    for t in teams:
        # Count members and problems
        member_count_result = await db.execute(
            select(TeamMember).where(TeamMember.team_id == t.id)
        )
        member_count = len(member_count_result.scalars().all())
        
        problem_count_result = await db.execute(
            select(TeamProblem).where(TeamProblem.team_id == t.id)
        )
        problem_count = len(problem_count_result.scalars().all())
        
        payload.append(TeamResponse(
            id=t.id,
            name=t.name,
            slug=t.slug,
            description=t.description,
            is_public=t.is_public,
            avatar_url=t.avatar_url,
            member_count=member_count,
            problem_count=problem_count,
            created_at=t.created_at,
            updated_at=t.updated_at,
        ))
    
    return TeamListResponse(teams=payload, total=len(payload))


@router.post("/teams", response_model=TeamResponse)
async def create_team(
    data: TeamCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new team."""
    # Check slug uniqueness
    existing = await db.execute(select(Team).where(Team.slug == data.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Team slug already exists")
    
    team = Team(
        name=data.name,
        slug=data.slug,
        description=data.description,
        is_public=data.is_public,
    )
    db.add(team)
    await db.flush()
    
    # Add creator as owner
    member = TeamMember(
        team_id=team.id,
        user_id=current_user.id,
        role=TeamRole.OWNER,
    )
    db.add(member)
    await db.commit()
    await db.refresh(team)
    
    return TeamResponse(
        id=team.id,
        name=team.name,
        slug=team.slug,
        description=team.description,
        is_public=team.is_public,
        avatar_url=team.avatar_url,
        member_count=1,
        problem_count=0,
        created_at=team.created_at,
        updated_at=team.updated_at,
    )


@router.get("/teams/{slug}", response_model=TeamDetailResponse)
async def get_team(
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get team details."""
    result = await db.execute(
        select(Team).where(Team.slug == slug)
    )
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Get members
    members_result = await db.execute(
        select(TeamMember).options(selectinload(TeamMember.user))
        .where(TeamMember.team_id == team.id)
    )
    members = members_result.scalars().all()
    
    following_ids, follower_ids = await get_follow_sets(db, current_user.id)
    
    member_payload = [
        TeamMemberResponse(
            id=m.id,
            user=build_social_user(m.user, following_ids, follower_ids),
            role=m.role.value,
            joined_at=m.joined_at,
        )
        for m in members
    ]
    
    # Count problems
    problem_count_result = await db.execute(
        select(TeamProblem).where(TeamProblem.team_id == team.id)
    )
    problem_count = len(problem_count_result.scalars().all())
    
    return TeamDetailResponse(
        id=team.id,
        name=team.name,
        slug=team.slug,
        description=team.description,
        is_public=team.is_public,
        avatar_url=team.avatar_url,
        member_count=len(members),
        problem_count=problem_count,
        members=member_payload,
        created_at=team.created_at,
        updated_at=team.updated_at,
    )


@router.post("/teams/{slug}/members")
async def invite_team_member(
    slug: str,
    data: TeamInvite,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Invite a user to a team (admin/owner only).

    Previous behavior auto-added the invitee as member. Now we only create a pending invitation
    and emit a feed/notification entry; the invitee must accept explicitly.
    """
    team_result = await db.execute(select(Team).where(Team.slug == slug))
    team = team_result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Check if current user is admin/owner
    member_result = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team.id,
            TeamMember.user_id == current_user.id,
        )
    )
    current_member = member_result.scalar_one_or_none()
    if not current_member or current_member.role not in [TeamRole.OWNER, TeamRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized to invite members")
    
    # Block duplicate membership or pending invite
    existing_member = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team.id,
            TeamMember.user_id == data.user_id,
        )
    )
    if existing_member.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User already a member")

    existing_invite = await db.execute(
        select(Notification).where(
            Notification.user_id == data.user_id,
            Notification.type == NotificationType.TEAM_INVITE,
            Notification.target_id == team.id,
            Notification.is_read == False,
        )
    )
    if existing_invite.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Invitation already pending")
    
    # Create notification for invited user
    notification = Notification(
        user_id=data.user_id,
        type=NotificationType.TEAM_INVITE,
        title=f"You've been invited to join {team.name}",
        actor_id=current_user.id,
        target_type="team",
        target_id=team.id,
        extra_data={"role": data.role or "member", "team_slug": team.slug},
    )
    db.add(notification)
    await db.flush()  # ensure notification.id available

    # Emit activity for feeds (target = invitee). Feed renderer will show as pending invite.
    db.add(
        Activity(
            user_id=current_user.id,
            type=ActivityType.TEAM_INVITE,
            target_id=data.user_id,
            extra_data={
                "team_id": str(team.id),
                "team_name": team.name,
                "team_slug": team.slug,
                "invitee_id": str(data.user_id),
                "role": data.role or "member",
                "notification_id": str(notification.id),
            },
        )
    )

    await db.commit()
    return {"status": "invited", "notification_id": notification.id}


@router.post("/teams/{slug}/invites/{notification_id}/accept")
async def accept_team_invite(
    slug: str,
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Accept a pending team invitation and join the team."""
    team_result = await db.execute(select(Team).where(Team.slug == slug))
    team = team_result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    notif_result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
            Notification.type == NotificationType.TEAM_INVITE,
            Notification.target_id == team.id,
            Notification.is_read == False,
        )
    )
    notification = notif_result.scalar_one_or_none()
    if not notification:
        raise HTTPException(status_code=404, detail="Invitation not found or already handled")

    # Ensure not already member
    existing_member = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team.id,
            TeamMember.user_id == current_user.id,
        )
    )
    if existing_member.scalar_one_or_none():
        notification.is_read = True
        await db.commit()
        return {"status": "already_member"}

    role = TeamRole.ADMIN if (notification.extra_data or {}).get("role") == "admin" else TeamRole.MEMBER
    new_member = TeamMember(team_id=team.id, user_id=current_user.id, role=role)
    db.add(new_member)

    notification.is_read = True

    # Activity for acceptance
    db.add(
        Activity(
            user_id=current_user.id,
            type=ActivityType.TEAM_JOIN,
            target_id=team.id,
            extra_data={
                "team_id": str(team.id),
                "team_name": team.name,
                "team_slug": team.slug,
                "role": role.value,
            },
        )
    )

    await db.commit()
    return {"status": "accepted", "role": role.value}


@router.post("/teams/{slug}/invites/{notification_id}/decline")
async def decline_team_invite(
    slug: str,
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Decline a pending team invitation."""
    team_result = await db.execute(select(Team).where(Team.slug == slug))
    team = team_result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    notif_result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
            Notification.type == NotificationType.TEAM_INVITE,
            Notification.target_id == team.id,
            Notification.is_read == False,
        )
    )
    notification = notif_result.scalar_one_or_none()
    if not notification:
        raise HTTPException(status_code=404, detail="Invitation not found or already handled")

    notification.is_read = True
    await db.commit()
    return {"status": "declined"}


@router.post("/teams/{slug}/problems")
async def add_team_problem(
    slug: str,
    data: TeamAddProblem,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a problem to a team."""
    team_result = await db.execute(select(Team).where(Team.slug == slug))
    team = team_result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Check if current user is a member
    member_result = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team.id,
            TeamMember.user_id == current_user.id,
        )
    )
    if not member_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a team member")
    
    # Check if problem already added
    existing = await db.execute(
        select(TeamProblem).where(
            TeamProblem.team_id == team.id,
            TeamProblem.problem_id == data.problem_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Problem already in team")
    
    team_problem = TeamProblem(
        team_id=team.id,
        problem_id=data.problem_id,
        added_by_id=current_user.id,
    )
    db.add(team_problem)
    await db.commit()
    return {"status": "added"}


@router.patch("/teams/{slug}", response_model=TeamResponse)
async def update_team(
    slug: str,
    data: TeamUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update team settings (admin/owner only)."""
    team_result = await db.execute(select(Team).where(Team.slug == slug))
    team = team_result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Check if current user is admin/owner
    member_result = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team.id,
            TeamMember.user_id == current_user.id,
        )
    )
    current_member = member_result.scalar_one_or_none()
    if not current_member or current_member.role not in [TeamRole.OWNER, TeamRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized to update team")
    
    if data.name is not None:
        team.name = data.name
    if data.description is not None:
        team.description = data.description
    if data.is_public is not None:
        team.is_public = data.is_public
    if data.avatar_url is not None:
        team.avatar_url = data.avatar_url
    
    await db.commit()
    await db.refresh(team)
    
    # Count members and problems
    member_count_result = await db.execute(
        select(TeamMember).where(TeamMember.team_id == team.id)
    )
    member_count = len(member_count_result.scalars().all())
    
    problem_count_result = await db.execute(
        select(TeamProblem).where(TeamProblem.team_id == team.id)
    )
    problem_count = len(problem_count_result.scalars().all())
    
    return TeamResponse(
        id=team.id,
        name=team.name,
        slug=team.slug,
        description=team.description,
        is_public=team.is_public,
        avatar_url=team.avatar_url,
        member_count=member_count,
        problem_count=problem_count,
        created_at=team.created_at,
        updated_at=team.updated_at,
    )


@router.delete("/teams/{slug}")
async def delete_team(
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a team (owner only)."""
    team_result = await db.execute(select(Team).where(Team.slug == slug))
    team = team_result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Check if current user is owner
    member_result = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team.id,
            TeamMember.user_id == current_user.id,
        )
    )
    current_member = member_result.scalar_one_or_none()
    if not current_member or current_member.role != TeamRole.OWNER:
        raise HTTPException(status_code=403, detail="Only the owner can delete the team")
    
    # Delete all team members
    members_result = await db.execute(select(TeamMember).where(TeamMember.team_id == team.id))
    for member in members_result.scalars().all():
        await db.delete(member)
    
    # Delete all team problems
    problems_result = await db.execute(select(TeamProblem).where(TeamProblem.team_id == team.id))
    for problem in problems_result.scalars().all():
        await db.delete(problem)
    
    await db.delete(team)
    await db.commit()
    
    return {"status": "deleted"}


@router.delete("/teams/{slug}/members/{user_id}")
async def remove_team_member(
    slug: str,
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a member from a team (admin/owner only)."""
    team_result = await db.execute(select(Team).where(Team.slug == slug))
    team = team_result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Check if current user is admin/owner
    current_member_result = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team.id,
            TeamMember.user_id == current_user.id,
        )
    )
    current_member = current_member_result.scalar_one_or_none()
    if not current_member or current_member.role not in [TeamRole.OWNER, TeamRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized to remove members")
    
    # Find the member to remove
    target_member_result = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team.id,
            TeamMember.user_id == user_id,
        )
    )
    target_member = target_member_result.scalar_one_or_none()
    if not target_member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    # Can't remove owner
    if target_member.role == TeamRole.OWNER:
        raise HTTPException(status_code=400, detail="Cannot remove the team owner")
    
    await db.delete(target_member)
    await db.commit()
    
    return {"status": "removed"}


@router.post("/teams/{slug}/leave")
async def leave_team(
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Leave a team."""
    team_result = await db.execute(select(Team).where(Team.slug == slug))
    team = team_result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Find current user's membership
    member_result = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team.id,
            TeamMember.user_id == current_user.id,
        )
    )
    member = member_result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=400, detail="Not a team member")
    
    # Owner can't leave
    if member.role == TeamRole.OWNER:
        raise HTTPException(status_code=400, detail="Owner cannot leave the team. Transfer ownership or delete the team.")
    
    await db.delete(member)
    await db.commit()
    
    return {"status": "left"}


@router.delete("/teams/{slug}/problems/{problem_id}")
async def remove_team_problem(
    slug: str,
    problem_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a problem from a team (member who added or admin/owner)."""
    team_result = await db.execute(select(Team).where(Team.slug == slug))
    team = team_result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Check if current user is a member
    member_result = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team.id,
            TeamMember.user_id == current_user.id,
        )
    )
    current_member = member_result.scalar_one_or_none()
    if not current_member:
        raise HTTPException(status_code=403, detail="Not a team member")
    
    # Find the team problem
    team_problem_result = await db.execute(
        select(TeamProblem).where(
            TeamProblem.team_id == team.id,
            TeamProblem.problem_id == problem_id,
        )
    )
    team_problem = team_problem_result.scalar_one_or_none()
    if not team_problem:
        raise HTTPException(status_code=404, detail="Problem not in team")
    
    # Check authorization (added by user or admin/owner)
    is_admin = current_member.role in [TeamRole.OWNER, TeamRole.ADMIN]
    is_adder = team_problem.added_by_id == current_user.id
    if not (is_admin or is_adder):
        raise HTTPException(status_code=403, detail="Not authorized to remove this problem")
    
    await db.delete(team_problem)
    await db.commit()
    
    return {"status": "removed"}


# ========================
# Trending & Stats
# ========================

from app.schemas.social import TrendingProblem, TrendingResponse, PlatformStats


@router.get("/trending", response_model=TrendingResponse)
async def get_trending_problems(
    limit: int = Query(default=10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Get trending problems based on recent activity and library items."""
    from datetime import timedelta
    
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    
    # Get problems with their authors
    problems_query = (
        select(Problem)
        .options(selectinload(Problem.author))
        .where(Problem.visibility == ProblemVisibility.PUBLIC)
    )
    result = await db.execute(problems_query)
    problems = result.scalars().all()
    
    problem_scores = []
    for problem in problems:
        # Stars table doesn't exist yet - skip star counting
        star_count = 0
        
        # Count recent activity
        activity_result = await db.execute(
            select(func.count(Activity.id)).where(
                Activity.target_id == problem.id,
                Activity.created_at >= seven_days_ago,
            )
        )
        recent_activity = activity_result.scalar() or 0
        
        # Count library items
        lib_result = await db.execute(
            select(func.count(LibraryItem.id)).where(
                LibraryItem.problem_id == problem.id,
            )
        )
        lib_count = lib_result.scalar() or 0
        
        # Calculate score: recent_activity * 5 + library_items
        score = recent_activity * 5 + lib_count
        
        # Trend label
        trend_label = None
        if recent_activity >= 5:
            trend_label = "Hot"
        elif recent_activity >= 3:
            trend_label = f"+{recent_activity * 10}%"
        elif lib_count >= 3:
            trend_label = "Active"
        
        problem_scores.append({
            "problem": problem,
            "star_count": star_count,
            "score": score,
            "recent_activity": recent_activity,
            "trend_label": trend_label,
        })
    
    # Sort by score
    problem_scores.sort(key=lambda x: x["score"], reverse=True)
    top_problems = problem_scores[:limit]
    
    trending = []
    for item in top_problems:
        p = item["problem"]
        trending.append(TrendingProblem(
            id=p.id,
            title=p.title,
            description=p.description,
            author=SocialUser(
                id=p.author.id,
                username=p.author.username,
                avatar_url=p.author.avatar_url,
                bio=p.author.bio,
            ),
            tags=p.tags or [],
            star_count=item["star_count"],
            activity_score=item["score"],
            recent_activity_count=item["recent_activity"],
            trend_label=item["trend_label"],
        ))
    
    return TrendingResponse(problems=trending, total=len(trending))


@router.get("/stats", response_model=PlatformStats)
async def get_platform_stats(
    db: AsyncSession = Depends(get_db),
):
    """Get overall platform statistics."""
    from datetime import timedelta
    
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Total users
    users_result = await db.execute(select(func.count(User.id)))
    total_users = users_result.scalar() or 0
    
    # Total public problems
    problems_result = await db.execute(
        select(func.count(Problem.id)).where(
            Problem.visibility == ProblemVisibility.PUBLIC
        )
    )
    total_problems = problems_result.scalar() or 0
    
    # Total verified library items
    from app.models.library_item import LibraryItemStatus
    verified_result = await db.execute(
        select(func.count(LibraryItem.id)).where(
            LibraryItem.status == LibraryItemStatus.VERIFIED
        )
    )
    total_verified = verified_result.scalar() or 0
    
    # Total discussions - skip if table doesn't exist
    total_discussions = 0
    
    # Active users today (users with activity today)
    active_result = await db.execute(
        select(func.count(func.distinct(Activity.user_id))).where(
            Activity.created_at >= today
        )
    )
    active_today = active_result.scalar() or 0
    
    return PlatformStats(
        total_users=total_users,
        total_problems=total_problems,
        total_verified_items=total_verified,
        total_discussions=total_discussions,
        active_users_today=active_today,
    )
