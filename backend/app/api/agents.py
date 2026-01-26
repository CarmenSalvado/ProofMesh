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
from app.schemas.agent import AgentRunRequest, AgentRunResponse, AgentProposal, AgentProfile, AgentListResponse

router = APIRouter(prefix="/api/agents", tags=["agents"])


AGENT_PROFILES: list[AgentProfile] = [
    AgentProfile(
        id="explorer",
        name="Explorer",
        task="propose",
        description="Generate candidate results or directions from the context.",
    ),
    AgentProfile(
        id="refiner",
        name="Refiner",
        task="extract",
        description="Extract structure, definitions, and math statements.",
    ),
    AgentProfile(
        id="verifier",
        name="Verifier",
        task="code",
        description="Propose a verification or computation scaffold.",
    ),
    AgentProfile(
        id="archivist",
        name="Archivist",
        task="summarize",
        description="Summarize the current notes into a clean digest.",
    ),
    AgentProfile(
        id="skeptic",
        name="Skeptic",
        task="critique",
        description="Highlight gaps, risks, or unclear assumptions.",
    ),
    AgentProfile(
        id="mapper",
        name="Mapper",
        task="map",
        description="Outline next steps and dependencies.",
    ),
]


def resolve_agent(agent_id: str | None, task: str | None) -> AgentProfile | None:
    if agent_id:
        return next((agent for agent in AGENT_PROFILES if agent.id == agent_id), None)
    if task:
        return next((agent for agent in AGENT_PROFILES if agent.task == task), None)
    return None


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


@router.get("", response_model=AgentListResponse)
async def list_agents():
    return AgentListResponse(agents=AGENT_PROFILES)


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
    agent_profile = resolve_agent(data.agent_id, data.task)
    agent_id = agent_profile.id if agent_profile else data.agent_id
    agent_name = agent_profile.name if agent_profile else None
    task = (data.task or (agent_profile.task if agent_profile else "propose")).lower()

    if snippet and task in {"propose", "summarize"}:
        proposals.append(
            AgentProposal(
                id=str(uuid.uuid4()),
                agent_id=agent_id,
                agent_name=agent_name,
                title="Context summary" if task == "propose" else "Summary",
                kind="analysis",
                content_markdown=f"**Context**\\n\\n{snippet}",
                cell_type="markdown",
            )
        )

    if task == "code" or "import" in context or "def " in context:
        proposals.append(
            AgentProposal(
                id=str(uuid.uuid4()),
                agent_id=agent_id,
                agent_name=agent_name,
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

    if task in {"extract", "map"}:
        latex = extract_latex_snippets(context)
        if latex:
            content = "\\n\\n".join([f"$$\\n{expr}\\n$$" for expr in latex])
            proposals.append(
                AgentProposal(
                    id=str(uuid.uuid4()),
                    agent_id=agent_id,
                    agent_name=agent_name,
                    title="Extracted math",
                    kind="math",
                    content_markdown=content,
                    cell_type="markdown",
                )
            )

    if task == "critique" and snippet:
        proposals.append(
            AgentProposal(
                id=str(uuid.uuid4()),
                agent_id=agent_id,
                agent_name=agent_name,
                title="Potential gaps",
                kind="analysis",
                content_markdown=(
                    "- Clarify assumptions for each step.\\n"
                    "- Identify dependencies on external results.\\n"
                    "- Note any unverified claims."
                ),
                cell_type="markdown",
            )
        )

    if task == "map" and snippet:
        proposals.append(
            AgentProposal(
                id=str(uuid.uuid4()),
                agent_id=agent_id,
                agent_name=agent_name,
                title="Next steps",
                kind="analysis",
                content_markdown=(
                    "1. Formalize the goal statement.\\n"
                    "2. List known lemmas and missing links.\\n"
                    "3. Choose a verification path."
                ),
                cell_type="markdown",
            )
        )

    if not proposals:
        proposals.append(
            AgentProposal(
                id=str(uuid.uuid4()),
                agent_id=agent_id,
                agent_name=agent_name,
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
