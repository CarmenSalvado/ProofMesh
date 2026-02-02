"""
Canvas AI Worker - Background processing of AI runs via Redis queue.
This worker processes exploration, formalization, verification tasks.
Runs as a separate process and can be scaled horizontally.

Features:
- Streaming reasoning chains visible in real-time
- Knowledge Graph integration for context-aware suggestions
- Persistent reasoning traces for debugging and learning
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
import signal
import traceback
from datetime import datetime
from typing import AsyncGenerator, Optional
from uuid import UUID

import redis.asyncio as redis
from sqlalchemy import select, and_, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

# Add mesh backend to path
_mesh_path = "/app/mesh" if os.path.exists("/app/mesh") else os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "mesh")
)
if _mesh_path not in sys.path:
    sys.path.insert(0, _mesh_path)

# Config
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql+asyncpg://proofmesh:proofmesh@postgres:5432/proofmesh")
REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379/0")
REDIS_QUEUE_KEY = "proofmesh:canvas_ai:runs"
REDIS_PUBSUB_PREFIX = "proofmesh:canvas_ai:events:"
REDIS_STREAM_PREFIX = "proofmesh:canvas_ai:stream:"

# Database setup
engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# Global flag for graceful shutdown
_shutdown = False


def signal_handler(signum, frame):
    global _shutdown
    print(f"[Worker] Received signal {signum}, shutting down...")
    _shutdown = True


async def get_orchestrator():
    """Get or create the orchestrator instance."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("[Worker] GEMINI_API_KEY not found")
        return None
    
    try:
        from backend.orchestrator import Orchestrator
        from backend.adk_runtime import Runtime
        return Orchestrator(runtime=Runtime())
    except ImportError as e:
        print(f"[Worker] Import error: {e}")
        return None
    except Exception as e:
        print(f"[Worker] Error creating orchestrator: {e}")
        return None


async def get_canvas_agents():
    """Get the canvas agents for streaming reasoning."""
    try:
        from backend.agents.canvas_agents import (
            get_canvas_explorer,
            get_canvas_formalizer,
            get_canvas_critic
        )
        return {
            "explorer": get_canvas_explorer(),
            "formalizer": get_canvas_formalizer(),
            "critic": get_canvas_critic()
        }
    except ImportError as e:
        print(f"[Worker] Canvas agents import error: {e}")
        return None


async def get_knowledge_graph_service():
    """Get the Knowledge Graph service for context retrieval."""
    try:
        from backend.tools.knowledge_graph import get_knowledge_graph_service
        return get_knowledge_graph_service()
    except ImportError as e:
        print(f"[Worker] KG service import error: {e}")
        return None


async def publish_event(redis_client: redis.Redis, problem_id: str, event: dict):
    """Publish an event to the problem's channel."""
    channel = f"{REDIS_PUBSUB_PREFIX}{problem_id}"
    await redis_client.publish(channel, json.dumps(event, default=str))


async def publish_stream_chunk(redis_client: redis.Redis, run_id: str, chunk: dict):
    """Publish a streaming chunk for real-time reasoning visibility."""
    channel = f"{REDIS_STREAM_PREFIX}{run_id}"
    await redis_client.publish(channel, json.dumps(chunk, default=str))


async def update_run_status(
    db: AsyncSession,
    run_id: UUID,
    status: str,
    progress: int = None,
    current_step: str = None,
    **kwargs
):
    """Update run status in database."""
    # Import here to avoid circular imports
    from app.models.canvas_ai import CanvasAIRun
    
    result = await db.execute(select(CanvasAIRun).where(CanvasAIRun.id == run_id))
    run = result.scalar_one_or_none()
    
    if run:
        run.status = status
        if progress is not None:
            run.progress = progress
        if current_step is not None:
            run.current_step = current_step
        
        for key, value in kwargs.items():
            if hasattr(run, key):
                setattr(run, key, value)
        
        await db.commit()
        return run
    return None


