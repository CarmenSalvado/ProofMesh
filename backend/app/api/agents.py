from __future__ import annotations

import re
import uuid
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.problem import Problem, ProblemVisibility
from app.models.user import User
from app.api.deps import get_current_user_optional
from app.schemas.agent import AgentRunRequest, AgentRunResponse, AgentProposal

router = APIRouter(prefix="/api/agents", tags=["agents"])


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


def extract_latex_snippets(text: str) -> list[str]:
    snippets = []
    for block in re.findall(r"\$\$(.+?)\$\$", text, flags=re.DOTALL):
        snippet = block.strip()
        if snippet:
            snippets.append(snippet)
    for inline in re.findall(r"\$(.+?)\$", text):
        snippet = inline.strip()
        if snippet:
            snippets.append(snippet)
    return snippets[:3]


@router.post("/run", response_model=AgentRunResponse)
async def run_agent(
    data: AgentRunRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    await verify_problem_access(data.problem_id, db, current_user)

    context = (data.context or "").strip()
    snippet = context[:600] if context else ""
    proposals: list[AgentProposal] = []

    if snippet:
        proposals.append(
            AgentProposal(
                id=str(uuid.uuid4()),
                title="Context summary",
                kind="analysis",
                content_markdown=f"**Context**\\n\\n{snippet}",
                cell_type="markdown",
            )
        )

    if data.task == "code" or "import" in context or "def " in context:
        proposals.append(
            AgentProposal(
                id=str(uuid.uuid4()),
                title="Computation scaffold",
                kind="code",
                content_markdown=(
                    "# TODO: implement computation\\n"
                    "import math\\n\\n"
                    "def compute():\\n"
                    "    pass\\n\\n"
                    "compute()\\n"
                ),
                cell_type="code",
            )
        )

    latex = extract_latex_snippets(context)
    if latex:
        content = "\\n\\n".join([f"$$\\n{expr}\\n$$" for expr in latex])
        proposals.append(
            AgentProposal(
                id=str(uuid.uuid4()),
                title="Extracted math",
                kind="math",
                content_markdown=content,
                cell_type="markdown",
            )
        )

    if not proposals:
        proposals.append(
            AgentProposal(
                id=str(uuid.uuid4()),
                title="Blank proposal",
                kind="analysis",
                content_markdown="No context available. Add a cell and try again.",
                cell_type="markdown",
            )
        )

    return AgentRunResponse(
        run_id=uuid.uuid4(),
        status="completed",
        summary="Generated draft proposals from current notebook context.",
        proposals=proposals,
    )
