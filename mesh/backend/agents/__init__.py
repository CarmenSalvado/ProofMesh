"""Agents module - Uses Rho for reasoning."""

from .base import Agent, LoopAgent, StreamingChunk
from .explorer import ExplorerAgent, explorer_agent
from .formalizer import FormalizerAgent, formalizer_agent
from .critic import CriticAgent, critic_agent
from .latex_assistant import LatexAssistantAgent, latex_assistant_agent
from .canvas_agents import (
    CanvasExplorerAgent,
    CanvasFormalizerAgent,
    CanvasCriticAgent,
    ReasoningStep,
    ReasoningTrace,
    get_canvas_explorer,
    get_canvas_formalizer,
    get_canvas_critic,
)

__all__ = [
    "Agent",
    "LoopAgent",
    "StreamingChunk",
    "ExplorerAgent",
    "explorer_agent",
    "FormalizerAgent", 
    "formalizer_agent",
    "CriticAgent",
    "critic_agent",
    "LatexAssistantAgent",
    "latex_assistant_agent",
    # Canvas agents with streaming
    "CanvasExplorerAgent",
    "CanvasFormalizerAgent",
    "CanvasCriticAgent",
    "ReasoningStep",
    "ReasoningTrace",
    "get_canvas_explorer",
    "get_canvas_formalizer",
    "get_canvas_critic",
]