async def add_message(
    db: AsyncSession,
    problem_id: UUID,
    run_id: UUID,
    role: str,
    content: str,
    message_data: dict = None,
):
    """Add a message to the chat history."""
    from app.models.canvas_ai import CanvasAIMessage
    
    message = CanvasAIMessage(
        problem_id=problem_id,
        run_id=run_id,
        role=role,
        content=content,
        message_data=message_data,
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)
    return message


async def save_reasoning_trace(
    db: AsyncSession,
    run_id: UUID,
    step_number: int,
    step_type: str,
    content: str,
    agent_name: str = None,
    agent_type: str = None,
    kg_nodes_used: list = None,
    started_at: datetime = None,
    completed_at: datetime = None,
    duration_ms: int = None,
    extra_data: dict = None,
):
    """Save a reasoning trace step to the database."""
    try:
        sql = text("""
            INSERT INTO reasoning_traces (
                id, run_id, step_number, step_type, content,
                kg_nodes_used, agent_name, agent_type,
                started_at, completed_at, duration_ms, extra_data
            ) VALUES (
                gen_random_uuid(), :run_id, :step_number, :step_type, :content,
                :kg_nodes_used, :agent_name, :agent_type,
                :started_at, :completed_at, :duration_ms, :extra_data
            )
        """)
        
        await db.execute(sql, {
            "run_id": run_id,
            "step_number": step_number,
            "step_type": step_type,
            "content": content[:10000],  # Limit content length
            "kg_nodes_used": kg_nodes_used,
            "agent_name": agent_name,
            "agent_type": agent_type,
            "started_at": started_at or datetime.utcnow(),
            "completed_at": completed_at,
            "duration_ms": duration_ms,
            "extra_data": json.dumps(extra_data) if extra_data else None
        })
        await db.commit()
    except Exception as e:
        print(f"[Worker] Error saving reasoning trace: {e}")


async def update_node_state(
    db: AsyncSession,
    run_id: UUID,
    node_id: UUID = None,
    temp_node_id: str = None,
    state: str = "idle",
    state_data: dict = None,
):
    """Update or create a node state for animation."""
    from app.models.canvas_ai import CanvasAINodeState
    
    # Find existing state
    query = select(CanvasAINodeState).where(CanvasAINodeState.run_id == run_id)
    if node_id:
        query = query.where(CanvasAINodeState.node_id == node_id)
    elif temp_node_id:
        query = query.where(CanvasAINodeState.temp_node_id == temp_node_id)
    
    result = await db.execute(query)
    node_state = result.scalar_one_or_none()
    
    if node_state:
        node_state.state = state
        node_state.state_data = state_data
    else:
        node_state = CanvasAINodeState(
            run_id=run_id,
            node_id=node_id,
            temp_node_id=temp_node_id,
            state=state,
            state_data=state_data,
        )
        db.add(node_state)
    
    await db.commit()
    return node_state


