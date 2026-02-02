"""
Canvas AI API - Persistent runs, chat history, and real-time state management.
Handles background processing via Redis queue.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from datetime import datetime
from typing import Optional
from uuid import UUID

import redis.asyncio as redis
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import select, desc, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db, async_session_maker
from app.models.problem import Problem
from app.models.user import User
from app.models.canvas_ai import (
    CanvasAIRun,
    CanvasAIMessage,
    CanvasAINodeState,
    CanvasAIRunStatus,
    CanvasAIRunType,
)
from app.api.deps import get_current_user, get_current_user_optional, verify_problem_access
from app.schemas.canvas_ai import (
    CreateRunRequest,
    CreateMessageRequest,
    UpdateNodeStateRequest,
    CancelRunRequest,
    CanvasAIRunResponse,
    CanvasAIRunWithMessagesResponse,
    CanvasAIMessageResponse,
    CanvasAINodeStateResponse,
    ChatHistoryResponse,
    ActiveRunsResponse,
    RunProgressEvent,
    NodeStateEvent,
    NodeCreatedEvent,
    RunCompletedEvent,
    MessageAddedEvent,
)
from app.config import get_settings

settings = get_settings()

router = APIRouter(prefix="/api/canvas-ai", tags=["canvas-ai"])

# Redis connection
_redis_client: redis.Redis | None = None

REDIS_QUEUE_KEY = "proofmesh:canvas_ai:runs"
REDIS_PUBSUB_PREFIX = "proofmesh:canvas_ai:events:"


async def get_redis() -> redis.Redis:
    """Get or create Redis client."""
    global _redis_client
    if _redis_client is None:
        redis_url = os.environ.get("REDIS_URL", "redis://redis:6379/0")
        _redis_client = redis.from_url(redis_url, decode_responses=True)
    return _redis_client


# ==================== Run Management ====================

@router.post("/problems/{problem_id}/runs", response_model=CanvasAIRunResponse)
async def create_run(
    problem_id: UUID,
    request: CreateRunRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new AI run and queue it for background processing.
    The run will be processed by the Redis worker.
    """
    await verify_problem_access(problem_id, db, current_user)

    # Create the run
    run = CanvasAIRun(
        problem_id=problem_id,
        user_id=current_user.id,
        run_type=request.run_type.value,
        prompt=request.prompt,
        context=request.context,
        status=CanvasAIRunStatus.QUEUED.value,
        progress=0,
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)

    # Queue the run in Redis
    redis_client = await get_redis()
    job_data = {
        "run_id": str(run.id),
        "problem_id": str(problem_id),
        "user_id": str(current_user.id),
        "run_type": request.run_type.value,
        "prompt": request.prompt,
        "context": request.context,
        "created_at": datetime.utcnow().isoformat(),
    }
    await redis_client.rpush(REDIS_QUEUE_KEY, json.dumps(job_data))

    # Update run with job reference
    run.redis_job_id = f"{REDIS_QUEUE_KEY}:{run.id}"
    await db.commit()

    # Also create a user message in chat history
    user_message = CanvasAIMessage(
        problem_id=problem_id,
        run_id=run.id,
        user_id=current_user.id,
        role="user",
        content=request.prompt,
    )
    db.add(user_message)
    await db.commit()

    return run


@router.get("/problems/{problem_id}/runs", response_model=list[CanvasAIRunResponse])
async def list_runs(
    problem_id: UUID,
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_optional),
):
    """List AI runs for a problem."""
    await verify_problem_access(problem_id, db, current_user)

    query = select(CanvasAIRun).where(CanvasAIRun.problem_id == problem_id)
    
    if status:
        query = query.where(CanvasAIRun.status == status)
    
    query = query.order_by(desc(CanvasAIRun.created_at)).offset(offset).limit(limit)
    
    result = await db.execute(query)
    runs = result.scalars().all()
    
    return runs


@router.get("/problems/{problem_id}/runs/active", response_model=ActiveRunsResponse)
async def get_active_runs(
    problem_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_optional),
):
    """Get currently active (queued or running) runs for a problem."""
    await verify_problem_access(problem_id, db, current_user)

    query = select(CanvasAIRun).where(
        and_(
            CanvasAIRun.problem_id == problem_id,
            CanvasAIRun.status.in_([
                CanvasAIRunStatus.QUEUED.value,
                CanvasAIRunStatus.RUNNING.value,
            ])
        )
    ).order_by(CanvasAIRun.created_at)
    
    result = await db.execute(query)
    runs = result.scalars().all()
    
    return ActiveRunsResponse(runs=list(runs))


