"""
Orchestration API - Real AI agent integration via mesh backend.
This module bridges the FastAPI backend with the mesh orchestrator.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
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
from app.models.problem import Problem
from app.models.library_item import LibraryItem, LibraryItemKind, LibraryItemStatus
from app.models.user import User
from app.api.deps import get_current_user, verify_problem_access

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


class CanvasIdeaRouterRequest(BaseModel):
    problem_id: UUID
    prompt: str = ""
    context: str = ""
    max_iterations: int = Field(default=3, ge=1, le=8)
    include_critique: bool = True
    include_formalization: bool = True


class ProposalResponse(BaseModel):
    id: str
    content: str
    reasoning: str
    diagram: dict | None = None
    score: float
    iteration: int


class ExploreResponse(BaseModel):
    run_id: str
    status: str
    proposals: list[ProposalResponse]
    best_score: float
    total_iterations: int


class CanvasIdeaNodeBlueprint(BaseModel):
    kind: str
    title: str
    content: str
    formula: Optional[str] = None
    lean_code: Optional[str] = None
    status: str = "PROPOSED"


class CanvasIdeaRouterResponse(BaseModel):
    run_id: str
    status: str
    route: str
    insight: str
    agents_used: list[str]
    proposals: list[ProposalResponse]
    node_blueprints: list[CanvasIdeaNodeBlueprint]
    best_score: float
    total_iterations: int
    trace: list[str]


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


def _normalize_space(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "")).strip()


def _truncate(value: str, limit: int) -> str:
    text = (value or "").strip()
    if len(text) <= limit:
        return text
    return text[: max(limit - 3, 0)].rstrip() + "..."


def _infer_canvas_route(prompt: str, context: str) -> str:
    text = f"{prompt}\n{context}".lower()
    compute_keywords = (
        "python",
        "compute",
        "calcula",
        "calculation",
        "script",
        "ejecuta",
        "run code",
    )
    lean_keywords = (
        "lean",
        "formalize",
        "formaliza",
        "verify",
        "verifica",
        "teorema formal",
        "formal test",
    )
    critique_keywords = (
        "critique",
        "critica",
        "review",
        "revisa",
        "weakness",
        "fallo",
        "counterexample",
    )

    if any(keyword in text for keyword in compute_keywords):
        return "compute"
    if any(keyword in text for keyword in lean_keywords):
        return "formalize_verify"
    if any(keyword in text for keyword in critique_keywords):
        return "critique"
    return "explore"


def _infer_kind_from_text(text: str) -> str:
    value = (text or "").lower()
    if any(token in value for token in ("definition", "definicion", "define")):
        return "DEFINITION"
    if "theorem" in value or "teorema" in value:
        return "THEOREM"
    if "lemma" in value or "lema" in value:
        return "LEMMA"
    if "claim" in value or "afirma" in value:
        return "CLAIM"
    if "counterexample" in value or "contraejemplo" in value:
        return "COUNTEREXAMPLE"
    if "computation" in value or "calculation" in value:
        return "COMPUTATION"
    return "NOTE"


def _derive_title(text: str, fallback: str) -> str:
    cleaned = _normalize_space(text)
    if not cleaned:
        return fallback
    sentence = re.split(r"[.!?]", cleaned)[0].strip()
    words = sentence.split()[:8]
    if not words:
        return fallback
    candidate = " ".join(words)
    if len(candidate) < len(sentence):
        candidate += "..."
    return candidate


def _build_python_stub(prompt: str, context: str) -> str:
    source = _normalize_space(prompt or context)
    expression_match = re.search(r"([0-9a-zA-Z_().+\-*/\s]{3,})", source)
    expression = expression_match.group(1).strip() if expression_match else ""

    if expression and re.search(r"[+\-*/()]", expression):
        return f"result = {expression}\nprint(result)"

    return (
        "# Computation generated from canvas request\n"
        f"# Goal: {_truncate(source, 120) or 'describe the calculation'}\n"
        "result = None\n"
        "print(result)"
    )


def _proposal_to_blueprint(proposal: ProposalResponse) -> CanvasIdeaNodeBlueprint:
    kind = _infer_kind_from_text(f"{proposal.content}\n{proposal.reasoning}")
    title = _derive_title(proposal.content, "Idea")
    return CanvasIdeaNodeBlueprint(
        kind=kind,
        title=title,
        content=_truncate(proposal.content, 900),
        status="PROPOSED",
    )


# ============ Endpoints ============

@router.post("/explore", response_model=ExploreResponse)
async def explore(
    data: ExploreRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
                diagram=p.diagram,
                score=p.score,
                iteration=p.iteration,
            )
            for p in result.proposals
            if p.is_valid()
        ]

        if proposals:
            diagram_counts = []
            for p in proposals:
                nodes = p.diagram.get("nodes", []) if p.diagram else []
                edges = p.diagram.get("edges", []) if p.diagram else []
                diagram_counts.append((len(nodes), len(edges)))
            print(f"[Orchestration] Explore proposals={len(proposals)} diagrams={diagram_counts}")
        else:
            print("[Orchestration] Explore returned 0 valid proposals")
        
        return ExploreResponse(
            run_id=str(uuid.uuid4()),
            status="completed",
            proposals=proposals,
            best_score=result.best_score,
            total_iterations=result.total_iterations,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Exploration failed: {str(e)}")


@router.post("/canvas-router", response_model=CanvasIdeaRouterResponse)
async def route_canvas_ideas(
    data: CanvasIdeaRouterRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Intelligent router for canvas idea generation.

    Decides which agent path to run (explore, formalize+verify, compute, critique)
    and returns structured proposals/blueprints ready for node creation.
    """
    await verify_problem_access(data.problem_id, db, current_user)

    orchestrator = get_orchestrator()
    if not orchestrator:
        raise HTTPException(
            status_code=503,
            detail="AI orchestrator not available. Check GEMINI_API_KEY.",
        )

    prompt = (data.prompt or "").strip()
    context = (data.context or "").strip()
    combined_context = "\n\n".join(part for part in [context, prompt] if part).strip()
    route = _infer_canvas_route(prompt, context)
    if route == "formalize_verify" and not data.include_formalization:
        route = "explore"
    run_id = str(uuid.uuid4())
    trace: list[str] = [f"route={route}"]
    agents_used: list[str] = []
    proposals: list[ProposalResponse] = []
    blueprints: list[CanvasIdeaNodeBlueprint] = []
    best_score = 0.0
    total_iterations = 0
    insight = ""

    if not combined_context:
        raise HTTPException(status_code=400, detail="Prompt or context is required")

    try:
        if route == "compute":
            code = _build_python_stub(prompt, context)
            agents_used = ["router", "python_executor"]
            trace.append("generated_python_stub")

            diagram = {
                "nodes": [
                    {
                        "id": "idea",
                        "type": "IDEA",
                        "title": _derive_title(prompt or context, "Computation goal"),
                        "content": _truncate(prompt or context, 220),
                    },
                    {
                        "id": "compute",
                        "type": "COMPUTATION",
                        "title": "Python computation",
                        "content": code,
                    },
                ],
                "edges": [
                    {"from": "idea", "to": "compute", "type": "implies", "label": "implement"},
                ],
            }

            proposals = [
                ProposalResponse(
                    id=f"router-{run_id[:8]}",
                    content=_truncate(prompt or context, 260),
                    reasoning="Prepared an executable computation node for this request.",
                    diagram=diagram,
                    score=0.74,
                    iteration=1,
                )
            ]
            blueprints = [
                CanvasIdeaNodeBlueprint(
                    kind="COMPUTATION",
                    title="Python computation",
                    content=code,
                    status="PROPOSED",
                ),
                CanvasIdeaNodeBlueprint(
                    kind="NOTE",
                    title="Computation goal",
                    content=_truncate(prompt or context, 260),
                    status="PROPOSED",
                ),
            ]
            best_score = proposals[0].score
            total_iterations = 1
            insight = "Generated a computation-ready path: one code node plus one explanation node."

        elif route == "formalize_verify":
            agents_used = ["formalizer"]
            trace.append("formalize_start")
            formalization = await orchestrator.formalize(combined_context)
            lean_code = formalization.lean_code or ""
            trace.append(f"formalized_confidence={formalization.confidence:.2f}")

            verification_log = ""
            verification_ok = False
            if lean_code.strip():
                agents_used.append("lean_runner")
                trace.append("verify_start")
                verification = await orchestrator.verify(lean_code)
                verification_ok = bool(verification.success)
                verification_log = verification.log or verification.error or ""
                trace.append(f"verify_success={verification_ok}")
            else:
                trace.append("verify_skipped_empty_code")

            critique_feedback = ""
            critique_score = 0.0
            if data.include_critique:
                try:
                    agents_used.append("critic")
                    critique = await orchestrator.critique(combined_context)
                    critique_feedback = critique.feedback
                    critique_score = critique.score
                    trace.append(f"critique_score={critique_score:.2f}")
                except Exception as critique_error:
                    trace.append(f"critique_error={str(critique_error)}")

            summary_note = (
                f"Formalization confidence: {formalization.confidence:.2f}. "
                f"Lean verification: {'pass' if verification_ok else 'pending/fail'}."
            )
            if critique_feedback:
                summary_note += f" Critic: {_truncate(critique_feedback, 180)}"

            diagram_nodes = [
                {
                    "id": "goal",
                    "type": "CLAIM",
                    "title": _derive_title(prompt or context, "Formal goal"),
                    "content": _truncate(prompt or context, 240),
                },
                {
                    "id": "formal",
                    "type": "FORMAL_TEST",
                    "title": "Lean formalization",
                    "content": f"```lean\n{lean_code}\n```" if lean_code else "No Lean code generated.",
                    "lean_code": lean_code,
                },
                {
                    "id": "verify",
                    "type": "NOTE",
                    "title": "Verification summary",
                    "content": _truncate(
                        summary_note + (f"\n\n{verification_log}" if verification_log else ""),
                        1000,
                    ),
                },
            ]

            proposals = [
                ProposalResponse(
                    id=f"router-{run_id[:8]}",
                    content=_truncate(prompt or context, 260),
                    reasoning=summary_note,
                    diagram={
                        "nodes": diagram_nodes,
                        "edges": [
                            {"from": "goal", "to": "formal", "type": "implies", "label": "formalize"},
                            {"from": "formal", "to": "verify", "type": "uses", "label": "verify"},
                        ],
                    },
                    score=min(1.0, max(formalization.confidence, 0.45)),
                    iteration=1,
                )
            ]
            blueprints = [
                CanvasIdeaNodeBlueprint(
                    kind="FORMAL_TEST",
                    title="Lean formalization",
                    content=lean_code or "No Lean code generated",
                    lean_code=lean_code or None,
                    status="VERIFIED" if verification_ok else "PROPOSED",
                ),
                CanvasIdeaNodeBlueprint(
                    kind="NOTE",
                    title="Verification summary",
                    content=_truncate(summary_note + (f"\n\n{verification_log}" if verification_log else ""), 1000),
                    status="VERIFIED" if verification_ok else "PROPOSED",
                ),
            ]
            best_score = proposals[0].score
            total_iterations = 1
            insight = (
                "Generated a formalization path with Lean code and verification status ready for canvas nodes."
            )

        else:
            # "explore" and "critique" both start from explorer output.
            agents_used = ["explorer"]
            block_id = orchestrator.canvas.create(combined_context)
            trace.append("explore_start")
            exploration = await orchestrator.explore(block_id, max_iterations=data.max_iterations)
            total_iterations = exploration.total_iterations
            valid_proposals = [
                p for p in exploration.proposals if p.is_valid()
            ][: max(1, min(6, data.max_iterations + 2))]

            if not valid_proposals:
                return CanvasIdeaRouterResponse(
                    run_id=run_id,
                    status="failed",
                    route=route,
                    insight="No valid ideas generated. Try adding more context.",
                    agents_used=agents_used,
                    proposals=[],
                    node_blueprints=[],
                    best_score=0.0,
                    total_iterations=total_iterations,
                    trace=trace,
                )

            critique_results = {}
            if data.include_critique:
                agents_used.append("critic")
                async def _run_critique(content: str):
                    return await orchestrator.critique(content, context=context or None, goal=prompt or None)

                for proposal in valid_proposals[:3]:
                    try:
                        critique = await _run_critique(proposal.content or "")
                        critique_results[proposal.id] = critique
                        trace.append(f"critique[{proposal.id}]={critique.score:.2f}")
                    except Exception as critique_error:
                        trace.append(f"critique_error[{proposal.id}]={str(critique_error)}")

            for proposal in valid_proposals:
                base_reasoning = proposal.reasoning or ""
                score = proposal.score
                critique = critique_results.get(proposal.id)
                if critique:
                    score = min(1.0, max(0.0, (proposal.score * 0.65) + (critique.score * 0.35)))
                    base_reasoning = _truncate(f"{base_reasoning}\nCritic: {critique.feedback}", 700)

                proposals.append(
                    ProposalResponse(
                        id=proposal.id,
                        content=proposal.content or "",
                        reasoning=base_reasoning,
                        diagram=proposal.diagram,
                        score=score,
                        iteration=proposal.iteration,
                    )
                )

            proposals.sort(key=lambda p: p.score, reverse=True)
            blueprints = [_proposal_to_blueprint(p) for p in proposals[:4]]
            best_score = proposals[0].score if proposals else 0.0

            if route == "critique":
                insight = "Generated ideas and attached critic feedback to rank the strongest next canvas nodes."
            else:
                insight = "Generated ranked idea candidates with short reasoning diagrams for direct canvas insertion."

        # Deduplicate while preserving order.
        agents_used = list(dict.fromkeys(agents_used))

        return CanvasIdeaRouterResponse(
            run_id=run_id,
            status="completed",
            route=route,
            insight=insight,
            agents_used=agents_used,
            proposals=proposals,
            node_blueprints=blueprints,
            best_score=best_score,
            total_iterations=total_iterations,
            trace=trace,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Canvas routing failed: {str(e)}")


@router.post("/formalize", response_model=FormalizeResponse)
async def formalize(
    data: FormalizeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
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
