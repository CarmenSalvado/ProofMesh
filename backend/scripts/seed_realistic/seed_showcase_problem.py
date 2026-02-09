"""
Seed a curated, highly-trending showcase problem for demos/videos.

Goals:
- Public problem with high star_count and rich library items + canvas blocks.
- Idempotent: safe to run multiple times.
- Adjust Problem.updated_at so it appears 2nd in /catalog (sorted by updated_at desc).
"""

from __future__ import annotations

import asyncio
import random
from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import select, func, text

from app.database import async_session_maker
from app.models.user import User
from app.models.problem import Problem, ProblemVisibility, ProblemDifficulty
from app.models.library_item import (
    LibraryItem,
    LibraryItemKind,
    LibraryItemStatus,
)
from app.models.canvas_block import CanvasBlock
from app.models.star import Star, StarTargetType
from app.services.auth import get_password_hash


SHOWCASE_AUTHOR_USERNAME = "amara"
SHOWCASE_AUTHOR_EMAIL = "amara@proofmesh.org"

SHOWCASE_TITLE = "Johnson-Lindenstrauss in the Wild: Subgaussian Projections, Tight Bounds, and a Clean Proof Skeleton"
# Keep a stable UUID so links don't break after reseeds.
SHOWCASE_PROBLEM_ID = UUID("f2a2afa2-cfac-492f-a0df-c360ad094495")
SHOWCASE_TAGS = [
    "probability",
    "high-dimensional-geometry",
    "concentration",
    "random-projections",
    "jl-lemma",
]

SHOWCASE_DESCRIPTION = (
    "You are given a set of n points in R^d. Show that with high probability, a random linear map "
    "f: R^d -> R^k preserves all pairwise distances up to (1±ε) provided k = O(ε^-2 log n).\n\n"
    "This is the Johnson–Lindenstrauss lemma, but the goal here is a *production-quality* argument:\n"
    "1) write a proof skeleton that is concise and modular,\n"
    "2) track constants cleanly enough to implement parameter selection,\n"
    "3) extend from Gaussian to sparse/sign projections,\n"
    "4) include the matching lower bound idea (why k must be Ω(ε^-2 log n)).\n\n"
    "Challenging because it mixes concentration + union bounds + nets + careful bookkeeping, "
    "and forces you to keep constants under control."
)


def _now() -> datetime:
    return datetime.utcnow().replace(microsecond=0)


async def ensure_user(db, *, username: str, email: str, bio: str) -> User:
    result = await db.execute(select(User).where(func.lower(User.username) == username.lower()))
    user = result.scalar_one_or_none()
    if user:
        updated = False
        if user.email != email:
            user.email = email
            updated = True
        if (user.bio or "") != (bio or ""):
            user.bio = bio
            updated = True
        if updated:
            await db.flush()
        return user

    # Create a deterministic-ish password hash (not used in demo flows anyway).
    user = User(
        email=email,
        username=username,
        password_hash=get_password_hash(f"seed-{username}-{_now().isoformat()}"),
        bio=bio,
    )
    db.add(user)
    await db.flush()
    return user