async def process_explore_streaming(
    job: dict,
    db: AsyncSession,
    redis_client: redis.Redis,
) -> dict:
    """
    Process exploration with streaming reasoning chains.
    
    This uses the new canvas agents with visible reasoning.
    """
    run_id = UUID(job["run_id"])
    problem_id = job["problem_id"]
    prompt = job["prompt"]
    context = job.get("context") or {}
    
    created_nodes = []
    created_edges = []
    step_counter = [0]  # Use list for mutable closure
    
    try:
        # Get canvas agents
        agents = await get_canvas_agents()
        if not agents:
            raise Exception("Canvas agents not available")
        
        explorer = agents["explorer"]
        
        # Update to running
        await update_run_status(db, run_id, "running", progress=5, current_step="Initializing...")
        await publish_event(redis_client, problem_id, {
            "event_type": "run_progress",
            "run_id": str(run_id),
            "status": "running",
            "progress": 5,
            "current_step": "Initializing AI agents...",
        })
        
        # KG retrieval (optional, will work without if KG is empty)
        kg_nodes = []
        kg_service = await get_knowledge_graph_service()
        if kg_service:
            try:
                # Search for relevant knowledge
                async with async_session() as kg_db:
                    result = await kg_service.retrieve(
                        kg_db, 
                        prompt,
                        top_k=10,
                        min_quality=0.3
                    )
                    kg_nodes = [
                        {
                            "id": str(n.id),
                            "title": n.title,
                            "content": n.content[:300],
                            "type": n.node_type,
                            "lean_code": n.lean_code
                        }
                        for n in result.nodes
                    ]
                    
                    if kg_nodes:
                        # Publish KG retrieval step
                        step_counter[0] += 1
                        await publish_stream_chunk(redis_client, str(run_id), {
                            "step_number": step_counter[0],
                            "step_type": "retrieval",
                            "content": f"Found {len(kg_nodes)} relevant items from knowledge base",
                            "agent_name": "explorer",
                            "kg_nodes": [n["title"] for n in kg_nodes],
                            "is_complete": True
                        })
                        
                        await save_reasoning_trace(
                            db, run_id,
                            step_number=step_counter[0],
                            step_type="retrieval",
                            content=f"Retrieved {len(kg_nodes)} nodes: {', '.join(n['title'] for n in kg_nodes[:5])}",
                            agent_name="explorer",
                            agent_type="retrieval",
                            kg_nodes_used=[n["id"] for n in kg_nodes]
                        )
            except Exception as e:
                print(f"[Worker] KG retrieval error (non-fatal): {e}")
        
        await update_run_status(db, run_id, "running", progress=15, current_step="Analyzing problem...")
        
        # Streaming callback
        async def on_chunk(chunk):
            await publish_stream_chunk(redis_client, str(run_id), {
                "step_type": chunk.step_type,
                "text": chunk.text,
                "is_complete": chunk.is_complete,
                "agent_name": chunk.agent_name
            })
        
        # Step callback  
        async def on_step(step):
            step_counter[0] += 1
            await publish_event(redis_client, problem_id, {
                "event_type": "reasoning_step",
                "run_id": str(run_id),
                "step_number": step.step_number,
                "step_type": step.step_type,
                "content": step.content[:200],
                "agent_name": step.agent_name
            })
        
        # Run exploration with streaming
        await update_run_status(db, run_id, "running", progress=20, current_step="Generating exploration...")
        
        response, trace = await explorer.explore_with_reasoning(
            problem=prompt,
            context=context,
            kg_nodes=kg_nodes if kg_nodes else None,
            on_step=lambda s: asyncio.create_task(on_step(s)),
            on_chunk=lambda c: asyncio.create_task(on_chunk(c))
        )
        
        # Save full reasoning trace
        for step in trace.steps:
            await save_reasoning_trace(
                db, run_id,
                step_number=step.step_number,
                step_type=step.step_type,
                content=step.content,
                agent_name=step.agent_name,
                started_at=step.started_at,
                completed_at=step.completed_at,
                duration_ms=step.duration_ms,
                kg_nodes_used=step.kg_nodes_used
            )
        
        await update_run_status(db, run_id, "running", progress=70, current_step="Processing response...")
        
        # Parse diagram from response if present
        import re
        json_match = re.search(r'```json\s*(\{.*?\})\s*```', response, re.DOTALL)
        if json_match:
            try:
                diagram = json.loads(json_match.group(1))
                nodes = diagram.get("nodes", [])
                edges = diagram.get("edges", [])
                
                for node in nodes:
                    temp_id = node.get("id", f"temp_{len(created_nodes)}")
                    await update_node_state(db, run_id, temp_node_id=temp_id, state="generating",
                                          state_data={"title": node.get("title", "")})
                    await publish_event(redis_client, problem_id, {
                        "event_type": "node_state",
                        "run_id": str(run_id),
                        "temp_node_id": temp_id,
                        "state": "generating",
                    })
                    
                    await asyncio.sleep(0.2)
                    
                    await update_node_state(db, run_id, temp_node_id=temp_id, state="complete")
                    await publish_event(redis_client, problem_id, {
                        "event_type": "node_state",
                        "run_id": str(run_id),
                        "temp_node_id": temp_id,
                        "state": "complete",
                    })
                    
                    created_nodes.append({
                        "id": temp_id,
                        "title": node.get("title", ""),
                        "kind": node.get("type", "CLAIM"),
                        "content": node.get("content", "")
                    })
                    
                    await publish_event(redis_client, problem_id, {
                        "event_type": "node_created",
                        "run_id": str(run_id),
                        "node": node,
                    })
                
                for edge in edges:
                    created_edges.append({
                        "from_id": edge.get("from", ""),
                        "to_id": edge.get("to", ""),
                        "type": edge.get("type", "implies"),
                    })
            except json.JSONDecodeError:
                pass
        
        # Complete
        summary = f"Explored problem with {len(created_nodes)} proposed nodes"
        if kg_nodes:
            summary += f" (using {len(kg_nodes)} knowledge items)"
        
        await update_run_status(
            db, run_id, "completed",
            progress=100,
            current_step="Complete",
            completed_at=datetime.utcnow(),
            summary=summary,
            created_nodes=created_nodes,
            created_edges=created_edges,
            result={
                "response": response,
                "reasoning_duration_ms": trace.total_duration_ms,
                "kg_nodes_used": len(kg_nodes)
            },
        )
        
        await add_message(db, UUID(problem_id), run_id, "action", summary, {
            "type": "action_summary",
            "action": "explore",
            "run_id": str(run_id),
            "nodes_created": created_nodes,
            "edges_created": created_edges,
            "reasoning_visible": True
        })
        
        await publish_event(redis_client, problem_id, {
            "event_type": "run_completed",
            "run_id": str(run_id),
            "status": "completed",
            "summary": summary,
            "created_nodes": created_nodes,
            "created_edges": created_edges,
        })
        
        return {"status": "completed", "summary": summary}
        
    except Exception as e:
        error_msg = str(e)
        traceback.print_exc()
        
        await update_run_status(
            db, run_id, "failed",
            progress=0,
            current_step=None,
            completed_at=datetime.utcnow(),
            error=error_msg,
        )
        
        await add_message(db, UUID(problem_id), run_id, "action", f"Exploration failed: {error_msg}", {
            "type": "action_summary",
            "action": "explore",
            "run_id": str(run_id),
            "error": error_msg,
        })
        
        await publish_event(redis_client, problem_id, {
            "event_type": "run_completed",
            "run_id": str(run_id),
            "status": "failed",
            "error": error_msg,
        })
        
        return {"status": "failed", "error": error_msg}


