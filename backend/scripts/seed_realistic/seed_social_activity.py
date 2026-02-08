"""
Seed social activity - follows, stars, discussions, comments, activities, notifications.
"""
import asyncio
import hashlib
import random
from datetime import datetime, timedelta
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_maker
from app.models.user import User
from app.models.problem import Problem, ProblemVisibility, ProblemDifficulty
from app.models.library_item import LibraryItem
from app.models.follow import Follow
from app.models.star import Star, StarTargetType
from app.models.discussion import Discussion
from app.models.comment import Comment
from app.models.activity import Activity, ActivityType
from app.models.notification import Notification, NotificationType
from app.models.team import Team, TeamMember, TeamProblem, TeamRole


# Discussion title templates
DISCUSSION_TITLES = [
    "Question about approach to {}",
    "Alternative proof of {}?",
    "Reference for {}",
    "Generalizing {} to higher dimensions",
    "Error in proof of {}?",
    "Connection between {} and {}",
    "Best reference for learning {}?",
    "Open problems related to {}",
    "Computational aspects of {}",
    "Historical context of {}",
]

# Discussion content templates
DISCUSSION_CONTENTS = [
    "I'm working on {} and wondering if there's a more direct approach. Has anyone considered using {}?",
    "In the proof of {}, there seems to be a gap when {}. Am I missing something?",
    "Does anyone know a good reference for {}? I've looked at [Author] but need more details on {}.",
    "It seems like {} should generalize to {}. Has this been studied?",
    "I'm trying to understand the connection between {} and {}. Any insights?",
    "Working on computational implementation of {}. What's the best algorithm for {}?",
    "Reading about {} and curious about its historical development. Who first proved {}?",
    "What are some interesting open problems related to {}?",
]

# Comment templates
COMMENT_TEMPLATES = [
    "Good question! Have you tried {}?",
    "I think the issue is that {}. You need to assume {}.",
    "Check out [Reference] - they handle this case in section {}.",
    "I worked on something similar. The key is to {}.",
    "This is a known open problem. See [Paper] for partial results.",
    "Nice observation! This also relates to {}.",
    "You might want to look at {} for a different perspective.",
    "I'm also interested in this. Following!",
    "Thanks for posting this - very helpful discussion.",
    "One approach is to use {}. Let me know if you want more details.",
]

COMMUNITY_DISCUSSION_TITLES = [
    "Notes on extending {} to noisy data",
    "Anyone validating assumptions in {}?",
    "Practical constraints when proving {}",
    "Counterexample search for {}",
    "Refining the argument behind {}",
    "Can we simplify the main step in {}?",
    "What breaks first in {} under perturbation?",
    "Benchmarking approaches for {}",
]

COMMUNITY_DISCUSSION_PROMPTS = [
    "We tested a variant and saw a mismatch in a boundary case. Looking for independent checks.",
    "I'm trying to connect this with a previous theorem from a different area.",
    "There is progress, but one reduction still feels too implicit.",
    "Would like feedback on whether this assumption is genuinely necessary.",
    "The method works numerically, still unsure about a clean proof skeleton.",
    "I think there is a shorter route if we isolate one lemma first.",
]

COMMUNITY_COMMENT_OPENERS = [
    "Nice thread",
    "Good catch",
    "Interesting angle",
    "This looks solid",
    "Useful update",
    "Strong point",
    "Reasonable concern",
    "Worth testing",
]

COMMUNITY_COMMENT_MIDDLES = [
    "the key risk is hidden in the transition step",
    "the edge case with sparse inputs needs a direct bound",
    "this could be cleaner with one auxiliary lemma",
    "the constant tracking should be explicit before finalizing",
    "the midpoint estimate is convincing but maybe not tight",
    "a short sanity-check experiment would help here",
    "the same pattern appears in a related project",
    "the idea is good, but the normalization assumption is strong",
]

COMMUNITY_COMMENT_ACTIONS = [
    "Could you post the exact condition set you used?",
    "Try adding a short proof sketch for the delicate case.",
    "It may help to separate this into two claims.",
    "Can you compare this with the baseline route?",
    "Would you share where the argument fails without that hypothesis?",
    "Please pin the numerical range for the constants.",
    "A concise example might make the intuition clearer.",
    "Maybe tag one teammate for an independent check.",
]

LUCIA_USERNAME = "lucia_mora"

LUCIA_SPOTLIGHT_TITLES = [
    "Lucia's conjecture thread: {}",
    "Community review for Lucia's approach to {}",
    "Feedback requested on Lucia's writeup of {}",
    "Can we strengthen Lucia's argument on {}?",
    "Lucia's roadmap for {} - critique welcome",
]

LUCIA_REACTION_TITLES = [
    "Reacting to Lucia's latest notes on {}",
    "Building on Lucia's thread about {}",
    "Question for @lucia_mora on {}",
    "Follow-up after Lucia's argument on {}",
]

LUCIA_PROBLEM_TEMPLATES = [
    (
        "Probabilistic stability in {}",
        "Develop concentration bounds and robust stability criteria for {} under sparse perturbations.",
        ["probability", "stability", "combinatorics"],
        ProblemDifficulty.HARD,
    ),
    (
        "Boundary behavior for {} processes",
        "Study boundary regularity and extremal behavior for {} via coupling and entropy methods.",
        ["probability", "analysis", "boundary"],
        ProblemDifficulty.MEDIUM,
    ),
    (
        "Spectral fingerprints of {}",
        "Relate spectral gaps and mixing diagnostics for {} to explicit geometric invariants.",
        ["spectral", "graph-theory", "ergodic"],
        ProblemDifficulty.MEDIUM,
    ),
    (
        "Asymptotic regimes in {}",
        "Characterize phase transitions and asymptotic expansions for {} across critical scales.",
        ["asymptotics", "random-structures", "theory"],
        ProblemDifficulty.HARD,
    ),
    (
        "Computational heuristics for {} conjectures",
        "Benchmark practical heuristics for {} and derive reliability certificates on sampled instances.",
        ["algorithms", "experimental-math", "conjectures"],
        ProblemDifficulty.EASY,
    ),
]

LUCIA_MATH_OBJECTS = [
    "random simplicial complexes",
    "weighted expanders",
    "Markov kernels on manifolds",
    "sparse hypergraphs",
    "non-reversible random walks",
    "multiscale percolation models",
    "low-discrepancy graph families",
]

LUCIA_COMMENT_OPENERS = [
    "Great direction",
    "Nice framing",
    "Interesting reduction",
    "Useful decomposition",
    "Strong draft",
    "Promising route",
    "Clear setup",
    "Good stress test",
]

LUCIA_COMMENT_MIDDLES = [
    "the bottleneck seems to be the compactness passage",
    "the tight step is the variance control in the final estimate",
    "I would pressure-test the normalization assumptions",
    "the bridge from local to global bounds needs one extra lemma",
    "the boundary case with sparse support still looks delicate",
    "the coupling argument might need a quantitative remainder term",
    "the spectral approximation is convincing but needs explicit constants",
    "the finite-sample regime deserves a separate proposition",
]

