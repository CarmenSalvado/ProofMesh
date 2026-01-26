"""Realtime collaboration WebSocket API."""

from datetime import datetime, timedelta
from typing import Any
import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from jose import jwt, JWTError

from app.config import get_settings
from app.schemas.realtime import (
    MessageType,
    UserPresence,
    RealtimeMessage,
    PresenceUpdate,
)

router = APIRouter(prefix="/ws", tags=["realtime"])
settings = get_settings()

# In-memory store for active connections and presence
# In production, use Redis for multi-instance support
class ConnectionManager:
    """Manages WebSocket connections for realtime collaboration."""
    
    def __init__(self):
        # problem_id -> {user_id: WebSocket}
        self.active_connections: dict[str, dict[str, WebSocket]] = {}
        # problem_id -> {user_id: UserPresence}
        self.presence: dict[str, dict[str, UserPresence]] = {}
        # problem_id -> document content (simple sync, not CRDT)
        self.documents: dict[str, dict[str, str]] = {}
        # problem_id -> canvas state
        self.canvas_states: dict[str, dict[str, Any]] = {}
        # Lock for thread safety
        self._lock = asyncio.Lock()
    
    async def connect(
        self,
        websocket: WebSocket,
        problem_id: str,
        user_id: str,
        username: str,
        display_name: str | None = None,
    ) -> None:
        """Accept a new WebSocket connection."""
        await websocket.accept()
        
        async with self._lock:
            if problem_id not in self.active_connections:
                self.active_connections[problem_id] = {}
                self.presence[problem_id] = {}
            
            # Close existing connection for same user if any
            if user_id in self.active_connections[problem_id]:
                try:
                    await self.active_connections[problem_id][user_id].close()
                except Exception:
                    pass
            
            self.active_connections[problem_id][user_id] = websocket
            
            # Generate avatar color based on user_id
            colors = [
                "#ef4444", "#f97316", "#eab308", "#22c55e",
                "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
            ]
            avatar_color = colors[hash(user_id) % len(colors)]
            
            self.presence[problem_id][user_id] = UserPresence(
                user_id=user_id,
                username=username,
                display_name=display_name,
                avatar_color=avatar_color,
                last_active=datetime.utcnow(),
            )
        
        # Broadcast presence update to all users in room
        await self.broadcast_presence(problem_id)
    
    async def disconnect(self, problem_id: str, user_id: str) -> None:
        """Handle WebSocket disconnection."""
        async with self._lock:
            if problem_id in self.active_connections:
                self.active_connections[problem_id].pop(user_id, None)
                self.presence[problem_id].pop(user_id, None)
                
                # Clean up empty rooms
                if not self.active_connections[problem_id]:
                    del self.active_connections[problem_id]
                    self.presence.pop(problem_id, None)
                    self.documents.pop(problem_id, None)
                    self.canvas_states.pop(problem_id, None)
                    return
        
        # Broadcast updated presence
        await self.broadcast_presence(problem_id)
    
    async def broadcast(
        self,
        problem_id: str,
        message: dict[str, Any],
        exclude_user: str | None = None,
    ) -> None:
        """Broadcast message to all users in a problem workspace."""
        if problem_id not in self.active_connections:
            return
        
        message_str = json.dumps(message, default=str)
        disconnected = []
        
        for user_id, connection in self.active_connections[problem_id].items():
            if user_id == exclude_user:
                continue
            try:
                await connection.send_text(message_str)
            except Exception:
                disconnected.append(user_id)
        
        # Clean up disconnected users
        for user_id in disconnected:
            await self.disconnect(problem_id, user_id)
    
    async def broadcast_presence(self, problem_id: str) -> None:
        """Broadcast current presence to all users in room."""
        if problem_id not in self.presence:
            return
        
        users = list(self.presence[problem_id].values())
        message = PresenceUpdate(type=MessageType.PRESENCE, users=users)
        await self.broadcast(problem_id, message.model_dump())
    
    async def update_cursor(
        self,
        problem_id: str,
        user_id: str,
        x: float | None = None,
        y: float | None = None,
        file_path: str | None = None,
    ) -> None:
        """Update user cursor position."""
        async with self._lock:
            if problem_id in self.presence and user_id in self.presence[problem_id]:
                presence = self.presence[problem_id][user_id]
                presence.cursor_x = x
                presence.cursor_y = y
                presence.active_file = file_path
                presence.last_active = datetime.utcnow()
        
        # Broadcast cursor update
        message = {
            "type": MessageType.CURSOR_MOVE.value,
            "user_id": user_id,
            "cursor_x": x,
            "cursor_y": y,
            "active_file": file_path,
        }
        await self.broadcast(problem_id, message, exclude_user=user_id)
    
    async def update_selection(
        self,
        problem_id: str,
        user_id: str,
        start: int | None = None,
        end: int | None = None,
        file_path: str | None = None,
    ) -> None:
        """Update user text selection."""
        async with self._lock:
            if problem_id in self.presence and user_id in self.presence[problem_id]:
                presence = self.presence[problem_id][user_id]
                presence.selection_start = start
                presence.selection_end = end
                presence.active_file = file_path
                presence.last_active = datetime.utcnow()
        
        message = {
            "type": MessageType.SELECTION.value,
            "user_id": user_id,
            "selection_start": start,
            "selection_end": end,
            "active_file": file_path,
        }
        await self.broadcast(problem_id, message, exclude_user=user_id)
    
    async def sync_document(
        self,
        problem_id: str,
        user_id: str,
        path: str,
        content: str,
    ) -> None:
        """Sync document content to all users."""
        async with self._lock:
            if problem_id not in self.documents:
                self.documents[problem_id] = {}
            self.documents[problem_id][path] = content
        
        message = {
            "type": MessageType.DOC_SYNC.value,
            "path": path,
            "content": content,
            "from_user": user_id,
        }
        await self.broadcast(problem_id, message, exclude_user=user_id)
    
    async def sync_canvas(
        self,
        problem_id: str,
        user_id: str,
        nodes: list[dict],
        edges: list[dict],
    ) -> None:
        """Sync canvas state to all users."""
        async with self._lock:
            self.canvas_states[problem_id] = {
                "nodes": nodes,
                "edges": edges,
            }
        
        message = {
            "type": MessageType.CANVAS_SYNC.value,
            "nodes": nodes,
            "edges": edges,
            "from_user": user_id,
        }
        await self.broadcast(problem_id, message, exclude_user=user_id)
    
    async def broadcast_node_operation(
        self,
        problem_id: str,
        user_id: str,
        operation: str,
        node_data: dict,
    ) -> None:
        """Broadcast canvas node operation."""
        message = {
            "type": operation,
            "node": node_data,
            "from_user": user_id,
        }
        await self.broadcast(problem_id, message, exclude_user=user_id)
    
    async def broadcast_edge_operation(
        self,
        problem_id: str,
        user_id: str,
        operation: str,
        edge_data: dict,
    ) -> None:
        """Broadcast canvas edge operation."""
        message = {
            "type": operation,
            "edge": edge_data,
            "from_user": user_id,
        }
        await self.broadcast(problem_id, message, exclude_user=user_id)
    
    def get_presence(self, problem_id: str) -> list[UserPresence]:
        """Get all users present in a problem workspace."""
        if problem_id not in self.presence:
            return []
        return list(self.presence[problem_id].values())
    
    def get_user_count(self, problem_id: str) -> int:
        """Get number of users in a problem workspace."""
        if problem_id not in self.active_connections:
            return 0
        return len(self.active_connections[problem_id])


# Global connection manager instance
manager = ConnectionManager()


def get_user_from_token(token: str) -> tuple[str, str, str | None]:
    """Extract user info from JWT token."""
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=["HS256"],
        )
        user_id = payload.get("sub")
        username = payload.get("username", "anonymous")
        display_name = payload.get("display_name")
        
        if user_id is None:
            raise ValueError("Invalid token")
        
        return str(user_id), username, display_name
    except JWTError as e:
        raise ValueError(f"Invalid token: {e}")


@router.websocket("/collaborate/{problem_id}")
async def websocket_collaborate(
    websocket: WebSocket,
    problem_id: str,
):
    """WebSocket endpoint for realtime collaboration on a problem workspace."""
    
    # Get token from query params
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001, reason="Authentication required")
        return
    
    try:
        user_id, username, display_name = get_user_from_token(token)
    except ValueError as e:
        await websocket.close(code=4001, reason=str(e))
        return
    
    # Connect to the collaboration room
    await manager.connect(websocket, problem_id, user_id, username, display_name)
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            msg_type = message.get("type")
            
            if msg_type == MessageType.CURSOR_MOVE.value:
                await manager.update_cursor(
                    problem_id,
                    user_id,
                    x=message.get("x"),
                    y=message.get("y"),
                    file_path=message.get("file_path"),
                )
            
            elif msg_type == MessageType.SELECTION.value:
                await manager.update_selection(
                    problem_id,
                    user_id,
                    start=message.get("start"),
                    end=message.get("end"),
                    file_path=message.get("file_path"),
                )
            
            elif msg_type == MessageType.DOC_SYNC.value:
                await manager.sync_document(
                    problem_id,
                    user_id,
                    path=message.get("path", ""),
                    content=message.get("content", ""),
                )
            
            elif msg_type == MessageType.DOC_EDIT.value:
                # Broadcast edit operation to all
                await manager.broadcast(
                    problem_id,
                    {
                        "type": MessageType.DOC_EDIT.value,
                        "edit": message.get("edit"),
                        "from_user": user_id,
                    },
                    exclude_user=user_id,
                )
            
            elif msg_type == MessageType.CANVAS_SYNC.value:
                await manager.sync_canvas(
                    problem_id,
                    user_id,
                    nodes=message.get("nodes", []),
                    edges=message.get("edges", []),
                )
            
            elif msg_type == MessageType.NODE_CREATE.value:
                await manager.broadcast_node_operation(
                    problem_id, user_id,
                    MessageType.NODE_CREATE.value,
                    message.get("node", {}),
                )
            
            elif msg_type == MessageType.NODE_UPDATE.value:
                await manager.broadcast_node_operation(
                    problem_id, user_id,
                    MessageType.NODE_UPDATE.value,
                    message.get("node", {}),
                )
            
            elif msg_type == MessageType.NODE_DELETE.value:
                await manager.broadcast(
                    problem_id,
                    {
                        "type": MessageType.NODE_DELETE.value,
                        "node_id": message.get("node_id"),
                        "from_user": user_id,
                    },
                    exclude_user=user_id,
                )
            
            elif msg_type == MessageType.NODE_MOVE.value:
                await manager.broadcast(
                    problem_id,
                    {
                        "type": MessageType.NODE_MOVE.value,
                        "node_id": message.get("node_id"),
                        "x": message.get("x"),
                        "y": message.get("y"),
                        "from_user": user_id,
                    },
                    exclude_user=user_id,
                )
            
            elif msg_type == MessageType.EDGE_CREATE.value:
                await manager.broadcast_edge_operation(
                    problem_id, user_id,
                    MessageType.EDGE_CREATE.value,
                    message.get("edge", {}),
                )
            
            elif msg_type == MessageType.EDGE_DELETE.value:
                await manager.broadcast(
                    problem_id,
                    {
                        "type": MessageType.EDGE_DELETE.value,
                        "from": message.get("from"),
                        "to": message.get("to"),
                        "from_user": user_id,
                    },
                    exclude_user=user_id,
                )
    
    except WebSocketDisconnect:
        await manager.disconnect(problem_id, user_id)
    except Exception as e:
        print(f"WebSocket error: {e}")
        await manager.disconnect(problem_id, user_id)


@router.get("/presence/{problem_id}")
async def get_presence(problem_id: str):
    """Get current presence info for a problem workspace (REST fallback)."""
    users = manager.get_presence(problem_id)
    return {
        "problem_id": problem_id,
        "user_count": len(users),
        "users": [u.model_dump() for u in users],
    }