async def process_explore(
    job: dict,
    db: AsyncSession,
    redis_client: redis.Redis,
    orchestrator,
) -> dict:
    """Process an exploration run."""
    run_id = UUID(job["run_id"])
    problem_id = job["problem_id"]
    prompt = job["prompt"]
    context = job.get("context") or {}
    
    created_nodes = []
    created_edges = []
    
    try:
        # Update to running
        await update_run_status(db, run_id, "running", progress=10, current_step="Starting exploration...")
        await publish_event(redis_client, problem_id, {
            "event_type": "run_progress",
            "run_id": str(run_id),
            "status": "running",
            "progress": 10,
            "current_step": "Starting exploration...",
        })
        
        # Create a block in the canvas
        block_id = orchestrator.canvas.create(prompt)
        
        # Run exploration
        await update_run_status(db, run_id, "running", progress=20, current_step="Generating proposals...")
        await publish_event(redis_client, problem_id, {
            "event_type": "run_progress",
            "run_id": str(run_id),
            "progress": 20,
            "current_step": "Generating proposals...",
        })
        
        max_iterations = context.get("max_iterations", 5)
        exploration = await orchestrator.explore(block_id, max_iterations=max_iterations)
        
        # Process proposals and their diagrams
        proposals = exploration.proposals if hasattr(exploration, "proposals") else []
        
        for i, proposal in enumerate(proposals):
            progress = 30 + int((i + 1) / max(len(proposals), 1) * 50)
            
            # Publish node generation progress
            await update_run_status(db, run_id, "running", progress=progress, 
                                   current_step=f"Processing proposal {i+1}/{len(proposals)}...")
            await publish_event(redis_client, problem_id, {
                "event_type": "run_progress",
                "run_id": str(run_id),
                "progress": progress,
                "current_step": f"Processing proposal {i+1}/{len(proposals)}...",
            })
            
            # If proposal has a diagram, process nodes
            diagram = getattr(proposal, "diagram", None) or {}
            if isinstance(diagram, dict):
                nodes = diagram.get("nodes", [])
                edges = diagram.get("edges", [])
                
                for node in nodes:
                    # Publish node state as "generating"
                    temp_id = node.get("id", f"temp_{len(created_nodes)}")
                    await update_node_state(db, run_id, temp_node_id=temp_id, state="generating",
                                          state_data={"title": node.get("title", "")})
                    await publish_event(redis_client, problem_id, {
                        "event_type": "node_state",
                        "run_id": str(run_id),
                        "temp_node_id": temp_id,
                        "state": "generating",
                        "state_data": {"title": node.get("title", "")},
                    })
                    
                    # Small delay for visual effect
                    await asyncio.sleep(0.3)
                    
                    # Mark as complete
                    await update_node_state(db, run_id, temp_node_id=temp_id, state="complete")
                    await publish_event(redis_client, problem_id, {
                        "event_type": "node_state",
                        "run_id": str(run_id),
                        "temp_node_id": temp_id,
                        "state": "complete",
                    })
                    
                    # Add to created nodes
                    created_nodes.append({
                        "id": temp_id,
                        "title": node.get("title", ""),
                        "kind": node.get("type", "CLAIM"),
                    })
                    
                    # Publish node created event
                    await publish_event(redis_client, problem_id, {
                        "event_type": "node_created",
                        "run_id": str(run_id),
                        "node": node,
                    })
                
                for edge in edges:
                    created_edges.append({
                        "from_id": edge.get("from", ""),
                        "to_id": edge.get("to", ""),
                        "type": edge.get("type", "implies"),
                    })
                    
                    await publish_event(redis_client, problem_id, {
                        "event_type": "edge_created",
                        "run_id": str(run_id),
                        "edge": edge,
                    })
        
        # Complete
        summary = f"Generated {len(created_nodes)} nodes and {len(created_edges)} connections"
        await update_run_status(
            db, run_id, "completed",
            progress=100,
            current_step="Complete",
            completed_at=datetime.utcnow(),
            summary=summary,
            created_nodes=created_nodes,
            created_edges=created_edges,
            result={"proposals": [p.__dict__ if hasattr(p, "__dict__") else p for p in proposals]},
        )
        
        # Add assistant message
        await add_message(db, UUID(problem_id), run_id, "action", summary, {
            "type": "action_summary",
            "action": "explore",
            "run_id": str(run_id),
            "nodes_created": created_nodes,
            "edges_created": created_edges,
        })
        
        await publish_event(redis_client, problem_id, {
            "event_type": "run_completed",
            "run_id": str(run_id),
            "status": "completed",
            "summary": summary,
            "created_nodes": created_nodes,
            "created_edges": created_edges,
        })
        
        return {"status": "completed", "summary": summary}
        
    except Exception as e:
        error_msg = str(e)
        traceback.print_exc()
        
        await update_run_status(
            db, run_id, "failed",
            progress=0,
            current_step=None,
            completed_at=datetime.utcnow(),
            error=error_msg,
        )
        
        await add_message(db, UUID(problem_id), run_id, "action", f"Exploration failed: {error_msg}", {
            "type": "action_summary",
            "action": "explore",
            "run_id": str(run_id),
            "error": error_msg,
        })
        
        await publish_event(redis_client, problem_id, {
            "event_type": "run_completed",
            "run_id": str(run_id),
            "status": "failed",
            "error": error_msg,
        })
        
        return {"status": "failed", "error": error_msg}


