from __future__ import annotations

import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.problem import Problem, ProblemVisibility
from app.models.user import User
from app.api.deps import get_current_user_optional
from app.schemas.latex_ai import (
    LatexChatRequest,
    LatexChatResponse,
    LatexAutocompleteRequest,
    LatexAutocompleteResponse,
    LatexAutocompleteItem,
)
from app.api.orchestration import get_orchestrator


router = APIRouter(prefix="/api/latex-ai", tags=["latex-ai"])


async def verify_problem_access(
    problem_id: UUID,
    db: AsyncSession,
    current_user: User | None,
) -> Problem:
    result = await db.execute(select(Problem).where(Problem.id == problem_id))
    problem = result.scalar_one_or_none()

    if not problem:
        raise HTTPException(status_code=404, detail="Workspace not found")

    if problem.visibility == ProblemVisibility.PRIVATE:
        if not current_user or problem.author_id != current_user.id:
            raise HTTPException(status_code=404, detail="Workspace not found")

    return problem


@router.post("/{problem_id}/chat", response_model=LatexChatResponse)
async def latex_chat(
    problem_id: UUID,
    payload: LatexChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    await verify_problem_access(problem_id, db, current_user)

    orchestrator = get_orchestrator()
    if not orchestrator:
        raise HTTPException(status_code=503, detail="AI service not available")

    history = "\n".join([
        f"{item.role}: {item.content}" for item in payload.history[-6:]
    ])

    prompt = (
        "Responde al usuario como asistente de LaTeX. "
        "Si incluyes LaTeX, envuélvelo en un bloque ```latex```.\n\n"
        f"Archivo: {payload.file_path or 'N/A'}\n"
        f"Selección: {payload.selection or ''}\n\n"
        f"Contexto:\n{payload.context or ''}\n\n"
        f"Historial:\n{history}\n\n"
        f"Mensaje del usuario:\n{payload.message}\n"
    )

    result = await orchestrator.latex_assist(prompt, context={"problem_id": str(problem_id)})
    if not result.success:
        raise HTTPException(status_code=500, detail=result.content)

    return LatexChatResponse(reply=result.content.strip())


@router.post("/{problem_id}/autocomplete", response_model=LatexAutocompleteResponse)
async def latex_autocomplete(
    problem_id: UUID,
    payload: LatexAutocompleteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    await verify_problem_access(problem_id, db, current_user)

    orchestrator = get_orchestrator()
    if not orchestrator:
        raise HTTPException(status_code=503, detail="AI service not available")

    prompt = (
        "Devuelve SOLO JSON válido con el formato: {\"suggestions\":[{\"label\":...,\"insert_text\":...}]}\n"
        "Tarea: autocompletar el siguiente texto LaTeX. Mantén las sugerencias cortas y útiles.\n"
        f"Archivo: {payload.file_path or 'N/A'}\n"
        f"Texto antes del cursor:\n{payload.before}\n\n"
        f"Texto después del cursor:\n{payload.after}\n"
    )

    result = await orchestrator.latex_assist(prompt, context={"problem_id": str(problem_id)})
    if not result.success:
        raise HTTPException(status_code=500, detail=result.content)

    suggestions: list[LatexAutocompleteItem] = []
    try:
        data = json.loads(result.content)
        items = data.get("suggestions", [])
        for item in items[: payload.max_suggestions]:
            label = str(item.get("label") or "Suggestion")
            insert_text = str(item.get("insert_text") or "")
            if not insert_text:
                continue
            suggestions.append(LatexAutocompleteItem(label=label, insert_text=insert_text))
    except json.JSONDecodeError:
        content = result.content.strip()
        if content:
            suggestions.append(LatexAutocompleteItem(label="AI", insert_text=content))

    return LatexAutocompleteResponse(suggestions=suggestions)
