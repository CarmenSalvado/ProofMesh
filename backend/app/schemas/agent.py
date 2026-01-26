from __future__ import annotations

from uuid import UUID
from pydantic import BaseModel


class AgentRunRequest(BaseModel):
    problem_id: UUID
    file_path: str | None = None
    cell_id: str | None = None
    context: str | None = None
    task: str = "propose"
    instructions: str | None = None
    agent_id: str | None = None


class AgentProposal(BaseModel):
    id: str
    agent_id: str | None = None
    agent_name: str | None = None
    title: str
    kind: str
    content_markdown: str
    cell_type: str


class AgentProfile(BaseModel):
    id: str
    name: str
    task: str
    description: str


class AgentRunResponse(BaseModel):
    run_id: UUID
    status: str
    summary: str
    proposals: list[AgentProposal]


class AgentListResponse(BaseModel):
    agents: list[AgentProfile]
