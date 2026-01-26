"""
Explorer Agent - Proposes mathematical lemmas and conjectures.
Uses LoopAgent to iterate until a good proposal is found.
"""

import json
import re
from typing import Optional, List

from .base import Agent, LoopAgent, score_threshold
from ..models.types import Proposal, ExplorationResult, AgentResponse


EXPLORER_SYSTEM_PROMPT = """You are a mathematical exploration agent. Your role is to propose lemmas, conjectures, and next steps for mathematical proofs.

When given a mathematical block or statement, you should:
1. Analyze the current state of the proof
2. Identify what needs to be proven next
3. Propose a specific lemma or step that would advance the proof
4. Explain your reasoning

Format your response as JSON:
{
    "proposal": "The specific mathematical statement you propose",
    "reasoning": "Why this is a good next step",
    "confidence": 0.0-1.0,
    "prerequisites": ["Any lemmas this depends on"],
    "score": 0.0-1.0
}

Be creative but rigorous. Propose steps that are both novel and provable."""


class ExplorerAgent:
    """
    Explorer agent that proposes mathematical lemmas.
    Wraps a LoopAgent to iterate until a high-quality proposal is found.
    """
    
    def __init__(
        self,
        model: str = "gemini-3-pro-preview",
        temperature: float = 0.8,  # Higher for creativity
        max_iterations: int = 5,
        score_threshold: float = 0.7
    ):
        self.base_agent = Agent(
            model=model,
            system_prompt=EXPLORER_SYSTEM_PROMPT,
            temperature=temperature
        )
        
        self.score_threshold_value = score_threshold
        self.max_iterations = max_iterations
        
        # Create loop agent with stop condition
        def stop_condition(response: AgentResponse, iteration: int) -> bool:
            try:
                content = response.content
                # Extract JSON from markdown if present
                json_pattern = r'```(?:json)?\s*\n(.*?)```'
                json_matches = re.findall(json_pattern, content, re.DOTALL)
                if json_matches:
                    content = json_matches[0].strip()
                
                data = json.loads(content)
                return data.get("score", 0) >= self.score_threshold_value
            except:
                return False
        
        self.loop_agent = LoopAgent(
            agent=self.base_agent,
            until=stop_condition,
            max_iters=max_iterations
        )
    
    async def explore(
        self,
        block: str,
        memory: Optional[List[dict]] = None
    ) -> ExplorationResult:
        """
        Explore and propose lemmas for a mathematical block.
        
        Args:
            block: The mathematical content to explore
            memory: Previous relevant facts/context
            
        Returns:
            ExplorationResult with proposals
        """
        context = {"block": block}
        if memory:
            context["previous_facts"] = json.dumps(memory, indent=2)
        
        prompt = f"""Analyze this mathematical block and propose the next lemma to prove:

{block}

Remember to format your response as valid JSON."""

        def refine(prompt: str, response: AgentResponse, iteration: int) -> str:
            return f"""{prompt}

Previous proposal (iteration {iteration + 1}):
{response.content}

This proposal scored below the threshold. Please propose something better:
- More specific and provable
- Better reasoned
- Higher confidence

Improve your proposal."""

        responses = await self.loop_agent.run(
            prompt, 
            context=context,
            refine_prompt=refine
        )
        
        # Parse all proposals
        proposals = []
        best_score = 0.0
        
        for i, response in enumerate(responses):
            try:
                # Check if response was successful
                if not response.success:
                    proposals.append(Proposal(
                        id=f"prop-{i}",
                        content=f"Error: {response.content}",
                        reasoning="(Agent returned error)",
                        score=0.0,
                        iteration=i
                    ))
                    continue
                
                # Extract JSON from markdown if present
                content = response.content
                json_pattern = r'```(?:json)?\s*\n(.*?)```'
                json_matches = re.findall(json_pattern, content, re.DOTALL)
                if json_matches:
                    content = json_matches[0].strip()
                
                data = json.loads(content)
                proposal = Proposal(
                    id=f"prop-{i}",
                    content=data.get("proposal", response.content),
                    reasoning=data.get("reasoning", ""),
                    score=data.get("score", 0.0),
                    iteration=i
                )
                proposals.append(proposal)
                best_score = max(best_score, proposal.score)
            except Exception as e:
                # Handle any error
                proposals.append(Proposal(
                    id=f"prop-{i}",
                    content=f"Parse error: {str(e)}\n\nRaw response:\n{response.content[:500] if response.content else 'None'}",
                    reasoning="(Could not parse structured response)",
                    score=0.0,
                    iteration=i
                ))
        
        # Determine why we stopped
        stopped_reason = "max_iterations"
        if len(responses) < self.max_iterations:
            stopped_reason = "score_threshold"
        
        return ExplorationResult(
            proposals=proposals,
            total_iterations=len(responses),
            best_score=best_score,
            stopped_reason=stopped_reason
        )
    
    def explore_sync(
        self,
        block: str,
        memory: Optional[List[dict]] = None
    ) -> ExplorationResult:
        """Synchronous version of explore()."""
        import asyncio
        return asyncio.run(self.explore(block, memory))


# Lazy default agent instance
_explorer_agent: ExplorerAgent | None = None

def get_explorer_agent() -> ExplorerAgent:
    """Get or create the default explorer agent."""
    global _explorer_agent
    if _explorer_agent is None:
        _explorer_agent = ExplorerAgent()
    return _explorer_agent

# Backward compatibility (will error without API key)
explorer_agent = None  # Use get_explorer_agent() instead


if __name__ == "__main__":
    import sys
    import asyncio
    
    if "--test" in sys.argv:
        async def test():
            print("Testing Explorer Agent...")
            print("Note: Requires GEMINI_API_KEY environment variable")
            
            agent = ExplorerAgent(max_iterations=2)
            result = await agent.explore(
                "Prove that the sum of two even numbers is even."
            )
            
            print(f"Total iterations: {result.total_iterations}")
            print(f"Best score: {result.best_score}")
            print(f"Stopped reason: {result.stopped_reason}")
            print(f"\nProposals:")
            for p in result.proposals:
                print(f"  [{p.iteration}] Score: {p.score}")
                print(f"      {p.content[:100]}...")
        
        asyncio.run(test())
