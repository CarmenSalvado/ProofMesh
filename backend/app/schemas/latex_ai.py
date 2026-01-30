from __future__ import annotations

from pydantic import BaseModel, Field


class LatexChatMessage(BaseModel):
    role: str = Field(..., description="user or assistant")
    content: str


class LatexChatRequest(BaseModel):
    message: str
    file_path: str | None = None
    selection: str | None = None
    context: str | None = None
    history: list[LatexChatMessage] = Field(default_factory=list)


class LatexChatResponse(BaseModel):
    reply: str


class LatexAutocompleteRequest(BaseModel):
    file_path: str | None = None
    before: str
    after: str
    max_suggestions: int = Field(default=3, ge=1, le=5)


class LatexAutocompleteItem(BaseModel):
    label: str
    insert_text: str


class LatexAutocompleteResponse(BaseModel):
    suggestions: list[LatexAutocompleteItem]
