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


def sanitize_project_title(title: str) -> str:
    """Keep project token syntax stable even with unusual characters in titles."""
    return title.replace("[", "").replace("]", "").replace("|", "/").strip()


def project_token(problem: Problem) -> str:
    """Format project reference token used by frontend rich renderer."""
    return f"[[project:{problem.id}|{sanitize_project_title(problem.title)}]]"


def user_mention(user: User) -> str:
    """Format user mention token used by frontend rich renderer."""
    return f"@{user.username}"


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


async def seed_additional_activities():
    """Create additional activity records for various actions."""
    async with async_session_maker() as db:
        result = await db.execute(select(User))
        all_users = result.scalars().all()
        
        result = await db.execute(select(Problem))
        all_problems = result.scalars().all()
        
        result = await db.execute(select(Star))
        all_stars = result.scalars().all()
        
        if not all_users or not all_problems:
            print("⚠ Need users and problems first")
            return
        
        print(f"Creating additional activity records...")
        
        activities_created = 0
        
        # Follow activities
        result = await db.execute(select(Follow))
        all_follows = result.scalars().all()
        
        for follow in all_follows[:200]:  # Limit
            db.add(Activity(
                user_id=follow.follower_id,
                type=ActivityType.FOLLOWED_USER,
                target_id=follow.following_id,
                extra_data={
                    "followed_user_id": str(follow.following_id),
                },
                created_at=follow.created_at,
            ))
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
    await seed_additional_activities()


async def main():
    await seed_social_activity()


if __name__ == "__main__":
    asyncio.run(main())
