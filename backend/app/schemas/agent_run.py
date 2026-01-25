from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict

from app.models.agent_run import AgentRunStatus
from app.models.library_item import LibraryItemKind


class AgentProposal(BaseModel):
    """Single proposal from an agent run"""
    title: str
    kind: LibraryItemKind
    content_markdown: str
    dependencies: list[UUID] = []
    suggested_verification: str | None = None


class AgentOutput(BaseModel):
    """Complete agent output (per CLAUDE.md contract)"""
    summary: str
    proposals: list[AgentProposal]
    publish: list[AgentProposal]
    notes: str | None = None


class AgentRunCreate(BaseModel):
    """Minimal info to start an agent run"""
    pass  # Canvas context is captured automatically


class AgentRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    canvas_id: UUID
    status: AgentRunStatus
    input_context: dict
    output: dict | None
    tool_logs: dict | None
    created_at: datetime
    completed_at: datetime | None
