from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.problem import Problem, ProblemVisibility
from app.models.canvas import Canvas, CanvasStatus
from app.models.user import User
from app.api.deps import get_current_user, get_current_user_optional
from app.schemas.canvas import (
    CanvasCreate,
    CanvasUpdate,
    CanvasResponse,
    CanvasListResponse,
    CanvasBriefResponse,
)

router = APIRouter(prefix="/api/problems/{problem_id}/canvases", tags=["canvases"])


async def verify_problem_access(
    problem_id: UUID,
    db: AsyncSession,
    current_user: User | None,
    require_owner: bool = False,
) -> Problem:
    """Verify user has access to problem"""
    result = await db.execute(
        select(Problem)
        .options(selectinload(Problem.author))
        .where(Problem.id == problem_id)
    )
    problem = result.scalar_one_or_none()
    
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    
    # Check visibility
    if problem.visibility == ProblemVisibility.PRIVATE:
        if not current_user or problem.author_id != current_user.id:
            raise HTTPException(status_code=404, detail="Problem not found")
    
    if require_owner and (not current_user or problem.author_id != current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return problem


@router.get("", response_model=CanvasListResponse)
async def list_canvases(
    problem_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """List all canvases for a problem (brief, without content)"""
    await verify_problem_access(problem_id, db, current_user)
    
    result = await db.execute(
        select(Canvas)
        .where(Canvas.problem_id == problem_id)
        .order_by(Canvas.updated_at.desc())
    )
    canvases = result.scalars().all()
    
    # Return brief responses (without content)
    brief_canvases = [
        CanvasResponse(
            id=c.id,
            problem_id=c.problem_id,
            title=c.title,
            content=c.content[:200] + "..." if len(c.content) > 200 else c.content,
            status=c.status,
            created_at=c.created_at,
            updated_at=c.updated_at,
        )
        for c in canvases
    ]
    
    return CanvasListResponse(canvases=brief_canvases, total=len(canvases))


@router.post("", response_model=CanvasResponse, status_code=201)
async def create_canvas(
    problem_id: UUID,
    data: CanvasCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new canvas for a problem (owner only)"""
    await verify_problem_access(problem_id, db, current_user, require_owner=True)
    
    canvas = Canvas(
        problem_id=problem_id,
        title=data.title,
        content=data.content or "",
        status=CanvasStatus.DRAFT,
    )
    db.add(canvas)
    await db.commit()
    await db.refresh(canvas)
    
    return CanvasResponse(
        id=canvas.id,
        problem_id=canvas.problem_id,
        title=canvas.title,
        content=canvas.content,
        status=canvas.status,
        created_at=canvas.created_at,
        updated_at=canvas.updated_at,
    )


@router.get("/{canvas_id}", response_model=CanvasResponse)
async def get_canvas(
    problem_id: UUID,
    canvas_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """Get a canvas by ID (full content)"""
    await verify_problem_access(problem_id, db, current_user)
    
    result = await db.execute(
        select(Canvas).where(Canvas.id == canvas_id, Canvas.problem_id == problem_id)
    )
    canvas = result.scalar_one_or_none()
    
    if not canvas:
        raise HTTPException(status_code=404, detail="Canvas not found")
    
    return CanvasResponse(
        id=canvas.id,
        problem_id=canvas.problem_id,
        title=canvas.title,
        content=canvas.content,
        status=canvas.status,
        created_at=canvas.created_at,
        updated_at=canvas.updated_at,
    )


@router.patch("/{canvas_id}", response_model=CanvasResponse)
async def update_canvas(
    problem_id: UUID,
    canvas_id: UUID,
    data: CanvasUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a canvas (owner only)"""
    await verify_problem_access(problem_id, db, current_user, require_owner=True)
    
    result = await db.execute(
        select(Canvas).where(Canvas.id == canvas_id, Canvas.problem_id == problem_id)
    )
    canvas = result.scalar_one_or_none()
    
    if not canvas:
        raise HTTPException(status_code=404, detail="Canvas not found")
    
    if data.title is not None:
        canvas.title = data.title
    if data.content is not None:
        canvas.content = data.content
    if data.status is not None:
        canvas.status = data.status
    
    await db.commit()
    await db.refresh(canvas)
    
    return CanvasResponse(
        id=canvas.id,
        problem_id=canvas.problem_id,
        title=canvas.title,
        content=canvas.content,
        status=canvas.status,
        created_at=canvas.created_at,
        updated_at=canvas.updated_at,
    )


@router.delete("/{canvas_id}", status_code=204)
async def delete_canvas(
    problem_id: UUID,
    canvas_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a canvas (owner only)"""
    await verify_problem_access(problem_id, db, current_user, require_owner=True)
    
    result = await db.execute(
        select(Canvas).where(Canvas.id == canvas_id, Canvas.problem_id == problem_id)
    )
    canvas = result.scalar_one_or_none()
    
    if not canvas:
        raise HTTPException(status_code=404, detail="Canvas not found")
    
    await db.delete(canvas)
    await db.commit()
