from uuid import UUID
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.canvas_block import CanvasBlock
from app.schemas.canvas_block import CanvasBlockCreate, CanvasBlockUpdate, CanvasBlockResponse
from app.api.deps import get_current_user, get_current_user_optional, verify_problem_access
from app.models.user import User


router = APIRouter(prefix="/problems/{problem_id}/blocks", tags=["canvas-blocks"])


@router.get("", response_model=List[CanvasBlockResponse])
async def get_blocks(
    problem_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """Get all canvas blocks for a problem."""
    await verify_problem_access(problem_id, db, current_user)
    result = await db.execute(
        select(CanvasBlock)
        .where(CanvasBlock.problem_id == problem_id)
        .order_by(CanvasBlock.created_at.desc())
    )
    blocks = result.scalars().all()
    return blocks


@router.post("", response_model=CanvasBlockResponse, status_code=status.HTTP_201_CREATED)
async def create_block(
    problem_id: UUID,
    block_data: CanvasBlockCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new canvas block."""
    await verify_problem_access(problem_id, db, current_user, require_write=True)
    block = CanvasBlock(
        problem_id=problem_id,
        name=block_data.name,
        node_ids=block_data.node_ids,
    )
    db.add(block)
    await db.commit()
    await db.refresh(block)
    return block


@router.get("/{block_id}", response_model=CanvasBlockResponse)
async def get_block(
    problem_id: UUID,
    block_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """Get a specific canvas block."""
    await verify_problem_access(problem_id, db, current_user)
    result = await db.execute(
        select(CanvasBlock)
        .where(CanvasBlock.id == block_id, CanvasBlock.problem_id == problem_id)
    )
    block = result.scalar_one_or_none()
    
    if not block:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Canvas block not found"
        )
    
    return block


@router.put("/{block_id}", response_model=CanvasBlockResponse)
async def update_block(
    problem_id: UUID,
    block_id: UUID,
    block_data: CanvasBlockUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a canvas block (rename or change node_ids)."""
    await verify_problem_access(problem_id, db, current_user, require_write=True)
    result = await db.execute(
        select(CanvasBlock)
        .where(CanvasBlock.id == block_id, CanvasBlock.problem_id == problem_id)
    )
    block = result.scalar_one_or_none()
    
    if not block:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Canvas block not found"
        )
    
    # Update fields
    block.name = block_data.name
    block.node_ids = block_data.node_ids
    
    await db.commit()
    await db.refresh(block)
    return block


@router.delete("/{block_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_block(
    problem_id: UUID,
    block_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a canvas block."""
    await verify_problem_access(problem_id, db, current_user, require_write=True)
    result = await db.execute(
        select(CanvasBlock)
        .where(CanvasBlock.id == block_id, CanvasBlock.problem_id == problem_id)
    )
    block = result.scalar_one_or_none()
    
    if not block:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Canvas block not found"
        )
    
    await db.delete(block)
    await db.commit()
