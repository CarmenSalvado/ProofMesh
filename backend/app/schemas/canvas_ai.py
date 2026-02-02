"""
Pydantic schemas for Canvas AI runs and chat messages.
"""
from __future__ import annotations

from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field
from enum import Enum


class CanvasAIRunStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class CanvasAIRunType(str, Enum):
    EXPLORE = "explore"
    FORMALIZE = "formalize"
    VERIFY = "verify"
    CRITIQUE = "critique"
    PIPELINE = "pipeline"
    CHAT = "chat"


class NodeStateType(str, Enum):
    IDLE = "idle"
    THINKING = "thinking"
    GENERATING = "generating"
    VERIFYING = "verifying"
    COMPLETE = "complete"
    ERROR = "error"


# ==================== Request Schemas ====================

class CreateRunRequest(BaseModel):
    run_type: CanvasAIRunType = Field(default=CanvasAIRunType.EXPLORE)
    prompt: str = Field(..., min_length=1)
    context: dict | None = Field(default=None, description="Selected nodes, options, etc.")


class CreateMessageRequest(BaseModel):
    role: str = Field(..., pattern="^(user|assistant|system|action)$")
    content: str = Field(..., min_length=1)
    run_id: UUID | None = None
    message_data: dict | None = None


class UpdateNodeStateRequest(BaseModel):
    node_id: UUID | None = None
    temp_node_id: str | None = None
    state: NodeStateType = Field(default=NodeStateType.IDLE)
    state_data: dict | None = None


class CancelRunRequest(BaseModel):
    run_id: UUID


# ==================== Response Schemas ====================

class NodeCreatedSummary(BaseModel):
    id: str
    title: str
    kind: str


class EdgeCreatedSummary(BaseModel):
    from_id: str
    to_id: str
    edge_type: str = Field(alias="type")

    class Config:
        populate_by_name = True


class ActionSummaryData(BaseModel):
    """Structured data for action summary messages in chat."""
    type: str = "action_summary"
    action: str  # explore, formalize, verify, etc.
    run_id: str | None = None
    nodes_created: list[NodeCreatedSummary] = Field(default_factory=list)
    edges_created: list[EdgeCreatedSummary] = Field(default_factory=list)
    verification_result: dict | None = None
    error: str | None = None


class CanvasAIMessageResponse(BaseModel):
    id: UUID
    problem_id: UUID
    run_id: UUID | None
    user_id: UUID | None
    role: str
    content: str
    message_data: dict | None
    created_at: datetime

    class Config:
        from_attributes = True


class CanvasAIRunResponse(BaseModel):
    id: UUID
    problem_id: UUID
    user_id: UUID
    run_type: str
    prompt: str
    context: dict | None
    status: str
    progress: int
    current_step: str | None
    summary: str | None
    steps: list
    created_nodes: list
    created_edges: list
    result: dict | None
    error: str | None
    created_at: datetime
    started_at: datetime | None
    completed_at: datetime | None
    redis_job_id: str | None

    class Config:
        from_attributes = True


class CanvasAIRunWithMessagesResponse(CanvasAIRunResponse):
    messages: list[CanvasAIMessageResponse] = Field(default_factory=list)


class CanvasAINodeStateResponse(BaseModel):
    id: UUID
    run_id: UUID
    node_id: UUID | None
    temp_node_id: str | None
    state: str
    state_data: dict | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ChatHistoryResponse(BaseModel):
    messages: list[CanvasAIMessageResponse]
    total: int
    has_more: bool


class ActiveRunsResponse(BaseModel):
    runs: list[CanvasAIRunResponse]


# ==================== WebSocket/SSE Event Schemas ====================

class RunProgressEvent(BaseModel):
    """Sent via WebSocket when run progress updates."""
    event_type: str = "run_progress"
    run_id: str
    status: str
    progress: int
    current_step: str | None = None


class NodeStateEvent(BaseModel):
    """Sent via WebSocket when a node's visual state changes."""
    event_type: str = "node_state"
    run_id: str
    node_id: str | None = None
    temp_node_id: str | None = None
    state: str
    state_data: dict | None = None


class NodeCreatedEvent(BaseModel):
    """Sent via WebSocket when a new node is created during a run."""
    event_type: str = "node_created"
    run_id: str
    node: dict  # Full node data


class EdgeCreatedEvent(BaseModel):
    """Sent via WebSocket when a new edge is created during a run."""
    event_type: str = "edge_created"
    run_id: str
    edge: dict  # Edge data


class RunCompletedEvent(BaseModel):
    """Sent via WebSocket when a run completes."""
    event_type: str = "run_completed"
    run_id: str
    status: str
    summary: str | None = None
    created_nodes: list[NodeCreatedSummary] = Field(default_factory=list)
    created_edges: list[EdgeCreatedSummary] = Field(default_factory=list)
    error: str | None = None


class MessageAddedEvent(BaseModel):
    """Sent via WebSocket when a new chat message is added."""
    event_type: str = "message_added"
    message: CanvasAIMessageResponse