def showcase_items() -> list[dict]:
    """
    Returns a curated set of library items with stable titles.

    Dependencies reference titles (resolved to UUIDs after insert).
    """
    return [
        {
            "title": "Definition: (1±ε)-distance preservation",
            "kind": LibraryItemKind.DEFINITION,
            "status": LibraryItemStatus.VERIFIED,
            "content": (
                "A map f: R^d -> R^k is a **(1±ε) embedding** for a finite set S ⊂ R^d if for all x,y ∈ S:\n"
                "\n"
                "  (1-ε)||x-y||_2 ≤ ||f(x)-f(y)||_2 ≤ (1+ε)||x-y||_2.\n"
                "\n"
                "Equivalently, it preserves squared norms of all difference vectors v = x-y."
            ),
            "formula": r"(1-\varepsilon)\|x-y\|_2 \le \|f(x)-f(y)\|_2 \le (1+\varepsilon)\|x-y\|_2",
            "deps": [],
        },
        {
            "title": "Setup: Random projection model",
            "kind": LibraryItemKind.CONTENT,
            "status": LibraryItemStatus.VERIFIED,
            "content": (
                "Let A ∈ R^{k×d} be a random matrix with i.i.d. entries (Gaussian or Rademacher), and define\n"
                "  f(x) = (1/√k) A x.\n"
                "\n"
                "Goal: prove concentration of ||f(v)||_2^2 around ||v||_2^2 for any fixed v, then union bound over pairs."
            ),
            "formula": r"f(x)=\frac{1}{\sqrt{k}}Ax",
            "deps": ["Definition: (1±ε)-distance preservation"],
        },
        {
            "title": "Lemma: Chi-square concentration (Gaussian case)",
            "kind": LibraryItemKind.LEMMA,
            "status": LibraryItemStatus.VERIFIED,
            "content": (
                "If g ∼ N(0, I_k), then ||g||_2^2 is χ²(k). For 0<ε<1:\n"
                "\n"
                "  P[ | ||g||_2^2 - k | ≥ εk ] ≤ 2 exp( -c ε^2 k ).\n"
                "\n"
                "This is the one-line engine behind JL for Gaussian projections."
            ),
            "formula": r"\Pr\left[\left|\|g\|_2^2-k\right|\ge \varepsilon k\right]\le 2e^{-c\varepsilon^2 k}",
            "deps": ["Setup: Random projection model"],
        },
        {
            "title": "Lemma: Fixed-vector norm preservation",
            "kind": LibraryItemKind.LEMMA,
            "status": LibraryItemStatus.VERIFIED,
            "content": (
                "For a fixed v ≠ 0, in the Gaussian model f(v) has distribution ||v||_2 · (g/√k).\n"
                "Therefore, using χ² concentration:\n"
                "\n"
                "  P[ | ||f(v)||_2^2 - ||v||_2^2 | ≥ ε||v||_2^2 ] ≤ 2 exp(-c ε^2 k)."
            ),
            "formula": r"\Pr\left[\left|\|f(v)\|_2^2-\|v\|_2^2\right|\ge \varepsilon\|v\|_2^2\right]\le 2e^{-c\varepsilon^2 k}",
            "deps": ["Lemma: Chi-square concentration (Gaussian case)"],
        },
        {
            "title": "Theorem: Johnson–Lindenstrauss (Gaussian proof)",
            "kind": LibraryItemKind.THEOREM,
            "status": LibraryItemStatus.VERIFIED,
            "content": (
                "Let S be a set of n points in R^d and 0<ε<1/2.\n"
                "If k ≥ C ε^{-2} log n, then with probability ≥ 1-1/n, the random map f(x)=(1/√k)Ax is a (1±ε) embedding on S.\n"
                "\n"
                "Proof: apply fixed-vector concentration to all v = x-y (≤ n^2 vectors) and union bound."
            ),
            "formula": r"k \ge C\varepsilon^{-2}\log n \implies \text{JL holds w.h.p.}",
            "deps": ["Lemma: Fixed-vector norm preservation"],
        },
        {
            "title": "Note: Constant tracking that actually compiles",
            "kind": LibraryItemKind.NOTE,
            "status": LibraryItemStatus.PROPOSED,
            "content": (
                "A usable engineering bound (typical in libraries):\n"
                "  k >= 8 * ln(n/δ) / (ε^2/2 - ε^3/3)\n"
                "is sufficient for Gaussian JL (see standard derivations).\n"
                "\n"
                "For demos: set δ = 0.01 and pick ε = 0.15."
            ),
            "formula": r"k \ge \frac{8\ln(n/\delta)}{\varepsilon^2/2-\varepsilon^3/3}",
            "deps": ["Theorem: Johnson–Lindenstrauss (Gaussian proof)"],
        },
        {
            "title": "Lemma: Subgaussian tail bound for sign projections",
            "kind": LibraryItemKind.LEMMA,
            "status": LibraryItemStatus.PROPOSED,
            "content": (
                "If rows of A are independent Rademacher vectors, then ⟨a_i, v⟩ is subgaussian with variance proxy ||v||_2^2.\n"
                "One can use Bernstein/Hanson–Wright to show concentration of ||Av||_2^2 around k||v||_2^2.\n"
                "\n"
                "Takeaway: the Gaussian proof structure survives; only the fixed-vector concentration lemma changes."
            ),
            "formula": r"\langle a_i,v\rangle \text{ subgaussian } \Rightarrow \|Av\|_2^2 \text{ concentrates}",
            "deps": ["Setup: Random projection model"],
        },
        {
            "title": "Theorem: Sparse JL (Achlioptas-style)",
            "kind": LibraryItemKind.THEOREM,
            "status": LibraryItemStatus.PROPOSED,
            "content": (
                "Using sparse/sign matrices (with appropriate scaling), JL still holds with similar k up to constants.\n"
                "This is crucial for fast inference pipelines.\n"
                "\n"
                "Sketch: combine Hanson–Wright for fixed v with the same union bound over pairs."
            ),
            "formula": r"k = O(\varepsilon^{-2}\log n)\ \text{(sparse/sign)}",
            "deps": ["Lemma: Subgaussian tail bound for sign projections"],
        },
        {
            "title": "Lower bound idea: Why k must be Ω(ε^-2 log n)",
            "kind": LibraryItemKind.CLAIM,
            "status": LibraryItemStatus.PROPOSED,
            "content": (
                "There exist sets S of size n in R^d such that any (1±ε) embedding into R^k needs\n"
                "  k ≥ c ε^{-2} log n.\n"
                "\n"
                "Idea: packing argument on the Hamming cube / volume bounds for almost-orthogonal vectors."
            ),
            "formula": r"k \ge c\varepsilon^{-2}\log n",
            "deps": ["Definition: (1±ε)-distance preservation"],
        },
        {
            "title": "Computation: Quick simulation script (pseudo-code)",
            "kind": LibraryItemKind.COMPUTATION,
            "status": LibraryItemStatus.PROPOSED,
            "content": (
                "Pseudo-code:\n"
                "\n"
                "  input: points X (n×d), eps\n"
                "  k = ceil(C * log(n) / eps^2)\n"
                "  A = randn(k,d)\n"
                "  Y = (1/sqrt(k)) * A @ X^T\n"
                "  check all pairwise distances\n"
                "\n"
                "Nice demo: show distortion histogram before/after."
            ),
            "formula": None,
            "deps": ["Theorem: Johnson–Lindenstrauss (Gaussian proof)"],
        },
        {
            "title": "Resource: References and reading list",
            "kind": LibraryItemKind.RESOURCE,
            "status": LibraryItemStatus.VERIFIED,
            "content": (
                "1) Johnson & Lindenstrauss (1984)\n"
                "2) Dasgupta & Gupta (1999): elementary proof + constants\n"
                "3) Vempala: Random Projection in ML\n"
                "4) Vershynin: High-Dimensional Probability (concentration toolkit)\n"
                "5) Achlioptas (2003): database-friendly random projections"
            ),
            "formula": None,
            # Keep the graph connected: references relate to the main theorem.
            "deps": ["Theorem: Johnson–Lindenstrauss (Gaussian proof)"],
        },
        {
            "title": "Proof skeleton: Minimal steps you can delegate to an LLM",
            "kind": LibraryItemKind.NOTE,
            "status": LibraryItemStatus.VERIFIED,
            "content": (
                "Checklist:\n"
                "1) Reduce to preserving norms of a finite set V of difference vectors.\n"
                "2) Prove fixed-vector concentration: P[| ||f(v)||^2-||v||^2 | > ε||v||^2] ≤ 2e^{-cε^2k}.\n"
                "3) Union bound over |V| ≤ n(n-1)/2.\n"
                "4) Choose k ≥ C ε^{-2} log(n/δ) to get failure prob ≤ δ.\n"
                "5) Optional: swap Gaussian -> sign projection by replacing step (2).\n"
                "\n"
                "Everything else is presentation."
            ),
            "formula": None,
            "deps": ["Lemma: Fixed-vector norm preservation", "Theorem: Sparse JL (Achlioptas-style)"],
        },
    ]


