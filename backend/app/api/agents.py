from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.canvas import Canvas
from app.models.canvas_line import CanvasLine
from app.models.agent_run import AgentRun, AgentRunStatus
from app.models.library_item import LibraryItem, LibraryItemStatus
from app.schemas.agent_run import AgentRunCreate, AgentRunResponse

router = APIRouter(prefix="/api/canvases/{canvas_id}/agents", tags=["agents"])


@router.get("/runs", response_model=list[AgentRunResponse])
async def list_agent_runs(canvas_id: UUID, db: AsyncSession = Depends(get_db)):
    """List all agent runs for a canvas"""
    result = await db.execute(
        select(AgentRun)
        .where(AgentRun.canvas_id == canvas_id)
        .order_by(AgentRun.created_at.desc())
    )
    return result.scalars().all()


@router.post("/runs", response_model=AgentRunResponse, status_code=201)
async def create_agent_run(
    canvas_id: UUID, data: AgentRunCreate, db: AsyncSession = Depends(get_db)
):
    """Start a new agent run for the canvas"""
    # Get canvas with lines
    result = await db.execute(
        select(Canvas)
        .where(Canvas.id == canvas_id)
        .options(selectinload(Canvas.lines), selectinload(Canvas.problem))
    )
    canvas = result.scalar_one_or_none()
    if not canvas:
        raise HTTPException(status_code=404, detail="Canvas not found")
    
    # Build input context (problem + canvas snapshot)
    input_context = {
        "problem": {
            "id": str(canvas.problem.id),
            "title": canvas.problem.title,
            "description": canvas.problem.description,
        },
        "canvas": {
            "id": str(canvas.id),
            "title": canvas.title,
            "lines": [
                {
                    "id": str(line.id),
                    "type": line.type.value,
                    "content": line.content,
                    "author_type": line.author_type.value,
                }
                for line in sorted(canvas.lines, key=lambda l: l.order_key)
            ],
        },
    }
    
    # Get library items for context
    library_result = await db.execute(
        select(LibraryItem).where(LibraryItem.problem_id == canvas.problem.id)
    )
    library_items = library_result.scalars().all()
    input_context["library"] = [
        {
            "id": str(item.id),
            "title": item.title,
            "kind": item.kind.value,
            "status": item.status.value,
            "content": item.content[:500],  # Truncate for context
        }
        for item in library_items
    ]
    
    run = AgentRun(
        canvas_id=canvas_id,
        status=AgentRunStatus.QUEUED,
        input_context=input_context,
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)
    
    # TODO: Dispatch to agent runner (Redis queue or background task)
    
    return run


@router.get("/runs/{run_id}", response_model=AgentRunResponse)
async def get_agent_run(
    canvas_id: UUID, run_id: UUID, db: AsyncSession = Depends(get_db)
):
    """Get an agent run by ID"""
    result = await db.execute(
        select(AgentRun).where(
            AgentRun.id == run_id, AgentRun.canvas_id == canvas_id
        )
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Agent run not found")
    return run


@router.post("/runs/{run_id}/publish", status_code=201)
async def publish_proposals(
    canvas_id: UUID, run_id: UUID, db: AsyncSession = Depends(get_db)
):
    """
    Publish agent proposals to the library.
    Per CLAUDE.md: Agents ALWAYS publish their discoveries (as proposed).
    This is called after a run completes.
    """
    result = await db.execute(
        select(AgentRun)
        .where(AgentRun.id == run_id, AgentRun.canvas_id == canvas_id)
        .options(selectinload(AgentRun.canvas))
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Agent run not found")
    
    if run.status != AgentRunStatus.DONE:
        raise HTTPException(status_code=400, detail="Agent run not complete")
    
    if not run.output or "publish" not in run.output:
        return {"published": 0}
    
    published_ids = []
    for proposal in run.output["publish"]:
        item = LibraryItem(
            problem_id=run.canvas.problem_id,
            title=proposal["title"],
            kind=proposal["kind"],
            content=proposal["content_markdown"],
            status=LibraryItemStatus.PROPOSED,
            authors=[{"type": "agent", "id": str(run.id)}],
            source={"agent_run_id": str(run.id)},
            dependencies=proposal.get("dependencies", []),
        )
        db.add(item)
        await db.flush()
        published_ids.append(str(item.id))
    
    await db.commit()
    return {"published": len(published_ids), "ids": published_ids}
