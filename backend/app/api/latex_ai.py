from __future__ import annotations

import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.api.deps import get_current_user_optional, verify_problem_access
from app.schemas.latex_ai import (
    LatexChatRequest,
    LatexChatResponse,
    LatexAutocompleteRequest,
    LatexAutocompleteResponse,
    LatexAutocompleteItem,
)
from app.api.orchestration import get_orchestrator


router = APIRouter(prefix="/api/latex-ai", tags=["latex-ai"])


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
        "Respond to the user as a LaTeX assistant. "
        "If you include LaTeX, wrap it in a ```latex``` block.\n\n"
        f"File: {payload.file_path or 'N/A'}\n"
        f"Selection: {payload.selection or ''}\n\n"
        f"Context:\n{payload.context or ''}\n\n"
        f"History:\n{history}\n\n"
        f"User message:\n{payload.message}\n"
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
        "Return ONLY valid JSON with format: {\"suggestions\":[{\"label\":...,\"insert_text\":...}]}\n"
        "Task: autocomplete the following LaTeX text. Keep suggestions short and useful.\n"
        f"File: {payload.file_path or 'N/A'}\n"
        f"Text before cursor:\n{payload.before}\n\n"
        f"Text after cursor:\n{payload.after}\n"
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
