"""Star/bookmark functionality endpoints."""

from __future__ import annotations

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.star import Star, StarTargetType
from app.api.deps import get_current_user
from app.schemas.social import StarCreate, StarResponse, StarListResponse

router = APIRouter()


@router.post("/stars", response_model=StarResponse)
async def create_star(
    data: StarCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Star a problem, library item, or discussion."""
    target_type_enum = StarTargetType(data.target_type)
    
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
