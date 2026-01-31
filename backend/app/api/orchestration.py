"""
Orchestration API - Real AI agent integration via mesh backend.
This module bridges the FastAPI backend with the mesh orchestrator.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
import uuid
from typing import Optional, AsyncGenerator
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from app.database import get_db
from app.models.problem import Problem, ProblemVisibility
from app.models.library_item import LibraryItem, LibraryItemKind, LibraryItemStatus
from app.models.user import User
from app.api.deps import get_current_user_optional, get_current_user

# Add mesh backend to path
# In Docker: /app/mesh, locally: ../../../mesh relative to this file
_mesh_path = "/app/mesh" if os.path.exists("/app/mesh") else os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "mesh"))
if _mesh_path not in sys.path:
    sys.path.insert(0, _mesh_path)

router = APIRouter(prefix="/api/orchestration", tags=["orchestration"])


# ============ Schemas ============

class ExploreRequest(BaseModel):
    problem_id: UUID
    context: str
    max_iterations: int = 5


class FormalizeRequest(BaseModel):
    problem_id: UUID
    text: str
    hints: list[str] = Field(default_factory=list)


class CritiqueRequest(BaseModel):
    problem_id: UUID
    proposal: str
    context: Optional[str] = None
    goal: Optional[str] = None


class VerifyRequest(BaseModel):
    problem_id: UUID
    lean_code: str


class FullPipelineRequest(BaseModel):
    problem_id: UUID
    context: str
    auto_publish: bool = False


class ProposalResponse(BaseModel):
    id: str
    content: str
    reasoning: str
    score: float
    iteration: int


class ExploreResponse(BaseModel):
    run_id: str
    status: str
    proposals: list[ProposalResponse]
    best_score: float
    total_iterations: int


class FormalizeResponse(BaseModel):
    run_id: str
    status: str
    lean_code: str
    imports: list[str]
    confidence: float


class CritiqueResponse(BaseModel):
    run_id: str
    status: str
    score: float
    feedback: str
    suggestions: list[str]
    issues: list[str]


class VerifyResponse(BaseModel):
    run_id: str
    status: str
    success: bool
    log: str
    error: Optional[str] = None


class PipelineResponse(BaseModel):
    run_id: str
    status: str
    stages: dict
    library_item_id: Optional[str] = None
    message: str


class StreamEvent(BaseModel):
    event: str
    data: dict


# ============ Helper Functions ============

async def verify_problem_access(
    problem_id: UUID,
    db: AsyncSession,
    current_user: User | None,
) -> Problem:
    result = await db.execute(select(Problem).where(Problem.id == problem_id))
    problem = result.scalar_one_or_none()

    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    if problem.visibility == ProblemVisibility.PRIVATE:
        if not current_user or problem.author_id != current_user.id:
            raise HTTPException(status_code=404, detail="Problem not found")

    return problem


def get_orchestrator():
    """Get or create the orchestrator instance."""
    # Debug logging
    api_key = os.environ.get("GEMINI_API_KEY")
    print(f"[Orchestration] Checking GEMINI_API_KEY: {'present (len={})'.format(len(api_key)) if api_key else 'MISSING'}")
    print(f"[Orchestration] Mesh path: {_mesh_path}")
    print(f"[Orchestration] Mesh path exists: {os.path.exists(_mesh_path)}")
    
    if not api_key:
        print("[Orchestration] GEMINI_API_KEY not found in environment")
        return None
    
    try:
        # Import from mesh/backend - path already added at module level
        print("[Orchestration] Attempting import of backend.orchestrator...")
        from backend.orchestrator import Orchestrator
        from backend.adk_runtime import Runtime
        print("[Orchestration] Import successful!")
            
        return Orchestrator(runtime=Runtime())
    except ImportError as e:
        print(f"[Orchestration] Import error: {e}")
        import traceback
        traceback.print_exc()
        return None
    except Exception as e:
        print(f"[Orchestration] Error creating orchestrator: {e}")
        import traceback
        traceback.print_exc()
        return None


# ============ Endpoints ============

@router.post("/explore", response_model=ExploreResponse)
async def explore(
    data: ExploreRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """
    Explore a mathematical context and generate proposals.
    Uses the ExplorerAgent via the mesh orchestrator.
    """
    await verify_problem_access(data.problem_id, db, current_user)
    
    orchestrator = get_orchestrator()
    if not orchestrator:
        raise HTTPException(
            status_code=503, 
            detail="AI orchestrator not available. Check GEMINI_API_KEY."
        )
    
    try:
        # Create a block in the canvas
        block_id = orchestrator.canvas.create(data.context)
        
        # Run exploration
        result = await orchestrator.explore(block_id, max_iterations=data.max_iterations)
        
        proposals = [
            ProposalResponse(
                id=p.id,
                content=p.content or "",
                reasoning=p.reasoning,
                score=p.score,
                iteration=p.iteration,
            )
            for p in result.proposals
            if p.is_valid()
        ]
        
        return ExploreResponse(
            run_id=str(uuid.uuid4()),
            status="completed",
            proposals=proposals,
            best_score=result.best_score,
            total_iterations=result.total_iterations,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Exploration failed: {str(e)}")


@router.post("/formalize", response_model=FormalizeResponse)
async def formalize(
    data: FormalizeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """
    Formalize mathematical text into Lean 4 code.
    Uses the FormalizerAgent via the mesh orchestrator.
    """
    await verify_problem_access(data.problem_id, db, current_user)
    
    orchestrator = get_orchestrator()
    if not orchestrator:
        raise HTTPException(
            status_code=503, 
            detail="AI orchestrator not available. Check GEMINI_API_KEY."
        )
    
    try:
        result = await orchestrator.formalize(data.text, hints=data.hints)
        
        return FormalizeResponse(
            run_id=str(uuid.uuid4()),
            status="completed",
            lean_code=result.lean_code,
            imports=result.imports,
            confidence=result.confidence,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Formalization failed: {str(e)}")


@router.post("/critique", response_model=CritiqueResponse)
async def critique(
    data: CritiqueRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """
    Get critique and feedback on a proposal.
    Uses the CriticAgent via the mesh orchestrator.
    """
    await verify_problem_access(data.problem_id, db, current_user)
    
    orchestrator = get_orchestrator()
    if not orchestrator:
        raise HTTPException(
            status_code=503, 
            detail="AI orchestrator not available. Check GEMINI_API_KEY."
        )
    
    try:
        result = await orchestrator.critique(
            data.proposal,
            context=data.context,
            goal=data.goal,
        )
        
        return CritiqueResponse(
            run_id=str(uuid.uuid4()),
            status="completed",
            score=result.score,
            feedback=result.feedback,
            suggestions=result.suggestions,
            issues=result.issues,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Critique failed: {str(e)}")


@router.post("/verify", response_model=VerifyResponse)
async def verify(
    data: VerifyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """
    Verify Lean 4 code.
    Uses the LeanRunner via the mesh orchestrator.
    """
    await verify_problem_access(data.problem_id, db, current_user)
    
    orchestrator = get_orchestrator()
    if not orchestrator:
        raise HTTPException(
            status_code=503, 
            detail="AI orchestrator not available. Check GEMINI_API_KEY."
        )
    
    try:
        result = await orchestrator.verify(data.lean_code)
        
        return VerifyResponse(
            run_id=str(uuid.uuid4()),
            status="completed",
            success=result.success,
            log=result.log,
            error=result.error,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Verification failed: {str(e)}")


@router.post("/pipeline", response_model=PipelineResponse)
async def full_pipeline(
    data: FullPipelineRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Run the full pipeline: explore → critique → formalize → verify → persist.
    Optionally publishes to library as a proposed item.
    """
    problem = await verify_problem_access(data.problem_id, db, current_user)
    
    orchestrator = get_orchestrator()
    if not orchestrator:
        raise HTTPException(
            status_code=503, 
            detail="AI orchestrator not available. Check GEMINI_API_KEY."
        )
    
    stages = {
        "explore": {"status": "pending"},
        "critique": {"status": "pending"},
        "formalize": {"status": "pending"},
        "verify": {"status": "pending"},
        "persist": {"status": "pending"},
    }
    
    try:
        # Create block
        block_id = orchestrator.canvas.create(data.context)
        
        # 1. Explore
        stages["explore"]["status"] = "running"
        exploration = await orchestrator.explore(block_id)
        valid_proposals = [p for p in exploration.proposals if p.is_valid()]
        
        if not valid_proposals:
            stages["explore"]["status"] = "failed"
            return PipelineResponse(
                run_id=str(uuid.uuid4()),
                status="failed",
                stages=stages,
                message="No valid proposals generated",
            )
        
        stages["explore"] = {
            "status": "completed",
            "proposals_count": len(valid_proposals),
            "best_score": exploration.best_score,
        }
        
        # 2. Critique
        stages["critique"]["status"] = "running"
        best_proposal = valid_proposals[0]
        critique_result = await orchestrator.critique(best_proposal.content)
        
        if critique_result.score < 0.5:
            stages["critique"]["status"] = "warning"
        else:
            stages["critique"]["status"] = "completed"
        
        stages["critique"]["score"] = critique_result.score
        stages["critique"]["feedback"] = critique_result.feedback
        
        # 3. Formalize
        stages["formalize"]["status"] = "running"
        formalization = await orchestrator.formalize(best_proposal.content)
        
        if formalization.confidence < 0.3:
            stages["formalize"]["status"] = "failed"
            return PipelineResponse(
                run_id=str(uuid.uuid4()),
                status="failed",
                stages=stages,
                message="Formalization confidence too low",
            )
        
        stages["formalize"] = {
            "status": "completed",
            "confidence": formalization.confidence,
            "lean_code": formalization.lean_code[:200] + "..." if len(formalization.lean_code) > 200 else formalization.lean_code,
        }
        
        # 4. Verify
        stages["verify"]["status"] = "running"
        verification = await orchestrator.verify(formalization.lean_code)
        
        stages["verify"] = {
            "status": "completed" if verification.success else "failed",
            "success": verification.success,
            "log": verification.log[:500] if verification.log else "",
        }
        
        library_item_id = None
        
        # 5. Persist to library if requested
        if data.auto_publish:
            stages["persist"]["status"] = "running"
            
            new_item = LibraryItem(
                problem_id=data.problem_id,
                title=best_proposal.content[:100] if best_proposal.content else "AI Generated",
                kind=LibraryItemKind.LEMMA,
                content=best_proposal.content or "",
                formula=formalization.lean_code[:500] if formalization.lean_code else None,
                status=LibraryItemStatus.VERIFIED if verification.success else LibraryItemStatus.PROPOSED,
                authors=[{"type": "agent", "id": "orchestrator", "name": "AI Pipeline"}],
                source={"agent_run_id": str(uuid.uuid4())},
                dependencies=[],
                verification={
                    "method": "lean4",
                    "status": "success" if verification.success else "failed",
                    "logs": verification.log or "",
                },
            )
            
            db.add(new_item)
            await db.commit()
            await db.refresh(new_item)
            
            library_item_id = str(new_item.id)
            stages["persist"]["status"] = "completed"
            stages["persist"]["library_item_id"] = library_item_id
        else:
            stages["persist"]["status"] = "skipped"
        
        return PipelineResponse(
            run_id=str(uuid.uuid4()),
            status="completed" if verification.success else "partial",
            stages=stages,
            library_item_id=library_item_id,
            message="Pipeline completed successfully" if verification.success else "Verification failed but proposal saved",
        )
        
    except Exception as e:
        return PipelineResponse(
            run_id=str(uuid.uuid4()),
            status="error",
            stages=stages,
            message=f"Pipeline error: {str(e)}",
        )


