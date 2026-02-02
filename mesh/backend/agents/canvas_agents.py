"""
Canvas AI Agent - Intelligent canvas assistant with streaming reasoning chains.

This agent uses the Knowledge Graph for context-aware suggestions and
streams its reasoning process in real-time for visibility.
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime
from typing import Optional, AsyncIterator, Callable, Any
from dataclasses import dataclass, field

from .base import Agent, StreamingChunk


@dataclass 
class ReasoningStep:
    """A step in the reasoning chain."""
    step_number: int
    step_type: str  # 'thinking', 'retrieval', 'generation', 'verification'
    content: str
    kg_nodes_used: list[str] = field(default_factory=list)
    agent_name: str = ""
    started_at: datetime = field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    duration_ms: Optional[int] = None


@dataclass
class ReasoningTrace:
    """Complete trace of an agent's reasoning."""
    run_id: str
    steps: list[ReasoningStep] = field(default_factory=list)
    total_duration_ms: int = 0
    
    def add_step(self, step: ReasoningStep):
        self.steps.append(step)
        if step.duration_ms:
            self.total_duration_ms += step.duration_ms


class CanvasExplorerAgent(Agent):
    """
    Explorer agent specialized for canvas exploration.
    
    Uses Knowledge Graph to find relevant theorems, lemmas, and techniques
    for the user's problem, then generates exploration proposals.
    """
    
    agent_name = "explorer"
    
    def __init__(self, api_key: Optional[str] = None):
        system_prompt = """You are a mathematical exploration assistant helping users discover 
proof strategies and theorem connections.

Your role:
1. ANALYZE the mathematical problem or statement
2. RETRIEVE relevant theorems, definitions, and techniques from the knowledge base
3. PROPOSE multiple exploration paths with clear reasoning
4. Generate structured diagrams showing logical dependencies

When exploring, consider:
- What definitions are relevant?
- What known theorems might apply?
- What proof techniques could work? (induction, contradiction, construction, etc.)
- What are the key subproblems?

Format your exploration as:
1. **Understanding**: Brief restatement of the problem
2. **Key Concepts**: List relevant mathematical concepts
3. **Approach Options**: Multiple potential proof strategies
4. **Recommended Path**: Your suggested starting point

For diagram generation, output JSON with:
{
  "nodes": [{"id": "n1", "title": "...", "type": "CLAIM|THEOREM|LEMMA|DEFINITION", "content": "..."}],
  "edges": [{"from": "n1", "to": "n2", "type": "implies|uses|requires"}]
}"""

        super().__init__(
            model="gemini-3-pro-preview",
            system_prompt=system_prompt,
            temperature=0.8,
            max_tokens=16384,
            api_key=api_key,
            timeout=180
        )
    
    async def explore_with_reasoning(
        self,
        problem: str,
        context: Optional[dict] = None,
        kg_nodes: Optional[list] = None,
        on_step: Optional[Callable[[ReasoningStep], None]] = None,
        on_chunk: Optional[Callable[[StreamingChunk], None]] = None
    ) -> tuple[str, ReasoningTrace]:
        """
        Explore a problem with visible reasoning chain.
        
        Args:
            problem: The mathematical problem to explore
            context: Additional context (existing library items, etc.)
            kg_nodes: Relevant nodes from Knowledge Graph
            on_step: Callback for each reasoning step
            on_chunk: Callback for streaming chunks
            
        Returns:
            Tuple of (response text, reasoning trace)
        """
        trace = ReasoningTrace(run_id=str(uuid.uuid4()))
        start_time = datetime.utcnow()
        step_number = 0
        
        # Step 1: Understanding
        step_number += 1
        thinking_step = ReasoningStep(
            step_number=step_number,
            step_type="thinking",
            content="Analyzing the problem statement...",
            agent_name=self.agent_name
        )
        
        if on_step:
            on_step(thinking_step)
        
        # Step 2: KG Retrieval (if nodes provided)
        if kg_nodes:
            step_number += 1
            retrieval_step = ReasoningStep(
                step_number=step_number,
                step_type="retrieval",
                content=f"Found {len(kg_nodes)} relevant items from knowledge base",
                kg_nodes_used=[str(n.get("id", n.get("title", ""))) for n in kg_nodes],
                agent_name=self.agent_name
            )
            
            if on_step:
                on_step(retrieval_step)
            
            trace.add_step(retrieval_step)
        
        # Step 3: Generation with streaming
        step_number += 1
        generation_step = ReasoningStep(
            step_number=step_number,
            step_type="generation",
            content="",
            agent_name=self.agent_name
        )
        
        if on_step:
            on_step(generation_step)
        
        # Build enhanced prompt with KG context
        enhanced_context = context or {}
        if kg_nodes:
            kg_context = "\n".join([
                f"- [{n.get('type', 'ITEM')}] {n.get('title', '')}: {n.get('content', '')[:200]}..."
                for n in kg_nodes[:10]  # Limit to top 10
            ])
            enhanced_context["knowledge_base"] = kg_context
        
        # Stream the generation
        full_response = ""
        async for chunk in self.run_streaming(
            prompt=f"Explore this mathematical problem:\n\n{problem}",
            context=enhanced_context,
            step_type="generation",
            on_chunk=on_chunk
        ):
            if not chunk.is_complete:
                full_response += chunk.text
        
        # Complete generation step
        generation_step.content = full_response
        generation_step.completed_at = datetime.utcnow()
        generation_step.duration_ms = int(
            (generation_step.completed_at - generation_step.started_at).total_seconds() * 1000
        )
        trace.add_step(generation_step)
        
        # Complete trace
        trace.total_duration_ms = int(
            (datetime.utcnow() - start_time).total_seconds() * 1000
        )
        
        return full_response, trace


