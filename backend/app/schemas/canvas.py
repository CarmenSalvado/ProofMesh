from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict
from enum import Enum


class CanvasStatus(str, Enum):
    DRAFT = "draft"
    VERIFIED = "verified"
    REVIEWING = "reviewing"


class CanvasCreate(BaseModel):
    title: str
    content: str = ""
    folder: str = "/"


class CanvasUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    folder: str | None = None
    status: CanvasStatus | None = None


class CanvasResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    problem_id: UUID
    title: str
    content: str
    folder: str = "/"
    status: CanvasStatus = CanvasStatus.DRAFT
    created_at: datetime
    updated_at: datetime


class CanvasListResponse(BaseModel):
    canvases: list[CanvasResponse]
    total: int


class CanvasBriefResponse(BaseModel):
    """Brief response for listing canvases without full content"""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    problem_id: UUID
    title: str
    folder: str = "/"
    status: CanvasStatus = CanvasStatus.DRAFT
    created_at: datetime
    updated_at: datetime
