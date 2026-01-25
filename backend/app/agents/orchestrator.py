from typing import Dict, List, Optional
import asyncio
from .base import BaseAgent
from .solver import SymbolicSolver
from app.services.websocket import manager as ws_manager

class AgentOrchestrator:
    def __init__(self):
        # canvas_id -> List[BaseAgent]
        self.active_agents: Dict[str, List[BaseAgent]] = {}

    async def start_agents(self, canvas_id: str, context: Dict):
        """Initialize and start agents for a canvas"""
        if canvas_id in self.active_agents:
            await self.stop_agents(canvas_id)
        
        # Instantiate agents
        solver = SymbolicSolver(f"solver-{canvas_id}", ws_manager)
        # TODO: Add Verifier and Graph Theoriest later
        
        self.active_agents[canvas_id] = [solver]
        
        # Start them as async tasks
        for agent in self.active_agents[canvas_id]:
            asyncio.create_task(agent.run(context))
            
    async def stop_agents(self, canvas_id: str):
        """Stop all agents for a canvas"""
        if canvas_id not in self.active_agents:
            return
            
        for agent in self.active_agents[canvas_id]:
            agent.stop()
            
        self.active_agents[canvas_id] = []
        await ws_manager.send_log(canvas_id, "System", "Agents stopped.", "warning")

    async def handle_chat(self, canvas_id: str, message: str):
        """Pass user message to active agents"""
        # If no agents active, maybe start them or just log
        if canvas_id not in self.active_agents or not self.active_agents[canvas_id]:
            await ws_manager.send_log(canvas_id, "System", "Agents are not running. Start them first.", "error")
            return

        # Notify agents (in a real system, we might route to specific agent)
        # For now, just re-trigger execute with new messageContext
        for agent in self.active_agents[canvas_id]:
             asyncio.create_task(agent.run({"canvas_id": canvas_id, "message": message}))

# Global instance
orchestrator = AgentOrchestrator()
