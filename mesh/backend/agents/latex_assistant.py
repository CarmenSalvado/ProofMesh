"""
Latex assistant agent for editor chat and autocomplete.
"""

from __future__ import annotations

from .base import Agent


DEFAULT_SYSTEM_PROMPT = """
You are an expert LaTeX assistant for scientific papers.
- Respond in English.
- Be concise and practical.
- When asked to autocomplete or generate LaTeX, return insert-ready content.
- If asked for JSON, return valid JSON with no extra text.
""".strip()


class LatexAssistantAgent(Agent):
    def __init__(
        self,
        model: str = "gemini-3-flash-preview",
        temperature: float = 0.35,
        max_tokens: int = 2048,
        **kwargs,
    ):
        super().__init__(
            model=model,
            system_prompt=DEFAULT_SYSTEM_PROMPT,
            temperature=temperature,
            max_tokens=max_tokens,
            **kwargs,
        )


def latex_assistant_agent() -> LatexAssistantAgent:
    return LatexAssistantAgent()