LUCIA_COMMENT_ACTIONS = [
    "Could you pin down the exact threshold you expect?",
    "Maybe add a counterexample sketch for the edge case.",
    "Can we isolate this in a standalone lemma before the main theorem?",
    "I suggest documenting where the argument breaks without regularity.",
    "It would help to include a small numerical sanity check.",
    "Would a bootstrap step simplify the final argument?",
    "Please state the dependence on dimensions explicitly.",
    "Could we compare this against the previous benchmark proof?",
]

LUCIA_TEAM_BLUEPRINTS = [
    ("Stochastic Structures Collective", "Focused on random structures, concentration, and probabilistic proofs."),
    ("Spectral Methods Studio", "Researching spectral diagnostics for large combinatorial systems."),
    ("Inference & Random Geometry Lab", "Collaborative work on random geometry, transport, and uncertainty."),
    ("Algorithmic Conjectures Forum", "Bridges experimental mathematics and proof-oriented verification."),
]


def sanitize_project_title(title: str) -> str:
    """Keep project token syntax stable even with unusual characters in titles."""
    return title.replace("[", "").replace("]", "").replace("|", "/").strip()


def project_token(problem: Problem) -> str:
    """Format project reference token used by frontend rich renderer."""
    return f"[[project:{problem.id}|{sanitize_project_title(problem.title)}]]"


def user_mention(user: User) -> str:
    """Format user mention token used by frontend rich renderer."""
    return f"@{user.username}"


def discussion_activity_payload(discussion: Discussion) -> dict:
    payload = {
        "discussion_id": str(discussion.id),
        "discussion_title": discussion.title,
        "discussion_content": discussion.content,
    }
    if discussion.problem_id:
        payload["problem_id"] = str(discussion.problem_id)
    return payload


def comment_activity_payload(comment: Comment, discussion: Discussion) -> dict:
    payload = {
        "discussion_id": str(discussion.id),
        "discussion_title": discussion.title,
        "comment_content": comment.content,
        "parent_id": str(comment.parent_id) if comment.parent_id else None,
    }
    if discussion.problem_id:
        payload["problem_id"] = str(discussion.problem_id)
    return payload


def slugify_team_name(name: str) -> str:
    return (
        name.strip()
        .lower()
        .replace("&", "and")
        .replace("'", "")
        .replace(".", "")
        .replace(" ", "-")
    )


def build_lucia_reaction_comment(
    *,
    lucia: User,
    discussion: Discussion,
    all_problems: list[Problem],
) -> str:
    opener = random.choice(LUCIA_COMMENT_OPENERS)
    middle = random.choice(LUCIA_COMMENT_MIDDLES)
    action = random.choice(LUCIA_COMMENT_ACTIONS)
    comment = f"{opener}, {user_mention(lucia)}: {middle}. {action}"

    linked_problem = None
    if discussion.problem_id:
        linked_problem = next((problem for problem in all_problems if problem.id == discussion.problem_id), None)
    if not linked_problem and all_problems:
        linked_problem = random.choice(all_problems)
    if linked_problem and random.random() < 0.65:
        comment += f" {project_token(linked_problem)}"

    return comment


def build_community_comment(
    *,
    target_user: User,
    problem: Problem | None,
) -> str:
    opener = random.choice(COMMUNITY_COMMENT_OPENERS)
    middle = random.choice(COMMUNITY_COMMENT_MIDDLES)
    action = random.choice(COMMUNITY_COMMENT_ACTIONS)
    comment = f"{opener}, {user_mention(target_user)}: {middle}. {action}"
    if problem and random.random() < 0.55:
        comment += f" {project_token(problem)}"
    return comment


def random_past_time(days_ago_max: int, days_ago_min: int = 0) -> datetime:
    """Generate a random datetime between days_ago_min and days_ago_max days ago."""
    days = random.randint(days_ago_min, days_ago_max)
    hours = random.randint(0, 23)
    minutes = random.randint(0, 59)
    return datetime.utcnow() - timedelta(days=days, hours=hours, minutes=minutes)


def stable_bucket(seed_value: str, modulo: int) -> int:
    """Deterministic bucket selection, stable across runs."""
    digest = hashlib.sha256(seed_value.encode("utf-8")).hexdigest()
    return int(digest[:12], 16) % max(1, modulo)


def stable_range(seed_value: str, low: int, high: int) -> int:
    """Deterministic integer in [low, high]."""
    if high <= low:
        return low
    return low + stable_bucket(seed_value, high - low + 1)


def weighted_pick_without_replacement(items: list, weights: list[float], k: int) -> list:
    """Simple weighted sampling without replacement."""
    if not items or k <= 0:
        return []

    picked = []
    pool_items = items[:]
    pool_weights = [max(0.001, float(w)) for w in weights]

    k = min(k, len(pool_items))
    for _ in range(k):
        total = sum(pool_weights)
        if total <= 0:
            picked.append(pool_items.pop(0))
            pool_weights.pop(0)
            continue

        r = random.random() * total
        cumulative = 0.0
        idx = len(pool_items) - 1
        for i, weight in enumerate(pool_weights):
            cumulative += weight
            if r <= cumulative:
                idx = i
                break

        picked.append(pool_items.pop(idx))
        pool_weights.pop(idx)

    return picked


async def seed_follows():
    """Create follow relationships between users."""
    async with async_session_maker() as db:
        # Check existing
        result = await db.execute(select(Follow))
        existing = result.scalars().all()
        if len(existing) > 50:
            print(f"✓ Already have {len(existing)} follows, skipping")
            return
        
        result = await db.execute(select(User))
        all_users = result.scalars().all()
        
        if len(all_users) < 10:
            print("⚠ Need users first")
            return
        
        print(f"Creating follow relationships...")
        
        follows_created = 0
        
        # Each user follows 5-20 others
        for user in all_users:
            potential_follows = [u for u in all_users if u.id != user.id]
            num_follows = random.randint(5, min(20, len(potential_follows)))
            to_follow = random.sample(potential_follows, k=num_follows)
            
            for followed in to_follow:
                db.add(Follow(
                    follower_id=user.id,
                    following_id=followed.id,
                    created_at=random_past_time(300, 10),
                ))
                follows_created += 1
        
        await db.commit()
        print(f"✓ Created {follows_created} follow relationships")


