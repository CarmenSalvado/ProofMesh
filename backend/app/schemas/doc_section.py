from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel


# DocSection schemas
class DocSectionBase(BaseModel):
    title: str
    level: int = 1
    order_index: int = 0
    content_preview: Optional[str] = None


class DocSectionCreate(BaseModel):
    title: str
    slug: Optional[str] = None
    level: int = 2
    order_index: Optional[int] = None
    content_preview: Optional[str] = None


class DocSectionUpdate(BaseModel):
    slug: Optional[str] = None
    title: Optional[str] = None
    level: Optional[int] = None
    order_index: Optional[int] = None
    content_preview: Optional[str] = None


class DocSectionResponse(BaseModel):
    id: UUID
    workspace_file_id: UUID
    slug: str
    title: str
    level: int
    order_index: int
    content_preview: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    anchor_count: int = 0
    has_stale_anchors: bool = False

    class Config:
        from_attributes = True


# DocAnchor schemas
class DocAnchorBase(BaseModel):
    section_id: UUID
    library_item_id: UUID
    position_hint: Optional[str] = None


class DocAnchorCreate(DocAnchorBase):
    pass


class DocAnchorUpdate(BaseModel):
    section_id: Optional[UUID] = None
    position_hint: Optional[str] = None
    is_stale: Optional[bool] = None


class DocAnchorResponse(DocAnchorBase):
    id: UUID
    library_item_updated_at: datetime
    is_stale: bool
    created_at: datetime
    updated_at: datetime
    
    # Nested info for UI
    library_item_title: Optional[str] = None
    library_item_kind: Optional[str] = None

    class Config:
        from_attributes = True


# Commit to Document request/response
class CommitToDocumentRequest(BaseModel):
    """Request to convert selected canvas nodes into a document section"""
    node_ids: list[UUID]
    workspace_file_id: Optional[UUID] = None
    workspace_file_path: Optional[str] = None  # Alternative: file path
    section_title: str
    section_slug: Optional[str] = None
    insert_after_section_id: Optional[UUID] = None
    format: str = "markdown"  # "markdown" or "latex"


class CommitToDocumentResponse(BaseModel):
    section: DocSectionResponse
    anchors: list[DocAnchorResponse]
    generated_content: str
