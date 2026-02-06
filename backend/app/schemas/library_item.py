from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict
from enum import Enum


class LibraryItemKind(str, Enum):
    RESOURCE = "RESOURCE"
    IDEA = "IDEA"
    CONTENT = "CONTENT"
    FORMAL_TEST = "FORMAL_TEST"
    LEMMA = "LEMMA"
    CLAIM = "CLAIM"
    DEFINITION = "DEFINITION"
    THEOREM = "THEOREM"
    COUNTEREXAMPLE = "COUNTEREXAMPLE"
    COMPUTATION = "COMPUTATION"
    NOTE = "NOTE"


class LibraryItemStatus(str, Enum):
    PROPOSED = "PROPOSED"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"


class AuthorInfo(BaseModel):
    type: str  # "human" or "agent"
    id: str
    name: str | None = None
    avatar_url: str | None = None


class SourceInfo(BaseModel):
    file_path: str | None = None
    cell_id: str | None = None
    agent_run_id: UUID | None = None


class VerificationInfo(BaseModel):
    method: str
    logs: str
    status: str  # "pass", "fail", "error"


class LibraryItemCreate(BaseModel):
    title: str
    kind: LibraryItemKind
    content: str
    formula: str | None = None
    lean_code: str | None = None
    x: float | None = None
    y: float | None = None
    authors: list[AuthorInfo] = []
    source: SourceInfo | None = None
    dependencies: list[UUID] = []


class LibraryItemUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    formula: str | None = None
    lean_code: str | None = None
    status: LibraryItemStatus | None = None
    verification: VerificationInfo | None = None
    dependencies: list[UUID] | None = None
    x: float | None = None
    y: float | None = None


class LibraryItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    problem_id: UUID
    title: str
    kind: LibraryItemKind
    content: str
    formula: str | None
    lean_code: str | None
    status: LibraryItemStatus
    x: float | None
    y: float | None
    authors: list[AuthorInfo]
    source: dict | None
    dependencies: list[UUID]
    verification: dict | None
    created_at: datetime
    updated_at: datetime


class NodeActivityEntry(BaseModel):
    """Activity entry for node history/timeline"""
    id: str
    type: str  # "created", "updated", "verified", "commented", "agent_generated"
    user: AuthorInfo | None = None
    description: str
    timestamp: datetime
    metadata: dict | None = None


class NodeActivityHistoryResponse(BaseModel):
    """Response for node activity history"""
    node_id: UUID
    activities: list[NodeActivityEntry]
    total: int


class LibraryItemListResponse(BaseModel):
    items: list[LibraryItemResponse]
    total: int
