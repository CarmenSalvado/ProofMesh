"""
Seed social activity - follows, stars, discussions, comments, activities, notifications.
"""
import asyncio
import random
from datetime import datetime, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_maker
from app.models.user import User
from app.models.problem import Problem
from app.models.library_item import LibraryItem
from app.models.follow import Follow
from app.models.star import Star, StarTargetType
from app.models.discussion import Discussion
from app.models.comment import Comment
from app.models.activity import Activity, ActivityType
from app.models.notification import Notification, NotificationType


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

LUCIA_REACTION_COMMENTS = [
    "Great thread {}. Your framing clarifies the bottleneck.",
    "Strong point, {}. I think the key extension is in the compactness step.",
    "Reacting to {}: the strategy looks promising, especially around the boundary case.",
    "{} this is one of the clearest discussion threads on the topic.",
    "I tested your idea, {}. It seems to hold in the key subcase.",
    "Following up on {} with a possible refinement of the final lemma.",
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


def random_past_time(days_ago_max: int, days_ago_min: int = 0) -> datetime:
    """Generate a random datetime between days_ago_min and days_ago_max days ago."""
    days = random.randint(days_ago_min, days_ago_max)
    hours = random.randint(0, 23)
    minutes = random.randint(0, 59)
    return datetime.utcnow() - timedelta(days=days, hours=hours, minutes=minutes)


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
        # Check existing
        result = await db.execute(select(Star))
        existing = result.scalars().all()
        if len(existing) > 100:
            print(f"✓ Already have {len(existing)} stars, skipping")
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
        
        print(f"Creating stars...")
        
        stars_created = 0
        
        # Each user stars 3-15 problems
        for user in all_users:
            min_problem_stars = 1 if len(all_problems) < 3 else 3
            max_problem_stars = min(15, len(all_problems))
            num_problem_stars = random.randint(min_problem_stars, max_problem_stars)
            starred_problems = random.sample(all_problems, k=num_problem_stars)
            
            for problem in starred_problems:
                db.add(Star(
                    user_id=user.id,
                    target_type=StarTargetType.PROBLEM,
                    target_id=problem.id,
                    created_at=random_past_time(200, 5),
                ))
                stars_created += 1
            
            # 30% of users star some library items
            if all_items and random.random() < 0.3:
                num_item_stars = random.randint(1, min(5, len(all_items)))
                starred_items = random.sample(all_items, k=num_item_stars)
                
                for item in starred_items:
                    db.add(Star(
                        user_id=user.id,
                        target_type=StarTargetType.LIBRARY_ITEM,
                        target_id=item.id,
                        created_at=random_past_time(150, 5),
                    ))
                    stars_created += 1
        
        await db.commit()
        print(f"✓ Created {stars_created} stars")


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
    """Ensure Lucia Mora is the central profile in seeded social activity."""
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

        print("Boosting Lucia-centered social activity...")

        # 1) Ensure Lucia has many followers.
        result = await db.execute(select(Follow).where(Follow.following_id == lucia.id))
        existing_lucia_follows = result.scalars().all()
        existing_follower_ids = {follow.follower_id for follow in existing_lucia_follows}

        target_followers = min(len(other_users), max(20, int(len(other_users) * 0.75)))
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

        # 2) Ensure Lucia has enough authored discussions.
        result = await db.execute(select(Discussion).where(Discussion.author_id == lucia.id))
        lucia_discussions = result.scalars().all()

        target_lucia_discussions = min(24, max(12, len(all_problems) // 4))
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

        # 3) Ensure many reaction threads mention Lucia.
        result = await db.execute(select(Discussion))
        all_discussions = result.scalars().all()
        existing_reaction_threads = [
            discussion for discussion in all_discussions
            if discussion.author_id != lucia.id and user_mention(lucia) in discussion.content
        ]

        target_reaction_threads = min(30, max(10, len(all_problems) // 3))
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

        # 4) Ensure Lucia discussions have many comments and stars from others.
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
            target_comments = random.randint(12, 24)
            missing_comments = max(0, target_comments - len(current_comments))

            for _ in range(missing_comments):
                commenter = random.choice(other_users)
                comment_created_at = discussion.created_at + timedelta(
                    hours=random.randint(1, 72),
                    minutes=random.randint(0, 59),
                )
                comment_text = random.choice(LUCIA_REACTION_COMMENTS).format(user_mention(lucia))
                if random.random() < 0.7:
                    comment_text += f" {project_token(random.choice(all_problems))}"

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
            target_stars = min(len(other_users), random.randint(10, min(35, len(other_users))))
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
        print(f"✓ Lucia discussions ensured (+{created_lucia_discussions})")
        print(f"✓ Lucia reaction threads ensured (+{created_reaction_threads})")
        print(f"✓ Lucia discussion comments added (+{comments_added})")
        print(f"✓ Lucia discussion stars added (+{stars_added})")


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

        # Backfill comment activities, prioritizing comments on Lucia's threads.
        lucia_discussion_ids = set()
        lucia_user_result = await db.execute(select(User).where(User.username == LUCIA_USERNAME))
        lucia = lucia_user_result.scalar_one_or_none()
        if lucia:
            lucia_disc_result = await db.execute(
                select(Discussion.id).where(Discussion.author_id == lucia.id)
            )
            lucia_discussion_ids = {row[0] for row in lucia_disc_result.all()}

        comment_rows_result = await db.execute(
            select(Comment, Discussion)
            .join(Discussion, Comment.discussion_id == Discussion.id)
            .order_by(Comment.created_at.desc())
            .limit(900)
        )
        comment_rows = comment_rows_result.all()
        comment_rows.sort(
            key=lambda row: (
                row[0].discussion_id in lucia_discussion_ids,
                row[0].created_at,
            ),
            reverse=True,
        )

        comment_activity_budget = 420
        for comment, discussion in comment_rows:
            if comment.id in comment_activity_ids:
                continue
            db.add(Activity(
                user_id=comment.author_id,
                type=ActivityType.CREATED_COMMENT,
                target_id=comment.id,
                extra_data=comment_activity_payload(comment, discussion),
                created_at=comment.created_at,
            ))
            comment_activity_ids.add(comment.id)
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
    await seed_additional_activities()


async def main():
    await seed_social_activity()


if __name__ == "__main__":
    asyncio.run(main())