@router.get("/problems/{problem_id}/runs/{run_id}", response_model=CanvasAIRunWithMessagesResponse)
async def get_run(
    problem_id: UUID,
    run_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_optional),
):
    """Get a specific run with its messages."""
    await verify_problem_access(problem_id, db, current_user)

    query = select(CanvasAIRun).where(
        and_(CanvasAIRun.id == run_id, CanvasAIRun.problem_id == problem_id)
    ).options(selectinload(CanvasAIRun.messages))
    
    result = await db.execute(query)
    run = result.scalar_one_or_none()
    
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    
    return run


@router.post("/problems/{problem_id}/runs/{run_id}/cancel")
async def cancel_run(
    problem_id: UUID,
    run_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cancel a running or queued run."""
    await verify_problem_access(problem_id, db, current_user)

    query = select(CanvasAIRun).where(
        and_(CanvasAIRun.id == run_id, CanvasAIRun.problem_id == problem_id)
    )
    result = await db.execute(query)
    run = result.scalar_one_or_none()
    
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    
    if run.status not in [CanvasAIRunStatus.QUEUED.value, CanvasAIRunStatus.RUNNING.value]:
        raise HTTPException(status_code=400, detail="Run is not active")
    
    # Update status
    run.status = CanvasAIRunStatus.CANCELLED.value
    run.completed_at = datetime.utcnow()
    await db.commit()

    # Publish cancellation event
    redis_client = await get_redis()
    event = RunCompletedEvent(
        run_id=str(run_id),
        status=CanvasAIRunStatus.CANCELLED.value,
        summary="Run cancelled by user",
    )
    await redis_client.publish(
        f"{REDIS_PUBSUB_PREFIX}{problem_id}",
        json.dumps(event.model_dump())
    )
    
    return {"status": "cancelled", "run_id": str(run_id)}


# ==================== Chat History ====================

@router.get("/problems/{problem_id}/messages", response_model=ChatHistoryResponse)
async def get_chat_history(
    problem_id: UUID,
    limit: int = Query(50, ge=1, le=200),
    before: Optional[datetime] = Query(None, description="Get messages before this timestamp"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_optional),
):
    """Get chat history for a problem."""
    await verify_problem_access(problem_id, db, current_user)

    query = select(CanvasAIMessage).where(CanvasAIMessage.problem_id == problem_id)
    
    if before:
        query = query.where(CanvasAIMessage.created_at < before)
    
    # Get one more to check if there are more
    query = query.order_by(desc(CanvasAIMessage.created_at)).limit(limit + 1)
    
    result = await db.execute(query)
    messages = list(result.scalars().all())
    
    has_more = len(messages) > limit
    if has_more:
        messages = messages[:limit]
    
    # Reverse to get chronological order
    messages.reverse()
    
    # Get total count
    count_query = select(CanvasAIMessage).where(CanvasAIMessage.problem_id == problem_id)
    count_result = await db.execute(count_query)
    total = len(list(count_result.scalars().all()))
    
    return ChatHistoryResponse(
        messages=messages,
        total=total,
        has_more=has_more,
    )


@router.post("/problems/{problem_id}/messages", response_model=CanvasAIMessageResponse)
async def create_message(
    problem_id: UUID,
    request: CreateMessageRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a chat message (usually for user messages)."""
    await verify_problem_access(problem_id, db, current_user)

    message = CanvasAIMessage(
        problem_id=problem_id,
        run_id=request.run_id,
        user_id=current_user.id,
        role=request.role,
        content=request.content,
        message_data=request.message_data,
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)

    # Publish message event
    redis_client = await get_redis()
    event = MessageAddedEvent(message=CanvasAIMessageResponse.model_validate(message))
    await redis_client.publish(
        f"{REDIS_PUBSUB_PREFIX}{problem_id}",
        json.dumps(event.model_dump(), default=str)
    )
    
    return message


# ==================== Node States ====================

@router.get("/problems/{problem_id}/node-states", response_model=list[CanvasAINodeStateResponse])
async def get_node_states(
    problem_id: UUID,
    run_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_optional),
):
    """Get current node states for visualization."""
    await verify_problem_access(problem_id, db, current_user)

    # Get active runs for this problem
    if run_id:
        run_ids = [run_id]
    else:
        runs_query = select(CanvasAIRun.id).where(
            and_(
                CanvasAIRun.problem_id == problem_id,
                CanvasAIRun.status.in_([
                    CanvasAIRunStatus.QUEUED.value,
                    CanvasAIRunStatus.RUNNING.value,
                ])
            )
        )
        runs_result = await db.execute(runs_query)
        run_ids = [r for r in runs_result.scalars().all()]

    if not run_ids:
        return []

    query = select(CanvasAINodeState).where(
        CanvasAINodeState.run_id.in_(run_ids)
    )
    result = await db.execute(query)
    states = result.scalars().all()
    
    return list(states)


# ==================== WebSocket for Real-time Updates ====================

