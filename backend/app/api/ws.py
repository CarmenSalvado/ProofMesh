"""
WebSocket API endpoints for real-time communication
"""
from uuid import UUID
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.canvas import Canvas
from app.models.problem import Problem, ProblemVisibility
from app.services.websocket import manager, WSMessage
from app.services.auth import decode_token
from app.agents.orchestrator import orchestrator

router = APIRouter(tags=["websocket"])


async def get_user_id_from_token(token: str | None) -> str | None:
    """Extract user ID from JWT token"""
    if not token:
        return None
    
    payload = decode_token(token)
    if not payload:
        return None
    
    return payload.sub


@router.websocket("/ws/canvas/{canvas_id}")
async def websocket_canvas(
    websocket: WebSocket,
    canvas_id: str,
    token: str | None = Query(None),
):
    """
    WebSocket endpoint for real-time canvas updates
    
    Connect with: ws://localhost:8080/ws/canvas/{canvas_id}?token={jwt_token}
    
    Message types received:
    - {"type": "connected", "data": {...}}
    - {"type": "log", "data": {"agent": "...", "message": "...", "level": "..."}}
    - {"type": "agent_status", "data": {"agent_id": "...", "name": "...", "status": "..."}}
    - {"type": "canvas_update", "data": {...}}
    
    Message types to send:
    - {"type": "command", "data": {"action": "run_agents"}}
    - {"type": "ping"}
    """
    user_id = await get_user_id_from_token(token)
    
    await manager.connect(websocket, canvas_id, user_id)
    
    try:
        # Send initial status
        await manager.send_log(canvas_id, None, "Connected to canvas session", "info")
        
        while True:
            # Wait for messages from client
            data = await websocket.receive_json()
            
            msg_type = data.get("type", "")
            msg_data = data.get("data", {})
            
            if msg_type == "ping":
                await websocket.send_json({"type": "pong", "timestamp": WSMessage("pong", {}).timestamp})
            
            elif msg_type == "command":
                action = msg_data.get("action")
                
                if action == "run_agents":
                    # Send feedback immediately
                    await manager.send_log(canvas_id, "System", "Starting agent swarm...", "info")
                    # Start orchestrator
                    await orchestrator.start_agents(canvas_id, {"canvas_id": canvas_id})
                
                elif action == "stop_agents":
                    await manager.send_log(canvas_id, "System", "Stopping agents...", "warning")
                    await orchestrator.stop_agents(canvas_id)
                
                else:
                    await manager.send_log(canvas_id, "System", f"Unknown command: {action}", "error")
            
            elif msg_type == "chat":
                # User message to agents
                message = msg_data.get("message", "")
                if message:
                    await manager.send_log(canvas_id, "User", message, "info")
                    await orchestrator.handle_chat(canvas_id, message)
    
    except WebSocketDisconnect:
        manager.disconnect(websocket, canvas_id, user_id)
        await manager.send_log(canvas_id, None, "A user disconnected", "info")
    except Exception as e:
        manager.disconnect(websocket, canvas_id, user_id)
        print(f"WebSocket error: {e}")


@router.websocket("/ws/user/{user_id}")
async def websocket_user(
    websocket: WebSocket,
    user_id: str,
    token: str | None = Query(None),
):
    """
    WebSocket endpoint for user-level notifications
    """
    # Verify token matches user_id
    token_user_id = await get_user_id_from_token(token)
    if token_user_id != user_id:
        await websocket.close(code=4001)
        return
    
    await manager.connect(websocket, f"user:{user_id}", user_id)
    
    try:
        while True:
            data = await websocket.receive_json()
            # Handle user-level messages
            if data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    
    except WebSocketDisconnect:
        manager.disconnect(websocket, f"user:{user_id}", user_id)
