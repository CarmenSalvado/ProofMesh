"""Agents module - Uses Gemini 3 for reasoning."""

from .base import Agent, LoopAgent
from .explorer import ExplorerAgent, explorer_agent
from .formalizer import FormalizerAgent, formalizer_agent
from .critic import CriticAgent, critic_agent
from .latex_assistant import LatexAssistantAgent, latex_assistant_agent

__all__ = [
    "Agent",
    "LoopAgent", 
    "ExplorerAgent",
    "explorer_agent",
    "FormalizerAgent", 
    "formalizer_agent",
    "CriticAgent",
    "critic_agent",
    "LatexAssistantAgent",
    "latex_assistant_agent",
]