async def process_formalize(
    job: dict,
    db: AsyncSession,
    redis_client: redis.Redis,
    orchestrator,
) -> dict:
    """Process a formalization run."""
    run_id = UUID(job["run_id"])
    problem_id = job["problem_id"]
    prompt = job["prompt"]
    context = job.get("context") or {}
    
    try:
        await update_run_status(db, run_id, "running", progress=20, current_step="Formalizing to Lean 4...")
        await publish_event(redis_client, problem_id, {
            "event_type": "run_progress",
            "run_id": str(run_id),
            "status": "running",
            "progress": 20,
            "current_step": "Formalizing to Lean 4...",
        })
        
        hints = context.get("hints", [])
        result = await orchestrator.formalize(prompt, hints=hints)
        
        lean_code = result.lean_code if hasattr(result, "lean_code") else str(result)
        confidence = getattr(result, "confidence", 0.8)
        
        summary = f"Formalized to Lean 4 with {int(confidence * 100)}% confidence"
        await update_run_status(
            db, run_id, "completed",
            progress=100,
            current_step="Complete",
            completed_at=datetime.utcnow(),
            summary=summary,
            result={"lean_code": lean_code, "confidence": confidence},
        )
        
        await add_message(db, UUID(problem_id), run_id, "action", summary, {
            "type": "action_summary",
            "action": "formalize",
            "run_id": str(run_id),
            "lean_code": lean_code,
            "confidence": confidence,
        })
        
        await publish_event(redis_client, problem_id, {
            "event_type": "run_completed",
            "run_id": str(run_id),
            "status": "completed",
            "summary": summary,
        })
        
        return {"status": "completed", "lean_code": lean_code}
        
    except Exception as e:
        error_msg = str(e)
        traceback.print_exc()
        
        await update_run_status(db, run_id, "failed", error=error_msg, completed_at=datetime.utcnow())
        await publish_event(redis_client, problem_id, {
            "event_type": "run_completed",
            "run_id": str(run_id),
            "status": "failed",
            "error": error_msg,
        })
        
        return {"status": "failed", "error": error_msg}


