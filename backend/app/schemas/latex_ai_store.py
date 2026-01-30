from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, Field
from uuid import UUID


class LatexAIMemoryResponse(BaseModel):
    memory: str | None = None


class LatexAIMemoryUpdate(BaseModel):
    memory: str | None = None


class LatexAIQuickActionCreate(BaseModel):
    label: str
    prompt: str


class LatexAIQuickActionResponse(BaseModel):
    id: UUID
    label: str
    prompt: str
    created_at: datetime


class LatexAIMessageCreate(BaseModel):
    role: str
    content: str
    run_id: UUID | None = None


class LatexAIMessageResponse(BaseModel):
    id: UUID
    role: str
    content: str
    run_id: UUID | None = None
    created_at: datetime


class LatexAIRunCreate(BaseModel):
    prompt: str
    file_path: str | None = None
    selection: str | None = None


class LatexAIRunUpdate(BaseModel):
    summary: str | None = None
    status: str | None = None


class LatexAIRunResponse(BaseModel):
    id: UUID
    prompt: str
    summary: str | None = None
    status: str = "pending"
    steps: list = Field(default_factory=list)
    edits: list = Field(default_factory=list)
    file_path: str | None = None
    selection: str | None = None
    created_at: datetime


class LatexAIRunAppendStep(BaseModel):
    text: str


class LatexAIRunAppendEdit(BaseModel):
    start: dict
    end: dict
    text: str
