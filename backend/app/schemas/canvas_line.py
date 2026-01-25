from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict

from app.models.canvas_line import LineType, AuthorType


class CanvasLineCreate(BaseModel):
    type: LineType
    content: str
    author_type: AuthorType = AuthorType.HUMAN
    author_id: str
    order_key: str | None = None  # Auto-generated if not provided
    agent_run_id: UUID | None = None
    library_item_id: UUID | None = None


class CanvasLineUpdate(BaseModel):
    content: str | None = None
    type: LineType | None = None
    order_key: str | None = None


class CanvasLineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    canvas_id: UUID
    order_key: str
    type: LineType
    content: str
    author_type: AuthorType
    author_id: str
    agent_run_id: UUID | None
    library_item_id: UUID | None
    derived_from: UUID | None
    created_at: datetime
    updated_at: datetime
