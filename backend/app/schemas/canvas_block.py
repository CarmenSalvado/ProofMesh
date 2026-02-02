from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field


class CanvasBlockBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    node_ids: list[UUID] = Field(default_factory=list)


class CanvasBlockCreate(CanvasBlockBase):
    """Schema for creating a new canvas block."""
    pass


class CanvasBlockUpdate(BaseModel):
    """Schema for updating a canvas block."""
    name: str = Field(..., min_length=1, max_length=255)
    node_ids: list[UUID] = Field(default_factory=list)


class CanvasBlockResponse(CanvasBlockBase):
    """Schema for canvas block response."""
    id: UUID
    problem_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True