async def process_verify(
    job: dict,
    db: AsyncSession,
    redis_client: redis.Redis,
    orchestrator,
) -> dict:
    """Process a verification run."""
    run_id = UUID(job["run_id"])
    problem_id = job["problem_id"]
    prompt = job["prompt"]  # This should be lean code
    
    try:
        await update_run_status(db, run_id, "running", progress=30, current_step="Verifying Lean 4 code...")
        await publish_event(redis_client, problem_id, {
            "event_type": "run_progress",
            "run_id": str(run_id),
            "status": "running",
            "progress": 30,
            "current_step": "Verifying Lean 4 code...",
        })
        
        result = await orchestrator.verify(prompt)
        
        success = getattr(result, "success", False)
        log = getattr(result, "log", "")
        
        summary = "✓ Verification successful" if success else "✗ Verification failed"
        await update_run_status(
            db, run_id, "completed",
            progress=100,
            current_step="Complete",
            completed_at=datetime.utcnow(),
            summary=summary,
            result={"success": success, "log": log},
        )
        
        await add_message(db, UUID(problem_id), run_id, "action", summary, {
            "type": "action_summary",
            "action": "verify",
            "run_id": str(run_id),
            "success": success,
            "log": log,
        })
        
        await publish_event(redis_client, problem_id, {
            "event_type": "run_completed",
            "run_id": str(run_id),
            "status": "completed",
            "summary": summary,
        })
        
        return {"status": "completed", "success": success}
        
    except Exception as e:
        error_msg = str(e)
        traceback.print_exc()
        
        await update_run_status(db, run_id, "failed", error=error_msg, completed_at=datetime.utcnow())
        await publish_event(redis_client, problem_id, {
            "event_type": "run_completed",
            "run_id": str(run_id),
            "status": "failed",
            "error": error_msg,
        })
        
        return {"status": "failed", "error": error_msg}


