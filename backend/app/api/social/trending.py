"""Trending problems and platform statistics endpoints."""

from __future__ import annotations

import math
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.problem import Problem, ProblemVisibility
from app.models.library_item import LibraryItem, LibraryItemStatus
from app.models.activity import Activity
from app.models.star import Star, StarTargetType
from app.schemas.social import SocialUser, TrendingProblem, TrendingResponse, PlatformStats

router = APIRouter()


@router.get("/trending", response_model=TrendingResponse)
async def get_trending_problems(
    limit: int = Query(default=10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Get trending problems based on recent activity and library items."""
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    
    problems_query = (
        select(Problem)
        .options(selectinload(Problem.author))
        .where(Problem.visibility == ProblemVisibility.PUBLIC)
    )
    result = await db.execute(problems_query)
    problems = result.scalars().all()
    
    problem_scores = []
    for problem in problems:
        stars_result = await db.execute(
            select(func.count(Star.id)).where(
                Star.target_type == StarTargetType.PROBLEM,
                Star.target_id == problem.id,
            )
        )
        star_count = stars_result.scalar() or 0
        
        activity_result = await db.execute(
            select(func.count(Activity.id)).where(
                Activity.target_id == problem.id,
                Activity.created_at >= seven_days_ago,
            )
        )
        recent_activity = activity_result.scalar() or 0
        
        lib_result = await db.execute(
            select(func.count(LibraryItem.id)).where(
                LibraryItem.problem_id == problem.id,
            )
        )
        lib_count = lib_result.scalar() or 0
        
        star_signal = math.sqrt(star_count) * 2.2
        score = recent_activity * 5 + lib_count * 1.2 + star_signal

        trend_label = None
        if recent_activity >= 5:
            trend_label = "Hot"
        elif star_count >= 20:
            trend_label = "Rising"
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
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    users_result = await db.execute(select(func.count(User.id)))
    total_users = users_result.scalar() or 0
    
    problems_result = await db.execute(
        select(func.count(Problem.id)).where(
            Problem.visibility == ProblemVisibility.PUBLIC
        )
    )
    total_problems = problems_result.scalar() or 0
    
    verified_result = await db.execute(
        select(func.count(LibraryItem.id)).where(
            LibraryItem.status == LibraryItemStatus.VERIFIED
        )
    )
    total_verified = verified_result.scalar() or 0
    
    total_discussions = 0
    
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
