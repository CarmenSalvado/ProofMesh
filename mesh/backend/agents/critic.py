"""
Critic Agent - Evaluates proposals and provides feedback.
"""

import json
import re
from typing import Optional, List

from .base import Agent
from ..models.types import CriticResult, AgentResponse, Proposal


CRITIC_SYSTEM_PROMPT = """You are a mathematical critic agent. Your role is to evaluate mathematical proposals, lemmas, and proofs for quality, correctness, and style.

When evaluating a proposal, consider:
1. Mathematical correctness - Is the statement true?
2. Provability - Can this be proven with standard techniques?
3. Usefulness - Does this advance the proof goal?
4. Style - Is it well-formulated?
5. Minimality - Is it as simple as possible?

Format your response as JSON:
{
    "score": 0.0-1.0,
    "feedback": "Detailed feedback on the proposal",
    "issues": ["List of specific problems"],
    "suggestions": ["Improvements to consider"],
    "should_retry": true/false
}

Be constructive but rigorous. High scores (>0.7) should be reserved for excellent proposals."""


class CriticAgent:
    """
    Critic agent that evaluates mathematical proposals.
    """
    
    def __init__(
        self,
        model: str = "gemini-3-pro-preview",
        temperature: float = 0.4,
    ):
        self.agent = Agent(
            model=model,
            system_prompt=CRITIC_SYSTEM_PROMPT,
            temperature=temperature
        )
    
    async def critique(
        self,
        proposal: str,
        context: Optional[str] = None,
        goal: Optional[str] = None
    ) -> CriticResult:
        """
        Evaluate a mathematical proposal.
        
        Args:
            proposal: The proposal to evaluate
            context: Optional surrounding context
            goal: The overall proof goal
            
        Returns:
            CriticResult with score and feedback
        """
        prompt = f"""Evaluate this mathematical proposal:

{proposal}
"""
        
        ctx = {}
        if context:
            ctx["context"] = context
        if goal:
            ctx["goal"] = goal
        
        response = await self.agent.run(prompt, ctx if ctx else None)
        return self._parse_response(response)
    
    def critique_sync(
        self,
        proposal: str,
        context: Optional[str] = None,
        goal: Optional[str] = None
    ) -> CriticResult:
        """Synchronous version of critique()."""
        prompt = f"""Evaluate this mathematical proposal:

{proposal}
"""
        
        ctx = {}
        if context:
            ctx["context"] = context
        if goal:
            ctx["goal"] = goal
        
        response = self.agent.run_sync(prompt, ctx if ctx else None)
        return self._parse_response(response)
    
    async def rank_proposals(
        self,
        proposals: List[Proposal],
        goal: Optional[str] = None
    ) -> List[tuple[Proposal, CriticResult]]:
        """
        Rank multiple proposals by quality.
        
        Args:
            proposals: List of proposals to rank
            goal: The overall proof goal
            
        Returns:
            List of (proposal, critique) tuples, sorted by score descending
        """
        results = []
        for proposal in proposals:
            critique = await self.critique(proposal.content, goal=goal)
            results.append((proposal, critique))
        
        # Sort by score descending
        results.sort(key=lambda x: x[1].score, reverse=True)
        return results
    
    def _parse_response(self, response: AgentResponse) -> CriticResult:
        """Parse the agent response into a CriticResult."""
        if not response.success:
            return CriticResult(
                score=0.0,
                feedback=f"Error: {response.content}",
                should_retry=True
            )
        
        content = response.content
        
        # Extract JSON from markdown code blocks if present
        json_pattern = r'```(?:json)?\s*\n(.*?)```'
        json_matches = re.findall(json_pattern, content, re.DOTALL)
        if json_matches:
            content = json_matches[0].strip()
        
        try:
            data = json.loads(content)
            return CriticResult(
                score=data.get("score", 0.5),
                feedback=data.get("feedback", response.content),
                suggestions=data.get("suggestions", []),
                issues=data.get("issues", []),
                should_retry=data.get("should_retry", False)
            )
        except json.JSONDecodeError:
            # Extract what we can from free text
            return CriticResult(
                score=0.5,
                feedback=response.content,
                should_retry=True
            )


# Lazy default agent instance
_critic_agent: CriticAgent | None = None

def get_critic_agent() -> CriticAgent:
    """Get or create the default critic agent."""
    global _critic_agent
    if _critic_agent is None:
        _critic_agent = CriticAgent()
    return _critic_agent

# Backward compatibility
critic_agent = None  # Use get_critic_agent() instead


if __name__ == "__main__":
    import sys
    import asyncio
    
    if "--test" in sys.argv:
        async def test():
            print("Testing Critic Agent...")
            print("Note: Requires GEMINI_API_KEY environment variable")
            
            agent = CriticAgent()
            result = await agent.critique(
                "Lemma: If n is even and m is even, then n + m is even.",
                goal="Prove properties of even numbers"
            )
            
            print(f"Score: {result.score}")
            print(f"Feedback: {result.feedback}")
            print(f"Issues: {result.issues}")
            print(f"Suggestions: {result.suggestions}")
            print(f"Should retry: {result.should_retry}")
        
        asyncio.run(test())