def _layout_positions(n: int) -> list[tuple[float, float]]:
    # A readable but slightly messy canvas layout. Keep it deterministic so the
    # nodes don't jump around between runs, while avoiding a perfect grid feel.
    cols = 3
    positions: list[tuple[float, float]] = []
    rng = random.Random(13371337)
    for i in range(n):
        r = i // cols
        c = i % cols
        base_x = 140 + c * 360
        base_y = 140 + r * 250

        # Per-row drift + per-node jitter gives an "organic" layout.
        row_dx = rng.randint(-55, 55)
        row_dy = rng.randint(-35, 35)
        jx = rng.randint(-95, 95)
        jy = rng.randint(-75, 75)

        positions.append((base_x + row_dx + jx, base_y + row_dy + jy))
    return positions


async def _migrate_problem_id(db, *, old_id, new_id):
    """Move all FK references from old problem id to new one, then delete old problem row."""
    # Tables that have a direct FK to problems.id.
    fk_tables = [
        "library_items",
        "canvas_blocks",
        "workspace_files",
        "discussions",
        "team_problems",
        "canvas_ai_runs",
        "canvas_ai_messages",
    ]

    for table in fk_tables:
        try:
            await db.execute(
                text(f"UPDATE {table} SET problem_id = :new_id WHERE problem_id = :old_id"),
                {"new_id": new_id, "old_id": old_id},
            )
        except Exception:
            # Some deployments may not have all optional tables (or different schemas).
            pass

    # Stars target problems via (target_type, target_id).
    try:
        await db.execute(
            text("UPDATE stars SET target_id = :new_id WHERE target_type = 'problem' AND target_id = :old_id"),
            {"new_id": new_id, "old_id": old_id},
        )
    except Exception:
        pass

    await db.execute(text("DELETE FROM problems WHERE id = :old_id"), {"old_id": old_id})