async def seed_stars():
    """Create star/like records."""
    async with async_session_maker() as db:
        result = await db.execute(select(User))
        all_users = result.scalars().all()
        
        result = await db.execute(select(Problem))
        all_problems = result.scalars().all()
        
        result = await db.execute(select(LibraryItem))
        all_items = result.scalars().all()
        
        if not all_users or not all_problems:
            print("⚠ Need users and problems first")
            return
        
        print("Creating/adjusting stars with realistic long-tail distribution...")
        
        stars_created = 0
        stars_removed = 0

        # Existing star state to keep idempotency and avoid duplicates.
        existing_problem_pairs = set()
        existing_item_pairs = set()
        problem_star_users: dict = {problem.id: set() for problem in all_problems}
        user_starred_problems: dict = {user.id: set() for user in all_users}

        result = await db.execute(
            select(Star).where(Star.target_type == StarTargetType.PROBLEM)
        )
        for star in result.scalars().all():
            pair = (star.user_id, star.target_id)
            existing_problem_pairs.add(pair)
            if star.target_id in problem_star_users:
                problem_star_users[star.target_id].add(star.user_id)
            if star.user_id in user_starred_problems:
                user_starred_problems[star.user_id].add(star.target_id)

        result = await db.execute(
            select(Star).where(Star.target_type == StarTargetType.LIBRARY_ITEM)
        )
        for star in result.scalars().all():
            existing_item_pairs.add((star.user_id, star.target_id))

        # Use discussion volume + recency as popularity signal for realistic star concentration.
        result = await db.execute(
            select(Discussion.problem_id, func.count(Discussion.id))
            .where(Discussion.problem_id.is_not(None))
            .group_by(Discussion.problem_id)
        )
        discussion_counts = {problem_id: count for problem_id, count in result.all() if problem_id}
        author_problem_count: dict = {}
        for problem in all_problems:
            author_problem_count[problem.author_id] = author_problem_count.get(problem.author_id, 0) + 1

        now = datetime.utcnow()
        ranked_problems = []
        for problem in all_problems:
            age_days = max(0, (now - problem.created_at).days) if problem.created_at else 180
            recency_score = max(0, 90 - age_days) / 12.0
            discussion_score = discussion_counts.get(problem.id, 0) * 2.5
            existing_star_score = len(problem_star_users.get(problem.id, set())) * 0.6
            author_load = author_problem_count.get(problem.author_id, 1)
            author_penalty = 1.0 + max(0, author_load - 3) * 0.08
            weighted_score = (recency_score + discussion_score + existing_star_score) / author_penalty
            ranked_problems.append((problem, weighted_score))

        ranked_problems.sort(key=lambda item: item[1], reverse=True)
        problem_by_id = {problem.id: problem for problem, _score in ranked_problems}
        ranked_problem_ids = [problem.id for problem, _score in ranked_problems]
        ranked_index = {problem_id: idx for idx, problem_id in enumerate(ranked_problem_ids)}
        total_problems = max(1, len(ranked_problem_ids))
        top_cut = max(3, int(total_problems * 0.12))
        mid_cut = max(top_cut + 1, int(total_problems * 0.45))

        # 1) Ensure each user has a realistic amount of starred problems.
        max_user_target = min(len(all_problems), 14)
        min_user_target = min(4, max_user_target)

        for user in all_users:
            current = user_starred_problems.get(user.id, set())
            target_count = stable_range(
                str(user.id),
                min_user_target,
                max(min_user_target, max_user_target),
            )
            missing = max(0, target_count - len(current))
            if missing <= 0:
                continue

            candidates = [problem for problem in all_problems if problem.id not in current]
            if not candidates:
                continue

            candidate_weights = []
            for problem in candidates:
                idx = ranked_index.get(problem.id, total_problems)
                if idx < top_cut:
                    weight = 7.5
                elif idx < mid_cut:
                    weight = 3.8
                else:
                    weight = 1.5
                candidate_weights.append(weight)

            picked = weighted_pick_without_replacement(candidates, candidate_weights, missing)
            for problem in picked:
                pair = (user.id, problem.id)
                if pair in existing_problem_pairs:
                    continue
                db.add(Star(
                    user_id=user.id,
                    target_type=StarTargetType.PROBLEM,
                    target_id=problem.id,
                    created_at=random_past_time(140, 2),
                ))
                existing_problem_pairs.add(pair)
                problem_star_users.setdefault(problem.id, set()).add(user.id)
                user_starred_problems.setdefault(user.id, set()).add(problem.id)
                stars_created += 1

        # 2) Ensure trending candidates have visibly higher star counts (still bounded by total users),
        # while avoiding one author monopolizing the top slots.
        user_ids = [user.id for user in all_users]
        max_users = len(user_ids)
        author_top_load: dict = {}
        author_mid_load: dict = {}

        for idx, problem_id in enumerate(ranked_problem_ids):
            problem = problem_by_id.get(problem_id)
            if not problem:
                continue

            author_id = problem.author_id
            tier = "long"
            if idx < top_cut:
                if author_top_load.get(author_id, 0) < 2:
                    tier = "top"
                    author_top_load[author_id] = author_top_load.get(author_id, 0) + 1
                else:
                    tier = "mid"
                    author_mid_load[author_id] = author_mid_load.get(author_id, 0) + 1
            elif idx < mid_cut:
                if author_mid_load.get(author_id, 0) < 4:
                    tier = "mid"
                    author_mid_load[author_id] = author_mid_load.get(author_id, 0) + 1
                else:
                    tier = "long"

            if tier == "top":
                low = min(max_users, max(12, int(max_users * 0.18)))
                high = min(max_users, max(low, int(max_users * 0.34)))
            elif tier == "mid":
                low = min(max_users, max(6, int(max_users * 0.08)))
                high = min(max_users, max(low, int(max_users * 0.22)))
            else:
                low = min(max_users, 1)
                high = min(max_users, 8)

            target_for_problem = stable_range(str(problem_id), low, high)
            current_starrers = problem_star_users.get(problem_id, set())

            if len(current_starrers) > target_for_problem:
                ordered_starrers = sorted(
                    current_starrers,
                    key=lambda uid: stable_bucket(f"{problem_id}:{uid}", 10_000_000),
                )
                to_remove = ordered_starrers[target_for_problem:]
                if to_remove:
                    await db.execute(
                        delete(Star).where(
                            Star.target_type == StarTargetType.PROBLEM,
                            Star.target_id == problem_id,
                            Star.user_id.in_(to_remove),
                        )
                    )
                    for user_id in to_remove:
                        existing_problem_pairs.discard((user_id, problem_id))
                        user_starred_problems.setdefault(user_id, set()).discard(problem_id)
                    problem_star_users[problem_id] = set(ordered_starrers[:target_for_problem])
                    current_starrers = problem_star_users[problem_id]
                    stars_removed += len(to_remove)

            missing = max(0, target_for_problem - len(current_starrers))
            if missing > 0:
                available_user_ids = [uid for uid in user_ids if uid not in current_starrers]
                if not available_user_ids:
                    continue

                random.shuffle(available_user_ids)
                for user_id in available_user_ids[:missing]:
                    pair = (user_id, problem_id)
                    if pair in existing_problem_pairs:
                        continue
                    db.add(Star(
                        user_id=user_id,
                        target_type=StarTargetType.PROBLEM,
                        target_id=problem_id,
                        created_at=random_past_time(100, 1),
                    ))
                    existing_problem_pairs.add(pair)
                    problem_star_users.setdefault(problem_id, set()).add(user_id)
                    user_starred_problems.setdefault(user_id, set()).add(problem_id)
                    stars_created += 1

        # 3) Library-item stars from a minority of users.
        if all_items:
            max_item_stars = min(6, len(all_items))
            for user in all_users:
                if stable_bucket(str(user.id), 100) >= 38:
                    continue

                target_items = stable_range(f"item-{user.id}", 1, max(1, max_item_stars))
                available_items = [
                    item for item in all_items if (user.id, item.id) not in existing_item_pairs
                ]
                if not available_items:
                    continue

                picked_items = random.sample(
                    available_items,
                    k=min(target_items, len(available_items)),
                )
                for item in picked_items:
                    pair = (user.id, item.id)
                    if pair in existing_item_pairs:
                        continue
                    db.add(Star(
                        user_id=user.id,
                        target_type=StarTargetType.LIBRARY_ITEM,
                        target_id=item.id,
                        created_at=random_past_time(120, 3),
                    ))
                    existing_item_pairs.add(pair)
                    stars_created += 1
        
        await db.commit()
        print(f"✓ Created {stars_created} stars")
        print(f"✓ Rebalanced stars removed (-{stars_removed})")