async def process_job(job: dict, redis_client: redis.Redis):
    """Process a single job from the queue."""
    run_type = job.get("run_type", "explore")
    run_id = job.get("run_id")
    use_streaming = job.get("use_streaming", True)  # Default to streaming
    
    print(f"[Worker] Processing job: {run_type} (run_id={run_id}, streaming={use_streaming})")
    
    async with async_session() as db:
        # Check if run was cancelled
        from app.models.canvas_ai import CanvasAIRun, CanvasAIRunStatus
        
        result = await db.execute(select(CanvasAIRun).where(CanvasAIRun.id == UUID(run_id)))
        run = result.scalar_one_or_none()
        
        if not run:
            print(f"[Worker] Run {run_id} not found, skipping")
            return
        
        if run.status == CanvasAIRunStatus.CANCELLED.value:
            print(f"[Worker] Run {run_id} was cancelled, skipping")
            return
        
        # Try streaming agents first, fallback to orchestrator
        if use_streaming and run_type == "explore":
            try:
                await process_explore_streaming(job, db, redis_client)
                return
            except Exception as e:
                print(f"[Worker] Streaming explore failed, falling back: {e}")
        
        # Get orchestrator for fallback/other types
        orchestrator = await get_orchestrator()
        if not orchestrator:
            await update_run_status(db, UUID(run_id), "failed", error="Orchestrator not available")
            await publish_event(redis_client, job["problem_id"], {
                "event_type": "run_completed",
                "run_id": run_id,
                "status": "failed",
                "error": "AI orchestrator not available. Check GEMINI_API_KEY.",
            })
            return
        
        # Process based on type
        if run_type == "explore":
            await process_explore(job, db, redis_client, orchestrator)
        elif run_type == "formalize":
            await process_formalize(job, db, redis_client, orchestrator)
        elif run_type == "verify":
            await process_verify(job, db, redis_client, orchestrator)
        elif run_type == "pipeline":
            # Pipeline combines explore + formalize + verify
            await process_explore(job, db, redis_client, orchestrator)
        else:
            print(f"[Worker] Unknown run type: {run_type}")


async def worker_loop():
    """Main worker loop - polls Redis for jobs."""
    global _shutdown
    
    print("[Worker] Starting Canvas AI worker...")
    redis_client = redis.from_url(REDIS_URL, decode_responses=True)
    
    try:
        # Test Redis connection
        await redis_client.ping()
        print("[Worker] Connected to Redis")
        
        while not _shutdown:
            try:
                # Blocking pop with 5 second timeout
                result = await redis_client.blpop(REDIS_QUEUE_KEY, timeout=5)
                
                if result:
                    _, job_data = result
                    job = json.loads(job_data)
                    await process_job(job, redis_client)
                    
            except json.JSONDecodeError as e:
                print(f"[Worker] Invalid job data: {e}")
            except Exception as e:
                print(f"[Worker] Error processing job: {e}")
                traceback.print_exc()
                await asyncio.sleep(1)
                
    except Exception as e:
        print(f"[Worker] Fatal error: {e}")
        traceback.print_exc()
    finally:
        await redis_client.close()
        print("[Worker] Shutdown complete")


def main():
    """Entry point for the worker."""
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    asyncio.run(worker_loop())


if __name__ == "__main__":
    main()
