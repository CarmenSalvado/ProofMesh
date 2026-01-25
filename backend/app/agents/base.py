from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
import asyncio

class BaseAgent(ABC):
    def __init__(self, agent_id: str, name: str, manager):
        self.agent_id = agent_id
        self.name = name
        self.manager = manager
        self.status = "idle"  # idle, working, thinking, error
        self.task: Optional[str] = None
        self._stop_event = asyncio.Event()

    async def run(self, context: Dict[str, Any]):
        """Main execution method to be implemented by subclasses"""
        self.status = "working"
        self._stop_event.clear()
        try:
            await self._execute(context)
        except asyncio.CancelledError:
            self.status = "idle"
            await self.manager.send_log(context.get("canvas_id"), self.name, "Operation cancelled", "warning")
        except Exception as e:
            self.status = "error"
            await self.manager.send_log(context.get("canvas_id"), self.name, f"Error: {str(e)}", "error")
        finally:
            if self.status != "error":
                self.status = "idle"
                self.task = None
            await self.manager.send_agent_status(
                context.get("canvas_id"), self.agent_id, self.name, self.status, None
            )

    @abstractmethod
    async def _execute(self, context: Dict[str, Any]):
        """Specific logic for the agent"""
        pass

    def stop(self):
        """Signal the agent to stop"""
        self._stop_event.set()