async def ensure_showcase_problem():
    async with async_session_maker() as db:
        author = await ensure_user(
            db,
            username=SHOWCASE_AUTHOR_USERNAME,
            email=SHOWCASE_AUTHOR_EMAIL,
            bio="Topology + category theory. Occasionally moonlighting in high-dimensional probability.",
        )

        # Upsert problem by exact title.
        result = await db.execute(
            select(Problem).where(
                Problem.title == SHOWCASE_TITLE,
                Problem.visibility == ProblemVisibility.PUBLIC,
            )
        )
        problem = result.scalar_one_or_none()
        created = False
        if not problem:
            problem = Problem(
                id=SHOWCASE_PROBLEM_ID,
                title=SHOWCASE_TITLE,
                description=SHOWCASE_DESCRIPTION,
                author_id=author.id,
                visibility=ProblemVisibility.PUBLIC,
                difficulty=ProblemDifficulty.HARD,
                tags=SHOWCASE_TAGS,
                created_at=_now() - timedelta(days=3),
                updated_at=_now() - timedelta(days=3),
            )
            db.add(problem)
            await db.flush()
            created = True
        else:
            # If the DB was reseeded, the UUID will change and break bookmarked links.
            # Re-home the showcase problem to a stable UUID.
            if problem.id != SHOWCASE_PROBLEM_ID:
                existing_fixed = await db.execute(select(Problem).where(Problem.id == SHOWCASE_PROBLEM_ID))
                fixed = existing_fixed.scalar_one_or_none()
                if fixed is None:
                    fixed = Problem(
                        id=SHOWCASE_PROBLEM_ID,
                        title=problem.title,
                        description=problem.description,
                        author_id=problem.author_id,
                        visibility=problem.visibility,
                        difficulty=problem.difficulty,
                        tags=problem.tags,
                        created_at=problem.created_at,
                        updated_at=problem.updated_at,
                    )
                    db.add(fixed)
                    await db.flush()
                await _migrate_problem_id(db, old_id=problem.id, new_id=SHOWCASE_PROBLEM_ID)
                problem = fixed

            # Keep it curated even if previously created.
            problem.description = SHOWCASE_DESCRIPTION
            problem.difficulty = ProblemDifficulty.HARD
            problem.tags = SHOWCASE_TAGS
            problem.author_id = author.id

        # Ensure library items.
        desired = showcase_items()
        existing_items_result = await db.execute(
            select(LibraryItem).where(LibraryItem.problem_id == problem.id)
        )
        existing_items = existing_items_result.scalars().all()
        # NOTE: On a fresh seed (empty DB), items are created in this run. We must
        # keep a live mapping that includes newly created items, otherwise the
        # dependency pass will not find them and the canvas will look disconnected.
        items_by_title = {item.title: item for item in existing_items}

        positions = _layout_positions(len(desired))
        inserted_ids_by_title: dict[str, object] = {}

        # First pass: create/update items without deps.
        for idx, spec in enumerate(desired):
            item = items_by_title.get(spec["title"])
            x, y = positions[idx]
            if item is None:
                item = LibraryItem(
                    problem_id=problem.id,
                    title=spec["title"],
                    kind=spec["kind"],
                    content=spec["content"],
                    formula=spec.get("formula"),
                    status=spec.get("status", LibraryItemStatus.PROPOSED),
                    x=x,
                    y=y,
                    authors=[{"type": "user", "id": str(author.id), "name": author.username}],
                    source={"seed": "showcase_problem"},
                    dependencies=[],
                    verification=None,
                )
                db.add(item)
                await db.flush()
            else:
                item.kind = spec["kind"]
                item.content = spec["content"]
                item.formula = spec.get("formula")
                item.status = spec.get("status", LibraryItemStatus.PROPOSED)
                item.x = x
                item.y = y
                # Keep authors/source stable for demo.
                item.authors = [{"type": "user", "id": str(author.id), "name": author.username}]
                item.source = {"seed": "showcase_problem"}
            # Keep mapping updated for brand new items too.
            items_by_title[item.title] = item
            inserted_ids_by_title[item.title] = item.id

        # Second pass: resolve dependencies by title.
        for spec in desired:
            if not spec.get("deps"):
                continue
            item = items_by_title.get(spec["title"])
            if item is None:
                continue
            deps: list[object] = []
            for dep_title in spec["deps"]:
                dep_id = inserted_ids_by_title.get(dep_title)
                if dep_id:
                    deps.append(dep_id)
            # Preserve a stable order, drop duplicates.
            seen = set()
            unique_deps = []
            for dep in deps:
                if dep in seen:
                    continue
                seen.add(dep)
                unique_deps.append(dep)
            item.dependencies = unique_deps

        # Canvas blocks (nice for demo + fork copies blocks).
        blocks_spec = [
            ("Setup", ["Definition: (1±ε)-distance preservation", "Setup: Random projection model"]),
            ("Concentration", ["Lemma: Chi-square concentration (Gaussian case)", "Lemma: Fixed-vector norm preservation"]),
            ("JL Proof", ["Theorem: Johnson–Lindenstrauss (Gaussian proof)", "Note: Constant tracking that actually compiles", "Proof skeleton: Minimal steps you can delegate to an LLM"]),
            ("Extensions", ["Lemma: Subgaussian tail bound for sign projections", "Theorem: Sparse JL (Achlioptas-style)", "Lower bound idea: Why k must be Ω(ε^-2 log n)", "Computation: Quick simulation script (pseudo-code)", "Resource: References and reading list"]),
        ]

        existing_blocks_result = await db.execute(
            select(CanvasBlock).where(CanvasBlock.problem_id == problem.id)
        )
        existing_blocks = existing_blocks_result.scalars().all()
        existing_block_by_name = {b.name: b for b in existing_blocks}

        for name, titles in blocks_spec:
            node_ids = [inserted_ids_by_title[t] for t in titles if t in inserted_ids_by_title]
            block = existing_block_by_name.get(name)
            if block is None:
                db.add(CanvasBlock(problem_id=problem.id, name=name, node_ids=node_ids))
            else:
                block.node_ids = node_ids

        # Stars: make it "super trending" without spamming the feed (stars don't create Activity).
        desired_stars = 140
        current_star_count_result = await db.execute(
            select(func.count(Star.id)).where(
                Star.target_type == StarTargetType.PROBLEM,
                Star.target_id == problem.id,
            )
        )
        current_star_count = int(current_star_count_result.scalar() or 0)
        need = max(0, desired_stars - current_star_count)

        if need > 0:
            # Pick old users first to avoid polluting "new users" views.
            users_result = await db.execute(
                select(User)
                .where(User.id != author.id)
                .order_by(User.created_at.asc())
                .limit(desired_stars * 3)
            )
            candidates = users_result.scalars().all()
            random.shuffle(candidates)

            # Exclude users who already starred it.
            starred_result = await db.execute(
                select(Star.user_id).where(
                    Star.target_type == StarTargetType.PROBLEM,
                    Star.target_id == problem.id,
                )
            )
            already = {row[0] for row in starred_result.all()}
            to_star = [u for u in candidates if u.id not in already][:need]

            for u in to_star:
                db.add(Star(user_id=u.id, target_type=StarTargetType.PROBLEM, target_id=problem.id))

        # Adjust updated_at to be exactly #2 in /catalog (public problems are sorted by updated_at desc).
        top_result = await db.execute(
            select(Problem.id, Problem.updated_at)
            .where(Problem.visibility == ProblemVisibility.PUBLIC, Problem.id != problem.id)
            .order_by(Problem.updated_at.desc())
            .limit(2)
        )
        top = top_result.all()
        if len(top) >= 2:
            t1 = top[0][1]
            t2 = top[1][1]
            # Put showcase between the current #1 and #2.
            if t1 and t2 and t1 > t2:
                gap = t1 - t2
                eps = min(timedelta(seconds=30), gap / 2)
                candidate = t1 - eps
                if candidate <= t2:
                    candidate = t2 + timedelta(seconds=1)
                if candidate >= t1:
                    candidate = t1 - timedelta(seconds=1)
                problem.updated_at = candidate
            else:
                # Degenerate: ensure it's near the top but not #1.
                problem.updated_at = (t1 or _now()) - timedelta(seconds=10)
        elif len(top) == 1:
            problem.updated_at = (top[0][1] or _now()) - timedelta(seconds=10)
        else:
            # Only problem: keep it recent but stable.
            problem.updated_at = _now() - timedelta(seconds=10)

        await db.commit()

        verb = "Created" if created else "Updated"
        print(f"✓ {verb} showcase problem: {problem.title}")


async def main():
    await ensure_showcase_problem()


if __name__ == "__main__":
    asyncio.run(main())
