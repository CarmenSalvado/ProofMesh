"""
ADK Runtime - Initializes and manages the agent runtime.
This is the bridge between the Orchestrator and the agents.
"""

from typing import Optional, Any, Dict
import os

from .agents import ExplorerAgent, FormalizerAgent, CriticAgent
from .models.types import (
    ExplorationResult,
    FormalizationResult,
    CriticResult
)


class Runtime:
    """
    Agent runtime that manages all agents.
    Agents are lazily initialized when first used.
    
    Usage:
        runtime = Runtime()
        result = await runtime.run("explore_loop", {"block": "..."})
    """
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "gemini-3-pro-preview"
    ):
        """
        Initialize the runtime configuration.
        Agents are NOT created here - they're lazily initialized.
        
        Args:
            api_key: Gemini API key (defaults to GEMINI_API_KEY env var)
            model: Model to use for all agents
        """
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        self.model = model
        
        # Lazy agent storage
        self._explorer: Optional[ExplorerAgent] = None
        self._formalizer: Optional[FormalizerAgent] = None
        self._critic: Optional[CriticAgent] = None
    
    @property
    def explorer(self) -> ExplorerAgent:
        """Lazy-load explorer agent."""
        if self._explorer is None:
            self._explorer = ExplorerAgent(model=self.model)
        return self._explorer
    
    @property
    def formalizer(self) -> FormalizerAgent:
        """Lazy-load formalizer agent."""
        if self._formalizer is None:
            self._formalizer = FormalizerAgent(model=self.model)
        return self._formalizer
    
    @property
    def critic(self) -> CriticAgent:
        """Lazy-load critic agent."""
        if self._critic is None:
            self._critic = CriticAgent(model=self.model)
        return self._critic
    
    @property
    def available_agents(self) -> list[str]:
        """List of available agent names."""
        return ["explore_loop", "explorer", "formalizer", "critic"]
    
    async def run(
        self, 
        agent_name: str, 
        params: Dict[str, Any]
    ) -> Any:
        """
        Run a named agent with parameters.
        
        Args:
            agent_name: Name of the agent to run
            params: Parameters to pass to the agent
            
        Returns:
            Agent-specific result type
            
        Raises:
            ValueError: If agent_name is not registered
        """
        if agent_name not in self.available_agents:
            raise ValueError(f"Unknown agent: {agent_name}. Available: {self.available_agents}")
        
        # Route to appropriate method based on agent type
        if agent_name in ("explore_loop", "explorer"):
            return await self._run_explorer(params)
        elif agent_name == "formalizer":
            return await self._run_formalizer(params)
        elif agent_name == "critic":
            return await self._run_critic(params)
        else:
            raise ValueError(f"No handler for agent: {agent_name}")
    
    async def _run_explorer(self, params: Dict[str, Any]) -> ExplorationResult:
        """Run explorer agent."""
        block = params.get("block", "")
        memory = params.get("memory", [])
        return await self.explorer.explore(block, memory)
    
    async def _run_formalizer(self, params: Dict[str, Any]) -> FormalizationResult:
        """Run formalizer agent."""
        text = params.get("text", "")
        hints = params.get("hints", [])
        return await self.formalizer.formalize(text, hints)
    
    async def _run_critic(self, params: Dict[str, Any]) -> CriticResult:
        """Run critic agent."""
        proposal = params.get("proposal", "")
        context = params.get("context")
        goal = params.get("goal")
        return await self.critic.critique(proposal, context, goal)
    
    def run_sync(
        self,
        agent_name: str,
        params: Dict[str, Any]
    ) -> Any:
        """Synchronous version of run()."""
        import asyncio
        return asyncio.run(self.run(agent_name, params))


# Default runtime instance (lazy initialization)
_default_runtime: Optional[Runtime] = None


def get_runtime() -> Runtime:
    """Get or create the default runtime."""
    global _default_runtime
    if _default_runtime is None:
        _default_runtime = Runtime()
    return _default_runtime


if __name__ == "__main__":
    import sys
    
    if "--test" in sys.argv:
        print("Testing ADK Runtime...")
        print("Note: Requires GEMINI_API_KEY environment variable")
        
        runtime = Runtime()
        print(f"Available agents: {runtime.available_agents}")
        
        # Quick sync test
        try:
            result = runtime.run_sync("formalizer", {
                "text": "1 + 1 = 2"
            })
            print(f"Formalizer result confidence: {result.confidence}")
        except Exception as e:
            print(f"Test failed (this is expected without API key): {e}")