class CanvasFormalizerAgent(Agent):
    """
    Formalizer agent for converting natural language proofs to Lean 4.
    
    Uses Knowledge Graph to find relevant Mathlib lemmas and definitions.
    """
    
    agent_name = "formalizer"
    
    def __init__(self, api_key: Optional[str] = None):
        system_prompt = """You are a Lean 4 formalization expert. Convert natural language 
mathematical statements and proofs into valid Lean 4 code.

Guidelines:
1. Use Mathlib4 library when possible
2. Prefer tactic-style proofs over term-mode
3. Add clear comments explaining each step
4. Handle imports appropriately
5. Use sorry for unproven parts with TODO comments

Output format:
```lean4
import Mathlib.Tactic
-- other imports

/-- Documentation for the theorem -/
theorem my_theorem (h : hypothesis) : conclusion := by
  -- Proof steps
  sorry
```

When formalizing:
1. First identify the statement to formalize
2. Determine necessary types and definitions
3. Write the theorem statement
4. Outline proof strategy
5. Implement proof tactics"""

        super().__init__(
            model="gemini-3-pro-preview",
            system_prompt=system_prompt,
            temperature=0.3,  # Lower temperature for code generation
            max_tokens=8192,
            api_key=api_key,
            timeout=180
        )
    
    async def formalize_with_reasoning(
        self,
        statement: str,
        context: Optional[dict] = None,
        kg_nodes: Optional[list] = None,
        on_step: Optional[Callable[[ReasoningStep], None]] = None,
        on_chunk: Optional[Callable[[StreamingChunk], None]] = None
    ) -> tuple[str, ReasoningTrace]:
        """
        Formalize a statement with visible reasoning chain.
        """
        trace = ReasoningTrace(run_id=str(uuid.uuid4()))
        start_time = datetime.utcnow()
        step_number = 0
        
        # Step 1: Analysis
        step_number += 1
        analysis_step = ReasoningStep(
            step_number=step_number,
            step_type="thinking",
            content="Analyzing statement for formalization...",
            agent_name=self.agent_name
        )
        
        if on_step:
            on_step(analysis_step)
        trace.add_step(analysis_step)
        
        # Step 2: KG Retrieval
        if kg_nodes:
            step_number += 1
            retrieval_step = ReasoningStep(
                step_number=step_number,
                step_type="retrieval", 
                content=f"Retrieved {len(kg_nodes)} Mathlib lemmas and definitions",
                kg_nodes_used=[str(n.get("id", "")) for n in kg_nodes],
                agent_name=self.agent_name
            )
            
            if on_step:
                on_step(retrieval_step)
            trace.add_step(retrieval_step)
        
        # Step 3: Generation
        step_number += 1
        generation_step = ReasoningStep(
            step_number=step_number,
            step_type="generation",
            content="",
            agent_name=self.agent_name
        )
        
        if on_step:
            on_step(generation_step)
        
        # Build context with KG
        enhanced_context = context or {}
        if kg_nodes:
            lean_hints = "\n".join([
                f"- {n.get('lean_code', n.get('title', ''))}"
                for n in kg_nodes if n.get('lean_code')
            ])
            if lean_hints:
                enhanced_context["mathlib_hints"] = lean_hints
        
        # Stream generation
        full_response = ""
        async for chunk in self.run_streaming(
            prompt=f"Formalize this mathematical statement in Lean 4:\n\n{statement}",
            context=enhanced_context,
            step_type="generation",
            on_chunk=on_chunk
        ):
            if not chunk.is_complete:
                full_response += chunk.text
        
        generation_step.content = full_response
        generation_step.completed_at = datetime.utcnow()
        generation_step.duration_ms = int(
            (generation_step.completed_at - generation_step.started_at).total_seconds() * 1000
        )
        trace.add_step(generation_step)
        
        trace.total_duration_ms = int(
            (datetime.utcnow() - start_time).total_seconds() * 1000
        )
        
        return full_response, trace


