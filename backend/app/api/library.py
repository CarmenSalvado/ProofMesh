from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.problem import Problem, ProblemVisibility
from app.models.library_item import LibraryItem, LibraryItemStatus, LibraryItemKind
from app.models.user import User
from app.api.deps import get_current_user, get_current_user_optional
from app.schemas.library_item import (
    LibraryItemCreate,
    LibraryItemUpdate,
    LibraryItemResponse,
    LibraryItemListResponse,
)

router = APIRouter(prefix="/api/problems/{problem_id}/library", tags=["library"])


async def verify_problem_access(
    problem_id: UUID,
    db: AsyncSession,
    current_user: User | None,
    require_owner: bool = False,
) -> Problem:
    """Verify user has access to problem"""
    result = await db.execute(
        select(Problem).where(Problem.id == problem_id)
    )
    problem = result.scalar_one_or_none()
    
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    
    if problem.visibility == ProblemVisibility.PRIVATE:
        if not current_user or problem.author_id != current_user.id:
            raise HTTPException(status_code=404, detail="Problem not found")
    
    if require_owner and (not current_user or problem.author_id != current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return problem


@router.get("", response_model=LibraryItemListResponse)
async def list_library_items(
    problem_id: UUID,
    kind: LibraryItemKind | None = None,
    status: LibraryItemStatus | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """List all library items for a problem with optional filters"""
    await verify_problem_access(problem_id, db, current_user)
    
    query = select(LibraryItem).where(LibraryItem.problem_id == problem_id)
    
    if kind:
        query = query.where(LibraryItem.kind == kind)
    if status:
        query = query.where(LibraryItem.status == status)
    
    query = query.order_by(LibraryItem.created_at.desc())
    result = await db.execute(query)
    items = result.scalars().all()
    
    return LibraryItemListResponse(items=items, total=len(items))


@router.post("", response_model=LibraryItemResponse, status_code=201)
async def create_library_item(
    problem_id: UUID,
    data: LibraryItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Publish a new item to the library"""
    await verify_problem_access(problem_id, db, current_user, require_owner=True)
    
    # Add current user as author if not specified
    authors = [a.model_dump() for a in data.authors]
    if not authors:
        authors = [{"type": "human", "id": str(current_user.id), "name": current_user.username}]
    
    item = LibraryItem(
        problem_id=problem_id,
        title=data.title,
        kind=data.kind,
        content=data.content,
        formula=data.formula,
        status=LibraryItemStatus.PROPOSED,
        authors=authors,
        source=data.source.model_dump() if data.source else None,
        dependencies=data.dependencies,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.get("/{item_id}", response_model=LibraryItemResponse)
async def get_library_item(
    problem_id: UUID,
    item_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """Get a library item by ID"""
    await verify_problem_access(problem_id, db, current_user)
    
    result = await db.execute(
        select(LibraryItem).where(
            LibraryItem.id == item_id, LibraryItem.problem_id == problem_id
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Library item not found")
    return item


@router.patch("/{item_id}", response_model=LibraryItemResponse)
async def update_library_item(
    problem_id: UUID,
    item_id: UUID,
    data: LibraryItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a library item (content, status, verification)"""
    await verify_problem_access(problem_id, db, current_user, require_owner=True)
    
    result = await db.execute(
        select(LibraryItem).where(
            LibraryItem.id == item_id, LibraryItem.problem_id == problem_id
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Library item not found")
    
    # Status can only become VERIFIED with verification info
    if data.status == LibraryItemStatus.VERIFIED and not data.verification:
        if not item.verification:
            raise HTTPException(
                status_code=400,
                detail="Cannot verify without verification info",
            )
    
    if data.title is not None:
        item.title = data.title
    if data.content is not None:
        item.content = data.content
    if data.formula is not None:
        item.formula = data.formula
    if data.status is not None:
        item.status = data.status
    if data.verification is not None:
        item.verification = data.verification.model_dump()
    
    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=204)
async def delete_library_item(
    problem_id: UUID,
    item_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a library item (owner only)"""
    await verify_problem_access(problem_id, db, current_user, require_owner=True)
    
    result = await db.execute(
        select(LibraryItem).where(
            LibraryItem.id == item_id, LibraryItem.problem_id == problem_id
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Library item not found")
    
    await db.delete(item)
    await db.commit()