async def seed_discussions():
    """Create discussions and comments."""
    async with async_session_maker() as db:
        # Check existing
        result = await db.execute(select(Discussion))
        existing = result.scalars().all()
        if len(existing) > 30:
            print(f"✓ Already have {len(existing)} discussions, skipping")
            return
        
        result = await db.execute(select(User))
        all_users = result.scalars().all()
        
        result = await db.execute(select(Problem))
        all_problems = result.scalars().all()
        
        result = await db.execute(select(LibraryItem))
        all_items = result.scalars().all()
        
        if not all_users or not all_problems:
            print("⚠ Need users and problems first")
            return
        
        print(f"Creating discussions and comments...")
        
        discussions_created = 0
        comments_created = 0
        
        # Create 40-60 discussions
        num_discussions = random.randint(40, 60)
        problems_by_id = {p.id: p for p in all_problems}

        for _ in range(num_discussions):
            author = random.choice(all_users)
            mention_candidates = [u for u in all_users if u.id != author.id]
            mentioned_user = random.choice(mention_candidates) if mention_candidates else None
            
            # 70% are problem-specific, 30% general
            if random.random() < 0.7 and all_problems:
                problem = random.choice(all_problems)
                problem_id = problem.id
                title_template = random.choice(DISCUSSION_TITLES)
                title = title_template.format(problem.title[:40], "related topic")
                content_template = random.choice(DISCUSSION_CONTENTS)
                content = content_template.format(
                    problem.title[:50],
                    "alternative method",
                    "some property",
                )
                content += f"\n\nProject context: {project_token(problem)}"
                if mentioned_user and random.random() < 0.65:
                    content += f"\n\n{user_mention(mentioned_user)} would love your take on this."
            else:
                problem_id = None
                title = random.choice([
                    "Best resources for learning algebraic geometry?",
                    "Recommended textbooks for topology",
                    "Career advice for aspiring mathematicians",
                    "Favorite mathematical visualization tools",
                    "Most surprising theorems you've encountered",
                    "Tips for reading dense papers",
                    "Collaboration tools for remote teams",
                ])
                content = random.choice([
                    "I'm looking to deepen my understanding of this area. What resources do you recommend?",
                    "Starting a reading group and looking for suggestions on good texts.",
                    "Curious to hear the community's thoughts on this.",
                    "What's your experience with this?",
                ])
                # Add references so seeded social text exercises mention/tag rendering.
                if all_problems and random.random() < 0.55:
                    random_problem = random.choice(all_problems)
                    content += f"\n\nRelated project: {project_token(random_problem)}"
                if mentioned_user and random.random() < 0.45:
                    content += f"\n\nTagging {user_mention(mentioned_user)} for suggestions."
            
            # Some discussions are pinned (5%)
            is_pinned = random.random() < 0.05
            
            created_at = random_past_time(250, 5)
            
            discussion = Discussion(
                title=title,
                content=content,
                author_id=author.id,
                problem_id=problem_id,
                is_pinned=is_pinned,
                created_at=created_at,
                updated_at=created_at,
            )
            
            db.add(discussion)
            await db.flush()  # Get discussion.id
            db.add(Activity(
                user_id=author.id,
                type=ActivityType.CREATED_DISCUSSION,
                target_id=discussion.id,
                extra_data=discussion_activity_payload(discussion),
                created_at=created_at,
            ))
            
            discussions_created += 1
            
            # Add 2-10 comments
            num_comments = random.randint(2, 10)
            prev_comment_id = None
            
            for i in range(num_comments):
                commenter = random.choice([u for u in all_users if u.id != author.id] or all_users)
                comment_text = random.choice(COMMENT_TEMPLATES).format(
                    "some approach",
                    "condition",
                    "3.2",
                    "use this method",
                    "related concept",
                )

                # Mentions in comments
                comment_mention_candidates = [u for u in all_users if u.id != commenter.id]
                if comment_mention_candidates and random.random() < 0.35:
                    mentioned_comment_user = random.choice(comment_mention_candidates)
                    comment_text += f" {user_mention(mentioned_comment_user)}"

                # Project references in comments
                target_problem = None
                if problem_id and problem_id in problems_by_id:
                    target_problem = problems_by_id[problem_id]
                elif all_problems and random.random() < 0.45:
                    target_problem = random.choice(all_problems)
                if target_problem and random.random() < 0.6:
                    comment_text += f" See {project_token(target_problem)}."
                
                # 20% chance of being a reply to previous comment
                parent_id = None
                if i > 0 and random.random() < 0.2 and prev_comment_id:
                    parent_id = prev_comment_id
                
                comment_created_at = created_at + timedelta(
                    hours=random.randint(1, 48),
                    minutes=random.randint(0, 59)
                )
                
                comment = Comment(
                    discussion_id=discussion.id,
                    author_id=commenter.id,
                    content=comment_text,
                    parent_id=parent_id,
                    created_at=comment_created_at,
                    updated_at=comment_created_at,
                )
                
                db.add(comment)
                await db.flush()  # Get comment.id
                db.add(Activity(
                    user_id=commenter.id,
                    type=ActivityType.CREATED_COMMENT,
                    target_id=comment.id,
                    extra_data=comment_activity_payload(comment, discussion),
                    created_at=comment_created_at,
                ))
                
                prev_comment_id = comment.id
                comments_created += 1
                
                # Update discussion updated_at
                discussion.updated_at = comment_created_at
                
                # Create notification for discussion author (if not self-comment)
                if commenter.id != author.id:
                    db.add(Notification(
                        user_id=author.id,
                        type=NotificationType.NEW_COMMENT,
                        title=f"{commenter.username} commented on your discussion",
                        content=comment_text[:200],
                        actor_id=commenter.id,
                        target_type="discussion",
                        target_id=discussion.id,
                        extra_data={
                            "discussion_id": str(discussion.id),
                            "comment_id": str(comment.id),
                        },
                        is_read=random.random() < 0.6,  # 60% already read
                        created_at=comment_created_at,
                    ))
            
            # Some discussions get starred
            if random.random() < 0.3:
                max_starrers = min(5, len(all_users))
                starrers = random.sample(all_users, k=random.randint(1, max_starrers))
                for starrer in starrers:
                    db.add(Star(
                        user_id=starrer.id,
                        target_type=StarTargetType.DISCUSSION,
                        target_id=discussion.id,
                        created_at=random_past_time(200, 10),
                    ))
            
            if discussions_created % 10 == 0:
                await db.commit()  # Commit periodically
        
        await db.commit()
        print(f"✓ Created {discussions_created} discussions")
        print(f"✓ Created {comments_created} comments")


