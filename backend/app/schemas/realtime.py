"""Realtime collaboration schemas for WebSocket communication."""

from datetime import datetime
from enum import Enum
from typing import Any, Optional
from pydantic import BaseModel, Field


class MessageType(str, Enum):
    """Types of realtime collaboration messages."""
    
    # Presence
    JOIN = "join"
    LEAVE = "leave"
    PRESENCE = "presence"
    CURSOR_MOVE = "cursor_move"
    SELECTION = "selection"
    
    # Document operations
    DOC_SYNC = "doc_sync"
    DOC_EDIT = "doc_edit"
    DOC_SAVE = "doc_save"
    
    # Canvas operations
    CANVAS_SYNC = "canvas_sync"
    NODE_CREATE = "node_create"
    NODE_UPDATE = "node_update"
    NODE_DELETE = "node_delete"
    NODE_MOVE = "node_move"
    EDGE_CREATE = "edge_create"
    EDGE_DELETE = "edge_delete"
    
    # System
    ERROR = "error"
    ACK = "ack"


class UserPresence(BaseModel):
    """User presence information."""
    user_id: str
    username: str
    display_name: Optional[str] = None
    avatar_color: str = "#6366f1"  # Default indigo color
    cursor_x: Optional[float] = None
    cursor_y: Optional[float] = None
    selection_start: Optional[int] = None
    selection_end: Optional[int] = None
    active_file: Optional[str] = None
    last_active: datetime = Field(default_factory=datetime.utcnow)


class CursorPosition(BaseModel):
    """Cursor position in canvas or editor."""
    x: float
    y: float
    # For text editor, character position
    char_pos: Optional[int] = None
    line: Optional[int] = None
    column: Optional[int] = None


class TextSelection(BaseModel):
    """Text selection range."""
    start: int
    end: int
    start_line: Optional[int] = None
    end_line: Optional[int] = None


class DocumentEdit(BaseModel):
    """Document edit operation (OT-like)."""
    path: str
    operation: str  # "insert", "delete", "replace"
    position: int
    text: Optional[str] = None  # For insert/replace
    length: Optional[int] = None  # For delete/replace
    version: int  # For conflict resolution


class CanvasNodeData(BaseModel):
    """Canvas node data for sync."""
    id: str
    type: str  # axiom, lemma, theorem, claim, proof-step, note
    title: str
    content: Optional[str] = None
    x: float
    y: float
    width: Optional[float] = None
    height: Optional[float] = None
    status: str = "draft"  # draft, pending, verified, error
    dependencies: list[str] = Field(default_factory=list)


class CanvasEdgeData(BaseModel):
    """Canvas edge data for sync."""
    from_node: str = Field(alias="from")
    to_node: str = Field(alias="to")
    edge_type: str = "implies"  # implies, uses, contradicts, references

    class Config:
        populate_by_name = True


class RealtimeMessage(BaseModel):
    """Base message for all realtime communication."""
    type: MessageType
    problem_id: int
    user_id: Optional[int] = None
    username: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    payload: dict[str, Any] = Field(default_factory=dict)


class JoinMessage(BaseModel):
    """Message sent when user joins workspace."""
    type: MessageType = MessageType.JOIN
    problem_id: int
    file_path: Optional[str] = None


class PresenceUpdate(BaseModel):
    """Presence update broadcast."""
    type: MessageType = MessageType.PRESENCE
    users: list[UserPresence]


class CursorMoveMessage(BaseModel):
    """Cursor movement message."""
    type: MessageType = MessageType.CURSOR_MOVE
    position: CursorPosition
    file_path: Optional[str] = None


class SelectionMessage(BaseModel):
    """Selection change message."""
    type: MessageType = MessageType.SELECTION
    selection: Optional[TextSelection] = None
    file_path: Optional[str] = None


class DocSyncMessage(BaseModel):
    """Full document sync."""
    type: MessageType = MessageType.DOC_SYNC
    path: str
    content: str
    version: int


class DocEditMessage(BaseModel):
    """Incremental document edit."""
    type: MessageType = MessageType.DOC_EDIT
    edit: DocumentEdit


class CanvasSyncMessage(BaseModel):
    """Full canvas state sync."""
    type: MessageType = MessageType.CANVAS_SYNC
    nodes: list[CanvasNodeData]
    edges: list[CanvasEdgeData]


class NodeOperationMessage(BaseModel):
    """Canvas node operation."""
    type: MessageType
    node: CanvasNodeData


class NodeMoveMessage(BaseModel):
    """Canvas node move operation."""
    type: MessageType = MessageType.NODE_MOVE
    node_id: str
    x: float
    y: float


class EdgeOperationMessage(BaseModel):
    """Canvas edge operation."""
    type: MessageType
    edge: CanvasEdgeData


class ErrorMessage(BaseModel):
    """Error message."""
    type: MessageType = MessageType.ERROR
    code: str
    message: str


class AckMessage(BaseModel):
    """Acknowledgment message."""
    type: MessageType = MessageType.ACK
    message_id: Optional[str] = None
