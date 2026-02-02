from __future__ import annotations

import uuid
from uuid import UUID
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import APIRouter, Depends, HTTPException, Query

from app.database import get_db
from app.models.user import User
from app.api.deps import get_current_user_optional, verify_problem_access
from app.models.latex_ai import LatexAIMemory, LatexAIMessage, LatexAIQuickAction, LatexAIRun
from app.schemas.latex_ai_store import (
    LatexAIMemoryResponse,
    LatexAIMemoryUpdate,
    LatexAIQuickActionCreate,
    LatexAIQuickActionResponse,
    LatexAIMessageCreate,
    LatexAIMessageResponse,
    LatexAIRunCreate,
    LatexAIRunResponse,
    LatexAIRunUpdate,
    LatexAIRunAppendStep,
    LatexAIRunAppendEdit,
)


router = APIRouter(prefix="/api/latex-ai", tags=["latex-ai-store"])


@router.get("/{problem_id}/memory", response_model=LatexAIMemoryResponse)
async def get_memory(
    problem_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    await verify_problem_access(problem_id, db, current_user)
    result = await db.execute(select(LatexAIMemory).where(LatexAIMemory.problem_id == problem_id))
    memory = result.scalar_one_or_none()
    return LatexAIMemoryResponse(memory=memory.memory if memory else None)


@router.put("/{problem_id}/memory", response_model=LatexAIMemoryResponse)
async def update_memory(
    problem_id: UUID,
    payload: LatexAIMemoryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    await verify_problem_access(problem_id, db, current_user)
    result = await db.execute(select(LatexAIMemory).where(LatexAIMemory.problem_id == problem_id))
    memory = result.scalar_one_or_none()
    if memory is None:
        memory = LatexAIMemory(problem_id=problem_id, memory=payload.memory)
        db.add(memory)
    else:
        memory.memory = payload.memory
    await db.commit()
    await db.refresh(memory)
    return LatexAIMemoryResponse(memory=memory.memory)


@router.get("/{problem_id}/actions", response_model=list[LatexAIQuickActionResponse])
async def list_actions(
    problem_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    await verify_problem_access(problem_id, db, current_user)
    result = await db.execute(select(LatexAIQuickAction).where(LatexAIQuickAction.problem_id == problem_id))
    return [LatexAIQuickActionResponse(**item.__dict__) for item in result.scalars().all()]


@router.post("/{problem_id}/actions", response_model=LatexAIQuickActionResponse)
async def create_action(
    problem_id: UUID,
    payload: LatexAIQuickActionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    await verify_problem_access(problem_id, db, current_user)
    action = LatexAIQuickAction(problem_id=problem_id, label=payload.label, prompt=payload.prompt)
    db.add(action)
    await db.commit()
    await db.refresh(action)
    return LatexAIQuickActionResponse(**action.__dict__)


@router.delete("/{problem_id}/actions/{action_id}")
async def delete_action(
    problem_id: UUID,
    action_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    await verify_problem_access(problem_id, db, current_user)
    await db.execute(delete(LatexAIQuickAction).where(LatexAIQuickAction.id == action_id, LatexAIQuickAction.problem_id == problem_id))
    await db.commit()
    return {"status": "deleted"}


@router.get("/{problem_id}/messages", response_model=list[LatexAIMessageResponse])
async def list_messages(
    problem_id: UUID,
    limit: int = Query(default=200, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    await verify_problem_access(problem_id, db, current_user)
    result = await db.execute(
        select(LatexAIMessage).where(LatexAIMessage.problem_id == problem_id).order_by(LatexAIMessage.created_at.asc()).limit(limit)
    )
    return [LatexAIMessageResponse(**item.__dict__) for item in result.scalars().all()]


@router.post("/{problem_id}/messages", response_model=LatexAIMessageResponse)
async def create_message(
    problem_id: UUID,
    payload: LatexAIMessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    await verify_problem_access(problem_id, db, current_user)
    msg = LatexAIMessage(problem_id=problem_id, role=payload.role, content=payload.content, run_id=payload.run_id)
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return LatexAIMessageResponse(**msg.__dict__)


@router.delete("/{problem_id}/messages")
async def delete_messages(
    problem_id: UUID,
    scope: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    await verify_problem_access(problem_id, db, current_user)
    query = delete(LatexAIMessage).where(LatexAIMessage.problem_id == problem_id)
    if scope == "temp":
        query = query.where(LatexAIMessage.run_id.is_(None))
    await db.execute(query)
    await db.commit()
    return {"status": "deleted"}


@router.get("/{problem_id}/runs", response_model=list[LatexAIRunResponse])
async def list_runs(
    problem_id: UUID,
    status: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    await verify_problem_access(problem_id, db, current_user)
    query = select(LatexAIRun).where(LatexAIRun.problem_id == problem_id)
    if status is not None:
        query = query.where(LatexAIRun.status == status)
    
    query = query.order_by(LatexAIRun.created_at.desc()).limit(limit)
    result = await db.execute(query)
    return [LatexAIRunResponse(**item.__dict__) for item in result.scalars().all()]


@router.post("/{problem_id}/runs", response_model=LatexAIRunResponse)
async def create_run(
    problem_id: UUID,
    payload: LatexAIRunCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    await verify_problem_access(problem_id, db, current_user)
    run = LatexAIRun(
        problem_id=problem_id,
        prompt=payload.prompt,
        file_path=payload.file_path,
        selection=payload.selection,
        steps=[],
        edits=[],
        status="pending",
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)
    return LatexAIRunResponse(**run.__dict__)


@router.patch("/{problem_id}/runs/{run_id}", response_model=LatexAIRunResponse)
async def update_run(
    problem_id: UUID,
    run_id: UUID,
    payload: LatexAIRunUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    await verify_problem_access(problem_id, db, current_user)
    result = await db.execute(select(LatexAIRun).where(LatexAIRun.id == run_id, LatexAIRun.problem_id == problem_id))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    
    if payload.summary is not None:
        run.summary = payload.summary
    if payload.status is not None:
        run.status = payload.status
        
    await db.commit()
    await db.refresh(run)
    return LatexAIRunResponse(**run.__dict__)


@router.delete("/{problem_id}/runs/{run_id}")
async def delete_run(
    problem_id: UUID,
    run_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    await verify_problem_access(problem_id, db, current_user)
    await db.execute(delete(LatexAIRun).where(LatexAIRun.id == run_id, LatexAIRun.problem_id == problem_id))
    await db.commit()
    return {"status": "deleted"}


@router.post("/{problem_id}/runs/{run_id}/step", response_model=LatexAIRunResponse)
async def append_step(
    problem_id: UUID,
    run_id: UUID,
    payload: LatexAIRunAppendStep,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    await verify_problem_access(problem_id, db, current_user)
    result = await db.execute(select(LatexAIRun).where(LatexAIRun.id == run_id, LatexAIRun.problem_id == problem_id))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    run.steps = (run.steps or []) + [payload.text]
    await db.commit()
    await db.refresh(run)
    return LatexAIRunResponse(**run.__dict__)


@router.post("/{problem_id}/runs/{run_id}/edit", response_model=LatexAIRunResponse)
async def append_edit(
    problem_id: UUID,
    run_id: UUID,
    payload: LatexAIRunAppendEdit,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    await verify_problem_access(problem_id, db, current_user)
    result = await db.execute(select(LatexAIRun).where(LatexAIRun.id == run_id, LatexAIRun.problem_id == problem_id))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    run.edits = (run.edits or []) + [
        {"start": payload.start, "end": payload.end, "text": payload.text}
    ]
    await db.commit()
    await db.refresh(run)
    return LatexAIRunResponse(**run.__dict__)