async def seed_lucia_spotlight():
    """Ensure Lucia Mora has visibility without dominating the full community feed."""
    async with async_session_maker() as db:
        result = await db.execute(select(User).where(User.username == LUCIA_USERNAME))
        lucia = result.scalar_one_or_none()
        if not lucia:
            print("⚠ Lucia demo user not found. Run seed_users first.")
            return

        result = await db.execute(select(User))
        all_users = result.scalars().all()
        other_users = [user for user in all_users if user.id != lucia.id]

        result = await db.execute(select(Problem))
        all_problems = result.scalars().all()

        if not other_users or not all_problems:
            print("⚠ Need users/problems before Lucia spotlight seeding.")
            return

        print("Balancing Lucia spotlight within broader community activity...")

        # 1) Ensure Lucia has many followers.
        result = await db.execute(select(Follow).where(Follow.following_id == lucia.id))
        existing_lucia_follows = result.scalars().all()
        existing_follower_ids = {follow.follower_id for follow in existing_lucia_follows}

        target_followers = min(len(other_users), max(10, int(len(other_users) * 0.35)))
        missing_followers = [user for user in other_users if user.id not in existing_follower_ids]
        random.shuffle(missing_followers)
        follows_added = 0

        for follower in missing_followers[: max(0, target_followers - len(existing_follower_ids))]:
            created_at = random_past_time(120, 2)
            db.add(Follow(
                follower_id=follower.id,
                following_id=lucia.id,
                created_at=created_at,
            ))
            db.add(Notification(
                user_id=lucia.id,
                type=NotificationType.FOLLOW,
                title=f"{follower.username} followed you",
                content=f"{follower.username} started following you",
                actor_id=follower.id,
                target_type="user",
                target_id=lucia.id,
                is_read=random.random() < 0.25,
                created_at=created_at,
            ))
            follows_added += 1

        # 2) Ensure Lucia has authored problems with varied themes.
        result = await db.execute(select(Problem).where(Problem.author_id == lucia.id))
        lucia_problems = result.scalars().all()
        lucia_problem_titles = {problem.title for problem in lucia_problems}
        created_lucia_problems = 0

        target_lucia_problems = min(6, max(3, len(all_problems) // 35))
        template_idx = 0
        attempts = 0
        while len(lucia_problems) < target_lucia_problems and attempts < 80:
            attempts += 1
            template = LUCIA_PROBLEM_TEMPLATES[template_idx % len(LUCIA_PROBLEM_TEMPLATES)]
            template_idx += 1
            math_object = random.choice(LUCIA_MATH_OBJECTS)
            title = template[0].format(math_object)
            if title in lucia_problem_titles:
                continue

            description = template[1].format(math_object)
            tags = template[2]
            difficulty = template[3]
            created_at = random_past_time(100, 4)

            problem = Problem(
                title=title,
                description=description,
                author_id=lucia.id,
                visibility=ProblemVisibility.PUBLIC,
                difficulty=difficulty,
                tags=tags,
                created_at=created_at,
                updated_at=created_at,
            )
            db.add(problem)
            await db.flush()
            db.add(Activity(
                user_id=lucia.id,
                type=ActivityType.CREATED_PROBLEM,
                target_id=problem.id,
                extra_data={"problem_id": str(problem.id), "problem_title": problem.title},
                created_at=created_at,
            ))
            lucia_problems.append(problem)
            all_problems.append(problem)
            lucia_problem_titles.add(problem.title)
            created_lucia_problems += 1

        # 3) Ensure Lucia participates in several research teams and projects.
        teams_result = await db.execute(select(Team))
        all_teams = teams_result.scalars().all()
        memberships_result = await db.execute(select(TeamMember).where(TeamMember.user_id == lucia.id))
        lucia_memberships = memberships_result.scalars().all()
        lucia_team_ids = {membership.team_id for membership in lucia_memberships}
        teams_joined = 0
        teams_created_for_lucia = 0
        team_problem_links_added = 0

        if not all_teams:
            existing_slugs = set()
            for name, description in LUCIA_TEAM_BLUEPRINTS:
                base_slug = slugify_team_name(name)
                slug = base_slug
                suffix = 2
                while slug in existing_slugs:
                    slug = f"{base_slug}-{suffix}"
                    suffix += 1

                created_at = random_past_time(240, 45)
                team = Team(
                    name=name,
                    slug=slug,
                    description=description,
                    is_public=True,
                    created_at=created_at,
                    updated_at=created_at,
                )
                db.add(team)
                await db.flush()
                existing_slugs.add(slug)
                all_teams.append(team)
                teams_created_for_lucia += 1

                owner = random.choice(other_users)
                db.add(TeamMember(
                    team_id=team.id,
                    user_id=owner.id,
                    role=TeamRole.OWNER,
                    joined_at=created_at,
                ))

        if all_teams:
            target_team_memberships = min(4, max(2, len(all_teams) // 8))
            missing_slots = max(0, target_team_memberships - len(lucia_team_ids))
            candidate_teams = [team for team in all_teams if team.id not in lucia_team_ids and team.is_public]
            if len(candidate_teams) < missing_slots:
                candidate_teams = [team for team in all_teams if team.id not in lucia_team_ids]
            random.shuffle(candidate_teams)

            for idx, team in enumerate(candidate_teams[:missing_slots]):
                joined_at = random_past_time(45, 0)
                role = TeamRole.ADMIN if idx == 0 else TeamRole.MEMBER
                db.add(TeamMember(
                    team_id=team.id,
                    user_id=lucia.id,
                    role=role,
                    joined_at=joined_at,
                ))
                db.add(Activity(
                    user_id=lucia.id,
                    type=ActivityType.TEAM_JOIN,
                    target_id=team.id,
                    extra_data={
                        "team_id": str(team.id),
                        "team_name": team.name,
                        "team_slug": team.slug or slugify_team_name(team.name),
                    },
                    created_at=joined_at,
                ))
                lucia_team_ids.add(team.id)
                teams_joined += 1

            if lucia_team_ids and lucia_problems:
                existing_team_problem_result = await db.execute(
                    select(TeamProblem).where(
                        TeamProblem.team_id.in_(lucia_team_ids),
                        TeamProblem.problem_id.in_([problem.id for problem in lucia_problems]),
                    )
                )
                existing_team_problem_pairs = {
                    (entry.team_id, entry.problem_id)
                    for entry in existing_team_problem_result.scalars().all()
                }

                for team_id in lucia_team_ids:
                    team_problem_pool = lucia_problems[:]
                    random.shuffle(team_problem_pool)
                    desired_links = min(len(team_problem_pool), random.randint(1, 3))
                    linked = 0
                    for problem in team_problem_pool:
                        pair = (team_id, problem.id)
                        if pair in existing_team_problem_pairs:
                            continue
                        db.add(TeamProblem(
                            team_id=team_id,
                            problem_id=problem.id,
                            added_by_id=lucia.id,
                            added_at=random_past_time(75, 1),
                        ))
                        existing_team_problem_pairs.add(pair)
                        team_problem_links_added += 1
                        linked += 1
                        if linked >= desired_links:
                            break

        # 3b) Create fresh multi-topic Lucia updates so Discover is not single-thread heavy.
        team_by_id = {team.id: team for team in all_teams}
        fresh_discussions_created = 0
        fresh_comments_created = 0
        topic_pool = lucia_problems[:] if lucia_problems else all_problems[:]
        random.shuffle(topic_pool)

        for problem in topic_pool[: min(2, len(topic_pool))]:
            team_name = None
            if lucia_team_ids:
                team = team_by_id.get(random.choice(list(lucia_team_ids)))
                team_name = team.name if team else None

            discussion_title = f"Lucia weekly checkpoint: {problem.title[:46]}"
            existing_discussion_result = await db.execute(
                select(Discussion).where(
                    Discussion.author_id == lucia.id,
                    Discussion.title == discussion_title,
                )
            )
            existing_discussion = existing_discussion_result.scalar_one_or_none()
            if existing_discussion:
                continue

            created_at = random_past_time(12, 0)
            peer = random.choice(other_users)
            team_context = f"Team context: {team_name}." if team_name else "Community context."
            discussion = Discussion(
                title=discussion_title,
                content=(
                    f"Sharing this iteration for feedback. {user_mention(peer)} could you review assumptions?\n\n"
                    f"{team_context}\n"
                    f"Working project: {project_token(problem)}\n\n"
                    "Main question: which lemma is still too brittle before formalization?"
                ),
                author_id=lucia.id,
                problem_id=problem.id,
                is_pinned=False,
                created_at=created_at,
                updated_at=created_at,
            )
            db.add(discussion)
            await db.flush()
            db.add(Activity(
                user_id=lucia.id,
                type=ActivityType.CREATED_DISCUSSION,
                target_id=discussion.id,
                extra_data=discussion_activity_payload(discussion),
                created_at=created_at,
            ))
            fresh_discussions_created += 1

            commenters = random.sample(other_users, k=min(len(other_users), random.randint(1, 3)))
            for commenter in commenters:
                comment_created_at = created_at + timedelta(
                    hours=random.randint(1, 36),
                    minutes=random.randint(0, 59),
                )
                comment_text = build_lucia_reaction_comment(
                    lucia=lucia,
                    discussion=discussion,
                    all_problems=all_problems,
                )
                comment = Comment(
                    discussion_id=discussion.id,
                    author_id=commenter.id,
                    content=comment_text,
                    parent_id=None,
                    created_at=comment_created_at,
                    updated_at=comment_created_at,
                )
                db.add(comment)
                db.add(Activity(
                    user_id=commenter.id,
                    type=ActivityType.CREATED_COMMENT,
                    target_id=comment.id,
                    extra_data=comment_activity_payload(comment, discussion),
                    created_at=comment_created_at,
                ))
                discussion.updated_at = max(discussion.updated_at, comment_created_at)
                fresh_comments_created += 1

                db.add(Notification(
                    user_id=lucia.id,
                    type=NotificationType.NEW_COMMENT,
                    title=f"{commenter.username} reacted to your discussion",
                    content=comment_text[:200],
                    actor_id=commenter.id,
                    target_type="discussion",
                    target_id=discussion.id,
                    extra_data={"discussion_id": str(discussion.id)},
                    is_read=random.random() < 0.4,
                    created_at=comment_created_at,
                ))

        # 4) Ensure Lucia has enough authored discussions.
        result = await db.execute(select(Discussion).where(Discussion.author_id == lucia.id))
        lucia_discussions = result.scalars().all()

        target_lucia_discussions = min(10, max(4, len(all_problems) // 10))
        created_lucia_discussions = 0

        for _ in range(max(0, target_lucia_discussions - len(lucia_discussions))):
            problem = random.choice(all_problems)
            peer = random.choice(other_users)
            created_at = random_past_time(90, 1)

            discussion = Discussion(
                title=random.choice(LUCIA_SPOTLIGHT_TITLES).format(problem.title[:42]),
                content=(
                    f"I'm sharing this draft for review. {user_mention(peer)} I'd love your critique.\n\n"
                    f"Main context: {project_token(problem)}\n\n"
                    "Please challenge assumptions and edge cases directly in replies."
                ),
                author_id=lucia.id,
                problem_id=problem.id,
                is_pinned=random.random() < 0.08,
                created_at=created_at,
                updated_at=created_at,
            )
            db.add(discussion)
            await db.flush()
            db.add(Activity(
                user_id=lucia.id,
                type=ActivityType.CREATED_DISCUSSION,
                target_id=discussion.id,
                extra_data=discussion_activity_payload(discussion),
                created_at=created_at,
            ))
            lucia_discussions.append(discussion)
            created_lucia_discussions += 1

        # 5) Ensure many reaction threads mention Lucia.
        result = await db.execute(select(Discussion))
        all_discussions = result.scalars().all()
        existing_reaction_threads = [
            discussion for discussion in all_discussions
            if discussion.author_id != lucia.id and user_mention(lucia) in discussion.content
        ]

        target_reaction_threads = min(8, max(3, len(all_problems) // 16))
        created_reaction_threads = 0

        for _ in range(max(0, target_reaction_threads - len(existing_reaction_threads))):
            author = random.choice(other_users)
            problem = random.choice(all_problems)
            created_at = random_past_time(75, 1)

            discussion = Discussion(
                title=random.choice(LUCIA_REACTION_TITLES).format(problem.title[:40]),
                content=(
                    f"I've been following {user_mention(lucia)} and wanted to react to her latest thread.\n\n"
                    f"Reference project: {project_token(problem)}\n\n"
                    f"{user_mention(lucia)} does this extension align with your intended direction?"
                ),
                author_id=author.id,
                problem_id=problem.id,
                is_pinned=False,
                created_at=created_at,
                updated_at=created_at,
            )
            db.add(discussion)
            await db.flush()
            db.add(Activity(
                user_id=author.id,
                type=ActivityType.CREATED_DISCUSSION,
                target_id=discussion.id,
                extra_data=discussion_activity_payload(discussion),
                created_at=created_at,
            ))
            existing_reaction_threads.append(discussion)
            created_reaction_threads += 1

        # 6) Ensure Lucia discussions have many comments and stars from others.
        lucia_discussion_ids = [discussion.id for discussion in lucia_discussions]
        comments_by_discussion: dict = {discussion_id: [] for discussion_id in lucia_discussion_ids}
        stars_by_discussion: dict = {discussion_id: set() for discussion_id in lucia_discussion_ids}

        if lucia_discussion_ids:
            result = await db.execute(
                select(Comment).where(Comment.discussion_id.in_(lucia_discussion_ids))
            )
            for comment in result.scalars().all():
                comments_by_discussion.setdefault(comment.discussion_id, []).append(comment)

            result = await db.execute(
                select(Star).where(
                    Star.target_type == StarTargetType.DISCUSSION,
                    Star.target_id.in_(lucia_discussion_ids),
                )
            )
            for star in result.scalars().all():
                stars_by_discussion.setdefault(star.target_id, set()).add(star.user_id)

        comments_added = 0
        stars_added = 0

        for discussion in lucia_discussions:
            current_comments = comments_by_discussion.get(discussion.id, [])
            target_comments = random.randint(4, 9)
            missing_comments = max(0, target_comments - len(current_comments))
            existing_comment_texts = {comment.content.strip() for comment in current_comments}

            for _ in range(missing_comments):
                commenter = random.choice(other_users)
                comment_created_at = discussion.created_at + timedelta(
                    hours=random.randint(1, 120),
                    minutes=random.randint(0, 59),
                )
                comment_text = ""
                for _attempt in range(8):
                    candidate = build_lucia_reaction_comment(
                        lucia=lucia,
                        discussion=discussion,
                        all_problems=all_problems,
                    )
                    if candidate not in existing_comment_texts:
                        comment_text = candidate
                        break
                if not comment_text:
                    comment_text = build_lucia_reaction_comment(
                        lucia=lucia,
                        discussion=discussion,
                        all_problems=all_problems,
                    )
                existing_comment_texts.add(comment_text)

                comment = Comment(
                    discussion_id=discussion.id,
                    author_id=commenter.id,
                    content=comment_text,
                    parent_id=None,
                    created_at=comment_created_at,
                    updated_at=comment_created_at,
                )
                db.add(comment)
                db.add(Activity(
                    user_id=commenter.id,
                    type=ActivityType.CREATED_COMMENT,
                    target_id=comment.id,
                    extra_data=comment_activity_payload(comment, discussion),
                    created_at=comment_created_at,
                ))
                comments_added += 1
                discussion.updated_at = max(discussion.updated_at, comment_created_at)

                db.add(Notification(
                    user_id=lucia.id,
                    type=NotificationType.NEW_COMMENT,
                    title=f"{commenter.username} reacted to your discussion",
                    content=comment_text[:200],
                    actor_id=commenter.id,
                    target_type="discussion",
                    target_id=discussion.id,
                    extra_data={"discussion_id": str(discussion.id)},
                    is_read=random.random() < 0.35,
                    created_at=comment_created_at,
                ))

            existing_starrers = stars_by_discussion.get(discussion.id, set())
            target_stars = min(len(other_users), random.randint(3, min(14, len(other_users))))
            missing_starrers = [user for user in other_users if user.id not in existing_starrers]
            random.shuffle(missing_starrers)

            for starrer in missing_starrers[: max(0, target_stars - len(existing_starrers))]:
                db.add(Star(
                    user_id=starrer.id,
                    target_type=StarTargetType.DISCUSSION,
                    target_id=discussion.id,
                    created_at=random_past_time(110, 2),
                ))
                stars_added += 1

        await db.commit()
        print(f"✓ Lucia followers ensured (+{follows_added})")
        print(f"✓ Lucia authored problems ensured (+{created_lucia_problems})")
        print(f"✓ Teams created for Lucia spotlight (+{teams_created_for_lucia})")
        print(f"✓ Lucia team memberships ensured (+{teams_joined})")
        print(f"✓ Lucia team-project links ensured (+{team_problem_links_added})")
        print(f"✓ Lucia fresh multi-topic discussions created (+{fresh_discussions_created})")
        print(f"✓ Lucia fresh multi-topic comments created (+{fresh_comments_created})")
        print(f"✓ Lucia discussions ensured (+{created_lucia_discussions})")
        print(f"✓ Lucia reaction threads ensured (+{created_reaction_threads})")
        print(f"✓ Lucia discussion comments added (+{comments_added})")
        print(f"✓ Lucia discussion stars added (+{stars_added})")


async def seed_community_pulse():
    """Create fresh multi-author activity so feed feels alive across many users."""
    async with async_session_maker() as db:
        result = await db.execute(select(User))
        all_users = result.scalars().all()
        if len(all_users) < 10:
            print("⚠ Need users first")
            return

        result = await db.execute(select(Problem))
        all_problems = result.scalars().all()
        if not all_problems:
            print("⚠ Need problems first")
            return

        lucia_result = await db.execute(select(User).where(User.username == LUCIA_USERNAME))
        lucia = lucia_result.scalar_one_or_none()

        # Keep Lucia present but cap her contribution in this community pass.
        community_users = [user for user in all_users if not lucia or user.id != lucia.id]
        if len(community_users) < 8:
            community_users = all_users[:]

        recent_cutoff = datetime.utcnow() - timedelta(days=14)
        recent_discussions_result = await db.execute(
            select(Discussion).where(Discussion.created_at >= recent_cutoff)
        )
        recent_discussions = recent_discussions_result.scalars().all()
        recent_non_lucia = [
            discussion for discussion in recent_discussions
            if not lucia or discussion.author_id != lucia.id
        ]
        existing_titles = {discussion.title.strip() for discussion in recent_discussions}

        author_load: dict = {}
        for discussion in recent_non_lucia:
            author_load[discussion.author_id] = author_load.get(discussion.author_id, 0) + 1

        target_recent_non_lucia = min(60, max(26, len(community_users) // 2))
        discussions_needed = max(0, target_recent_non_lucia - len(recent_non_lucia))
        discussions_to_create = min(24, discussions_needed)

        if discussions_to_create == 0:
            print("✓ Community pulse already healthy, skipping new community discussions")
            return

        print(f"Creating community pulse activity (+{discussions_to_create} discussions target)...")

        discussions_created = 0
        comments_created = 0
        stars_created = 0

        for _ in range(discussions_to_create):
            # Prioritize users with lower recent author load.
            sorted_users = sorted(
                community_users,
                key=lambda user: (author_load.get(user.id, 0), stable_bucket(str(user.id), 1000)),
            )
            candidate_pool = sorted_users[: max(6, len(sorted_users) // 3)]
            author = random.choice(candidate_pool if candidate_pool else community_users)
            author_load[author.id] = author_load.get(author.id, 0) + 1

            problem = random.choice(all_problems)
            title = random.choice(COMMUNITY_DISCUSSION_TITLES).format(problem.title[:44])
            if title in existing_titles:
                title = f"{title} #{stable_range(str(datetime.utcnow().timestamp()), 2, 99)}"
            existing_titles.add(title)

            prompt = random.choice(COMMUNITY_DISCUSSION_PROMPTS)
            mention_candidates = [user for user in community_users if user.id != author.id]
            mention_target = random.choice(mention_candidates) if mention_candidates else None

            content = (
                f"{prompt}\n\n"
                f"Current project: {project_token(problem)}\n\n"
                f"{user_mention(mention_target)} could you take a pass on this?"
                if mention_target
                else f"{prompt}\n\nCurrent project: {project_token(problem)}"
            )

            created_at = random_past_time(10, 0)
            discussion = Discussion(
                title=title,
                content=content,
                author_id=author.id,
                problem_id=problem.id,
                is_pinned=False,
                created_at=created_at,
                updated_at=created_at,
            )
            db.add(discussion)
            await db.flush()

            db.add(Activity(
                user_id=author.id,
                type=ActivityType.CREATED_DISCUSSION,
                target_id=discussion.id,
                extra_data=discussion_activity_payload(discussion),
                created_at=created_at,
            ))
            discussions_created += 1

            commenters_pool = [user for user in community_users if user.id != author.id]
            random.shuffle(commenters_pool)
            num_comments = min(len(commenters_pool), random.randint(2, 6))
            existing_comment_texts = set()

            for commenter in commenters_pool[:num_comments]:
                comment_created_at = created_at + timedelta(
                    hours=random.randint(1, 48),
                    minutes=random.randint(0, 59),
                )
                comment_text = ""
                for _attempt in range(6):
                    candidate = build_community_comment(
                        target_user=author,
                        problem=problem if random.random() < 0.7 else None,
                    )
                    if candidate not in existing_comment_texts:
                        comment_text = candidate
                        break
                if not comment_text:
                    comment_text = build_community_comment(target_user=author, problem=problem)
                existing_comment_texts.add(comment_text)

                comment = Comment(
                    discussion_id=discussion.id,
                    author_id=commenter.id,
                    content=comment_text,
                    parent_id=None,
                    created_at=comment_created_at,
                    updated_at=comment_created_at,
                )
                db.add(comment)
                db.add(Activity(
                    user_id=commenter.id,
                    type=ActivityType.CREATED_COMMENT,
                    target_id=comment.id,
                    extra_data=comment_activity_payload(comment, discussion),
                    created_at=comment_created_at,
                ))
                discussion.updated_at = max(discussion.updated_at, comment_created_at)
                comments_created += 1

                db.add(Notification(
                    user_id=author.id,
                    type=NotificationType.NEW_COMMENT,
                    title=f"{commenter.username} commented on your discussion",
                    content=comment_text[:200],
                    actor_id=commenter.id,
                    target_type="discussion",
                    target_id=discussion.id,
                    extra_data={"discussion_id": str(discussion.id)},
                    is_read=random.random() < 0.45,
                    created_at=comment_created_at,
                ))

            # A few stars to signal traction but not on every thread.
            if random.random() < 0.65:
                starrers = [user for user in community_users if user.id != author.id]
                random.shuffle(starrers)
                for starrer in starrers[: random.randint(2, min(8, len(starrers)))]:
                    db.add(Star(
                        user_id=starrer.id,
                        target_type=StarTargetType.DISCUSSION,
                        target_id=discussion.id,
                        created_at=random_past_time(14, 0),
                    ))
                    stars_created += 1

        await db.commit()
        print(f"✓ Community discussions created (+{discussions_created})")
        print(f"✓ Community comments created (+{comments_created})")
        print(f"✓ Community discussion stars created (+{stars_created})")


async def seed_additional_activities():
    """Create additional activity records for various actions."""
    async with async_session_maker() as db:
        result = await db.execute(select(Problem))
        all_problems = result.scalars().all()
        if not all_problems:
            print("⚠ Need users and problems first")
            return
        
        print(f"Creating additional activity records...")
        
        activities_created = 0

        # Build indexes to avoid activity duplicates on repeated runs.
        discussion_activity_ids = set()
        comment_activity_ids = set()
        follow_activity_pairs = set()
        result = await db.execute(select(Activity))
        for activity in result.scalars().all():
            if activity.type == ActivityType.CREATED_DISCUSSION and activity.target_id:
                discussion_activity_ids.add(activity.target_id)
            elif activity.type == ActivityType.CREATED_COMMENT and activity.target_id:
                comment_activity_ids.add(activity.target_id)
            elif activity.type == ActivityType.FOLLOWED_USER and activity.target_id:
                follow_activity_pairs.add((activity.user_id, activity.target_id))

        # Backfill discussion activities (newest first).
        result = await db.execute(
            select(Discussion).order_by(Discussion.created_at.desc()).limit(220)
        )
        for discussion in result.scalars().all():
            if discussion.id in discussion_activity_ids:
                continue
            db.add(Activity(
                user_id=discussion.author_id,
                type=ActivityType.CREATED_DISCUSSION,
                target_id=discussion.id,
                extra_data=discussion_activity_payload(discussion),
                created_at=discussion.created_at,
            ))
            discussion_activity_ids.add(discussion.id)
            activities_created += 1

        # Backfill comment activities, newest-first with per-discussion caps.
        comment_rows_result = await db.execute(
            select(Comment, Discussion)
            .join(Discussion, Comment.discussion_id == Discussion.id)
            .order_by(Comment.created_at.desc())
            .limit(900)
        )
        comment_rows = comment_rows_result.all()

        comment_activity_budget = 280
        per_discussion_budget = 4
        discussion_comment_activity_count: dict = {}
        for comment, discussion in comment_rows:
            if comment.id in comment_activity_ids:
                continue
            current_discussion_count = discussion_comment_activity_count.get(comment.discussion_id, 0)
            if current_discussion_count >= per_discussion_budget:
                continue
            db.add(Activity(
                user_id=comment.author_id,
                type=ActivityType.CREATED_COMMENT,
                target_id=comment.id,
                extra_data=comment_activity_payload(comment, discussion),
                created_at=comment.created_at,
            ))
            comment_activity_ids.add(comment.id)
            discussion_comment_activity_count[comment.discussion_id] = current_discussion_count + 1
            activities_created += 1
            comment_activity_budget -= 1
            if comment_activity_budget <= 0:
                break

        # Follow activities (older follows only to reduce Discover noise).
        result = await db.execute(select(Follow).order_by(Follow.created_at.asc()))
        all_follows = result.scalars().all()

        for follow in all_follows[:80]:
            follow_pair = (follow.follower_id, follow.following_id)
            if follow_pair in follow_activity_pairs:
                continue
            db.add(Activity(
                user_id=follow.follower_id,
                type=ActivityType.FOLLOWED_USER,
                target_id=follow.following_id,
                extra_data={
                    "followed_user_id": str(follow.following_id),
                },
                created_at=follow.created_at,
            ))
            follow_activity_pairs.add(follow_pair)
            activities_created += 1
            
            # Notification
            result_user = await db.execute(
                select(User).where(User.id == follow.follower_id)
            )
            follower = result_user.scalar_one_or_none()
            if follower:
                db.add(Notification(
                    user_id=follow.following_id,
                    type=NotificationType.FOLLOW,
                    title=f"{follower.username} followed you",
                    content=f"{follower.username} started following you",
                    actor_id=follow.follower_id,
                    target_type="user",
                    target_id=follow.following_id,
                    is_read=random.random() < 0.7,  # 70% read
                    created_at=follow.created_at,
                ))
        
        await db.commit()
        print(f"✓ Created {activities_created} additional activities")


async def seed_social_activity():
    """Main function to seed all social activity."""
    await seed_follows()
    await seed_stars()
    await seed_discussions()
    await seed_lucia_spotlight()
    await seed_community_pulse()
    await seed_additional_activities()


async def main():
    await seed_social_activity()


if __name__ == "__main__":
    asyncio.run(main())