@router.websocket("/problems/{problem_id}/ws")
async def canvas_ai_websocket(
    websocket: WebSocket,
    problem_id: UUID,
):
    """WebSocket for real-time Canvas AI updates.
    
    Note: We don't use Depends(get_db) here because WebSockets are long-lived
    and would exhaust the connection pool. Instead, we create short-lived sessions.
    """
    await websocket.accept()
    
    redis_client = await get_redis()
    pubsub = redis_client.pubsub()
    channel = f"{REDIS_PUBSUB_PREFIX}{problem_id}"
    
    try:
        await pubsub.subscribe(channel)
        
        # Send current active runs on connect (use short-lived session)
        async with async_session_maker() as db:
            runs_query = select(CanvasAIRun).where(
                and_(
                    CanvasAIRun.problem_id == problem_id,
                    CanvasAIRun.status.in_([
                        CanvasAIRunStatus.QUEUED.value,
                        CanvasAIRunStatus.RUNNING.value,
                    ])
                )
            )
            runs_result = await db.execute(runs_query)
            active_runs = runs_result.scalars().all()
            
            for run in active_runs:
                await websocket.send_json({
                    "event_type": "active_run",
                    "run": CanvasAIRunResponse.model_validate(run).model_dump(mode="json"),
                })
        # Session is now closed, pool connection returned
        
        # Listen for Redis events
        async def listen_redis():
            async for message in pubsub.listen():
                if message["type"] == "message":
                    try:
                        data = json.loads(message["data"])
                        await websocket.send_json(data)
                    except json.JSONDecodeError:
                        pass
        
        # Listen for WebSocket messages (keep-alive, etc.)
        async def listen_websocket():
            try:
                while True:
                    data = await websocket.receive_text()
                    # Handle ping/pong or other client messages
                    if data == "ping":
                        await websocket.send_text("pong")
            except WebSocketDisconnect:
                pass
        
        # Run both listeners
        await asyncio.gather(
            listen_redis(),
            listen_websocket(),
            return_exceptions=True,
        )
        
    except WebSocketDisconnect:
        pass
    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.close()


# ==================== Reasoning Traces ====================

@router.get("/runs/{run_id}/reasoning-traces")
async def get_reasoning_traces(
    run_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_optional),
):
    """
    Get the reasoning traces for a run.
    Returns the step-by-step reasoning visible to users.
    """
    from sqlalchemy import text
    
    # Verify run exists
    result = await db.execute(select(CanvasAIRun).where(CanvasAIRun.id == run_id))
    run = result.scalar_one_or_none()
    
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    
    # Get traces
    traces_sql = text("""
        SELECT id, step_number, step_type, content, 
               kg_nodes_used, agent_name, agent_type,
               started_at, completed_at, duration_ms, extra_data
        FROM reasoning_traces
        WHERE run_id = :run_id
        ORDER BY step_number ASC
    """)
    
    traces_result = await db.execute(traces_sql, {"run_id": run_id})
    traces = traces_result.fetchall()
    
    return {
        "run_id": str(run_id),
        "traces": [
            {
                "id": str(t.id),
                "step_number": t.step_number,
                "step_type": t.step_type,
                "content": t.content,
                "kg_nodes_used": t.kg_nodes_used or [],
                "agent_name": t.agent_name,
                "agent_type": t.agent_type,
                "started_at": t.started_at.isoformat() if t.started_at else None,
                "completed_at": t.completed_at.isoformat() if t.completed_at else None,
                "duration_ms": t.duration_ms,
                "extra_data": t.extra_data
            }
            for t in traces
        ]
    }


@router.websocket("/runs/{run_id}/stream")
async def stream_reasoning(
    websocket: WebSocket,
    run_id: UUID,
):
    """
    WebSocket for streaming reasoning chunks in real-time.
    
    Subscribes to the run's stream channel and forwards all chunks.
    """
    await websocket.accept()
    
    redis_client = await get_redis()
    pubsub = redis_client.pubsub()
    channel = f"proofmesh:canvas_ai:stream:{run_id}"
    
    try:
        await pubsub.subscribe(channel)
        
        # Listen for streaming chunks
        async def listen_redis():
            async for message in pubsub.listen():
                if message["type"] == "message":
                    try:
                        data = json.loads(message["data"])
                        await websocket.send_json(data)
                        
                        # If chunk indicates completion, we can close
                        if data.get("is_complete"):
                            break
                    except json.JSONDecodeError:
                        pass
        
        # Listen for WebSocket messages
        async def listen_websocket():
            try:
                while True:
                    data = await websocket.receive_text()
                    if data == "ping":
                        await websocket.send_text("pong")
            except WebSocketDisconnect:
                pass
        
        await asyncio.gather(
            listen_redis(),
            listen_websocket(),
            return_exceptions=True,
        )
        
    except WebSocketDisconnect:
        pass
    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.close()
