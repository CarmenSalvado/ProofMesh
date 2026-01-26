from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict
from enum import Enum


class LibraryItemKind(str, Enum):
    RESOURCE = "resource"
    IDEA = "idea"
    CONTENT = "content"
    LEMMA = "lemma"
    CLAIM = "claim"
    DEFINITION = "definition"
    THEOREM = "theorem"
    COUNTEREXAMPLE = "counterexample"
    COMPUTATION = "computation"
    NOTE = "note"


class LibraryItemStatus(str, Enum):
    PROPOSED = "proposed"
    VERIFIED = "verified"
    REJECTED = "rejected"


class AuthorInfo(BaseModel):
    type: str  # "human" or "agent"
    id: str
    name: str | None = None


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
    authors: list[AuthorInfo] = []
    source: SourceInfo | None = None
    dependencies: list[UUID] = []


class LibraryItemUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    formula: str | None = None
    status: LibraryItemStatus | None = None
    verification: VerificationInfo | None = None


class LibraryItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    problem_id: UUID
    title: str
    kind: LibraryItemKind
    content: str
    formula: str | None
    status: LibraryItemStatus
    authors: list[dict]
    source: dict | None
    dependencies: list[UUID]
    verification: dict | None
    created_at: datetime
    updated_at: datetime


class LibraryItemListResponse(BaseModel):
    items: list[LibraryItemResponse]
    total: int