@router.get("/status")
async def orchestrator_status():
    """Check if the AI orchestrator is available."""
    orchestrator = get_orchestrator()
    
    if orchestrator:
        return {
            "available": True,
            "agents": ["explorer", "formalizer", "critic"],
            "tools": ["lean_runner", "fact_store"],
        }
    else:
        return {
            "available": False,
            "reason": "GEMINI_API_KEY not set or mesh backend not found",
        }


# ============ Streaming Endpoint for Real-time Updates ============

async def generate_stream_events(
    orchestrator,
    context: str,
) -> AsyncGenerator[str, None]:
    """Generate SSE events for pipeline progress."""
    import json
    
    block_id = orchestrator.canvas.create(context)
    
    # Explore
    yield f"data: {json.dumps({'event': 'stage_start', 'stage': 'explore'})}\n\n"
    try:
        exploration = await orchestrator.explore(block_id, max_iterations=3)
        valid_proposals = [p for p in exploration.proposals if p.is_valid()]
        yield f"data: {json.dumps({'event': 'stage_complete', 'stage': 'explore', 'data': {'count': len(valid_proposals), 'best_score': exploration.best_score}})}\n\n"
        
        if not valid_proposals:
            yield f"data: {json.dumps({'event': 'pipeline_end', 'status': 'failed', 'message': 'No valid proposals'})}\n\n"
            return
        
        best = valid_proposals[0]
        yield f"data: {json.dumps({'event': 'proposal', 'data': {'content': best.content[:200], 'score': best.score}})}\n\n"
        
        # Critique
        yield f"data: {json.dumps({'event': 'stage_start', 'stage': 'critique'})}\n\n"
        critique = await orchestrator.critique(best.content)
        yield f"data: {json.dumps({'event': 'stage_complete', 'stage': 'critique', 'data': {'score': critique.score, 'feedback': critique.feedback[:200]}})}\n\n"
        
        # Formalize
        yield f"data: {json.dumps({'event': 'stage_start', 'stage': 'formalize'})}\n\n"
        formalization = await orchestrator.formalize(best.content)
        yield f"data: {json.dumps({'event': 'stage_complete', 'stage': 'formalize', 'data': {'confidence': formalization.confidence, 'code_preview': formalization.lean_code[:100]}})}\n\n"
        
        # Verify
        yield f"data: {json.dumps({'event': 'stage_start', 'stage': 'verify'})}\n\n"
        verification = await orchestrator.verify(formalization.lean_code)
        yield f"data: {json.dumps({'event': 'stage_complete', 'stage': 'verify', 'data': {'success': verification.success, 'log': verification.log[:200] if verification.log else ''}})}\n\n"
        
        status_msg = 'completed' if verification.success else 'failed'
        result_msg = 'Verification passed' if verification.success else 'Verification failed'
        yield f"data: {json.dumps({'event': 'pipeline_end', 'status': status_msg, 'message': result_msg})}\n\n"
        
    except Exception as e:
        yield f"data: {json.dumps({'event': 'error', 'message': str(e)})}\n\n"


@router.post("/pipeline/stream")
async def stream_pipeline(
    data: FullPipelineRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Stream pipeline progress via Server-Sent Events.
    """
    await verify_problem_access(data.problem_id, db, current_user)
    
    orchestrator = get_orchestrator()
    if not orchestrator:
        raise HTTPException(
            status_code=503,
            detail="AI orchestrator not available",
        )
    
    return StreamingResponse(
        generate_stream_events(orchestrator, data.context),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )
