"""
WebSocket connection manager for real-time communication
"""
import asyncio
import json
from datetime import datetime
from typing import Any
from uuid import UUID
from fastapi import WebSocket
from dataclasses import dataclass, asdict


@dataclass
class WSMessage:
    """WebSocket message structure"""
    type: str  # "log", "agent_status", "canvas_update", "error"
    data: dict
    timestamp: str = ""
    
    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.utcnow().isoformat()
    
    def to_json(self) -> str:
        return json.dumps(asdict(self))


class ConnectionManager:
    """Manages WebSocket connections per canvas"""
    
    def __init__(self):
        # canvas_id -> list of connections
        self.active_connections: dict[str, list[WebSocket]] = {}
        # user_id -> list of connections (for user-level notifications)
        self.user_connections: dict[str, list[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, canvas_id: str, user_id: str | None = None):
        """Accept and register a new connection"""
        await websocket.accept()
        
        if canvas_id not in self.active_connections:
            self.active_connections[canvas_id] = []
        self.active_connections[canvas_id].append(websocket)
        
        if user_id:
            if user_id not in self.user_connections:
                self.user_connections[user_id] = []
            self.user_connections[user_id].append(websocket)
        
        # Send connection confirmation
        await websocket.send_json({
            "type": "connected",
            "data": {"canvas_id": canvas_id, "user_id": user_id},
            "timestamp": datetime.utcnow().isoformat()
        })
    
    def disconnect(self, websocket: WebSocket, canvas_id: str, user_id: str | None = None):
        """Remove a connection"""
        if canvas_id in self.active_connections:
            if websocket in self.active_connections[canvas_id]:
                self.active_connections[canvas_id].remove(websocket)
            if not self.active_connections[canvas_id]:
                del self.active_connections[canvas_id]
        
        if user_id and user_id in self.user_connections:
            if websocket in self.user_connections[user_id]:
                self.user_connections[user_id].remove(websocket)
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]
    
    async def broadcast_to_canvas(self, canvas_id: str, message: WSMessage):
        """Send message to all connections for a canvas"""
        if canvas_id not in self.active_connections:
            return
        
        disconnected = []
        for connection in self.active_connections[canvas_id]:
            try:
                await connection.send_text(message.to_json())
            except Exception:
                disconnected.append(connection)
        
        # Clean up disconnected
        for conn in disconnected:
            self.active_connections[canvas_id].remove(conn)
    
    async def broadcast_to_user(self, user_id: str, message: WSMessage):
        """Send message to all connections for a user"""
        if user_id not in self.user_connections:
            return
        
        disconnected = []
        for connection in self.user_connections[user_id]:
            try:
                await connection.send_text(message.to_json())
            except Exception:
                disconnected.append(connection)
        
        for conn in disconnected:
            self.user_connections[user_id].remove(conn)
    
    async def send_log(self, canvas_id: str, agent: str | None, message: str, level: str = "info"):
        """Send a log message to canvas subscribers"""
        await self.broadcast_to_canvas(canvas_id, WSMessage(
            type="log",
            data={
                "agent": agent,
                "message": message,
                "level": level,  # "info", "success", "warning", "error"
            }
        ))
    
    async def send_agent_status(
        self, 
        canvas_id: str, 
        agent_id: str, 
        name: str, 
        status: str, 
        task: str | None = None,
        progress: int | None = None
    ):
        """Send agent status update"""
        await self.broadcast_to_canvas(canvas_id, WSMessage(
            type="agent_status",
            data={
                "agent_id": agent_id,
                "name": name,
                "status": status,  # "idle", "working", "thinking", "error"
                "task": task,
                "progress": progress,
            }
        ))
    
    async def send_canvas_update(self, canvas_id: str, update_type: str, data: dict):
        """Send canvas content update"""
        await self.broadcast_to_canvas(canvas_id, WSMessage(
            type="canvas_update",
            data={"update_type": update_type, **data}
        ))


# Global connection manager instance
manager = ConnectionManager()