class CanvasCriticAgent(Agent):
    """
    Critic agent for evaluating proofs and providing feedback.
    """
    
    agent_name = "critic"
    
    def __init__(self, api_key: Optional[str] = None):
        system_prompt = """You are a rigorous mathematical proof critic. Your job is to:

1. Evaluate the logical correctness of proofs
2. Identify gaps, errors, or unclear steps
3. Suggest improvements and alternative approaches
4. Rate confidence in the proof's correctness

When critiquing:
- Check each inference step carefully
- Verify all assumptions are stated
- Look for edge cases and boundary conditions
- Ensure definitions are used correctly

Output format:
**Overall Assessment**: [Valid/Needs Work/Invalid]
**Confidence**: [0-100]%

**Strengths**:
- ...

**Issues Found**:
1. [Location] - [Issue description]
2. ...

**Suggestions**:
- ...

**Verdict**: [Final assessment]"""

        super().__init__(
            model="gemini-3-pro-preview",
            system_prompt=system_prompt,
            temperature=0.4,
            max_tokens=8192,
            api_key=api_key,
            timeout=120
        )
    
    async def critique_with_reasoning(
        self,
        proof: str,
        context: Optional[dict] = None,
        on_step: Optional[Callable[[ReasoningStep], None]] = None,
        on_chunk: Optional[Callable[[StreamingChunk], None]] = None
    ) -> tuple[str, ReasoningTrace]:
        """
        Critique a proof with visible reasoning chain.
        """
        trace = ReasoningTrace(run_id=str(uuid.uuid4()))
        start_time = datetime.utcnow()
        
        # Step 1: Analysis
        analysis_step = ReasoningStep(
            step_number=1,
            step_type="verification",
            content="Analyzing proof structure and checking logical steps...",
            agent_name=self.agent_name
        )
        
        if on_step:
            on_step(analysis_step)
        trace.add_step(analysis_step)
        
        # Step 2: Critique
        critique_step = ReasoningStep(
            step_number=2,
            step_type="generation",
            content="",
            agent_name=self.agent_name
        )
        
        if on_step:
            on_step(critique_step)
        
        full_response = ""
        async for chunk in self.run_streaming(
            prompt=f"Critique this mathematical proof:\n\n{proof}",
            context=context,
            step_type="verification",
            on_chunk=on_chunk
        ):
            if not chunk.is_complete:
                full_response += chunk.text
        
        critique_step.content = full_response
        critique_step.completed_at = datetime.utcnow()
        critique_step.duration_ms = int(
            (critique_step.completed_at - critique_step.started_at).total_seconds() * 1000
        )
        trace.add_step(critique_step)
        
        trace.total_duration_ms = int(
            (datetime.utcnow() - start_time).total_seconds() * 1000
        )
        
        return full_response, trace


# Singleton instances
_explorer_agent: Optional[CanvasExplorerAgent] = None
_formalizer_agent: Optional[CanvasFormalizerAgent] = None  
_critic_agent: Optional[CanvasCriticAgent] = None


def get_canvas_explorer() -> CanvasExplorerAgent:
    global _explorer_agent
    if _explorer_agent is None:
        _explorer_agent = CanvasExplorerAgent()
    return _explorer_agent


def get_canvas_formalizer() -> CanvasFormalizerAgent:
    global _formalizer_agent
    if _formalizer_agent is None:
        _formalizer_agent = CanvasFormalizerAgent()
    return _formalizer_agent


def get_canvas_critic() -> CanvasCriticAgent:
    global _critic_agent
    if _critic_agent is None:
        _critic_agent = CanvasCriticAgent()
    return _critic_agent
