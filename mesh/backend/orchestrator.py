"""
Orchestrator - The main state machine that controls the entire flow.
This is NOT an agent. This is Python control logic.
"""

from typing import Optional, List, Any, Dict
from dataclasses import dataclass, field
import asyncio

from .adk_runtime import Runtime
from .tools.lean_runner import LeanRunner, run_lean
from .tools.fact_store import FactStore
from .models.types import (
    Proposal,
    Fact,
    LeanResult,
    VerifiedResult,
    ExplorationResult,
    FormalizationResult,
    CriticResult
)


@dataclass
class Canvas:
    """
    Simple canvas abstraction for blocks of mathematical content.
    In a real app, this would connect to the UI.
    """
    blocks: Dict[str, str] = field(default_factory=dict)
    
    def get(self, block_id: str) -> str:
        """Get a block by ID."""
        return self.blocks.get(block_id, "")
    
    def set(self, block_id: str, content: str):
        """Set a block's content."""
        self.blocks[block_id] = content
    
    def create(self, content: str) -> str:
        """Create a new block and return its ID."""
        import uuid
        block_id = str(uuid.uuid4())[:8]
        self.blocks[block_id] = content
        return block_id


class Orchestrator:
    """
    Main orchestrator - controls the flow between agents and tools.
    
    This is the central state machine that:
    - Calls ADK for exploration, formalization, critique
    - Calls Lean runner for verification
    - Manages persistence via FactStore
    
    Usage:
        orchestrator = Orchestrator()
        
        # Explore a block
        proposals = await orchestrator.explore(block_id)
        
        # Formalize chosen proposal
        lean_code = await orchestrator.formalize(chosen_text)
        
        # Verify with Lean
        result = await orchestrator.verify(lean_code)
        
        # Persist if successful
        if result.success:
            orchestrator.persist(result, block_id, statement)
    """
    
    def __init__(
        self,
        runtime: Optional[Runtime] = None,
        canvas: Optional[Canvas] = None,
        fact_store: Optional[FactStore] = None,
        lean_runner: Optional[LeanRunner] = None
    ):
        self.adk = runtime or Runtime()
        self.canvas = canvas or Canvas()
        self.facts = fact_store or FactStore()
        
        # Configure LeanRunner to use mesh_project if available
        import os
        project_path = os.path.join(os.getcwd(), "mesh_project")
        if lean_runner:
            self.lean = lean_runner
        elif os.path.exists(project_path):
            self.lean = LeanRunner(workspace_dir=project_path, use_project_context=True)
        else:
            self.lean = LeanRunner()
    
    # ========== ADK Calls (Agent Layer) ==========
    
    async def explore(
        self, 
        block_id: str,
        max_iterations: int = 5
    ) -> ExplorationResult:
        """
        Explore and propose lemmas for a block.
        Uses the explorer agent via ADK.
        
        Args:
            block_id: ID of the block to explore
            max_iterations: Max exploration iterations
            
        Returns:
            ExplorationResult with proposals
        """
        block_content = self.canvas.get(block_id)
        memory = [
            {"statement": f.statement, "lean_code": f.lean_code}
            for f in self.facts.relevant(block_id)
        ]
        
        result = await self.adk.run("explore_loop", {
            "block": block_content,
            "memory": memory
        })
        
        return result
    
    async def formalize(
        self, 
        text: str,
        hints: Optional[List[str]] = None
    ) -> FormalizationResult:
        """
        Formalize mathematical text to Lean 4.
        Uses the formalizer agent via ADK.
        
        Args:
            text: The mathematical text to formalize
            hints: Optional Lean code hints
            
        Returns:
            FormalizationResult with Lean code
        """
        return await self.adk.run("formalizer", {
            "text": text,
            "hints": hints or []
        })
    
    async def critique(
        self,
        proposal: str,
        context: Optional[str] = None,
        goal: Optional[str] = None
    ) -> CriticResult:
        """
        Get critique of a proposal.
        Uses the critic agent via ADK.
        
        Args:
            proposal: The proposal to critique
            context: Optional context
            goal: The overall goal
            
        Returns:
            CriticResult with feedback
        """
        return await self.adk.run("critic", {
            "proposal": proposal,
            "context": context,
            "goal": goal
        })
    
    # ========== Tool Calls (Infrastructure Layer) ==========
    
    async def verify(self, lean_code: str) -> LeanResult:
        """
        Verify Lean code.
        Uses the Lean runner (NOT an agent).
        
        Args:
            lean_code: Lean 4 code to verify
            
        Returns:
            LeanResult with success status
        """
        # Run in thread pool to not block
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, 
            self.lean.run, 
            lean_code
        )
    
    def persist(
        self,
        lean_result: LeanResult,
        block_id: str,
        statement: str
    ) -> Fact:
        """
        Persist a verified result.
        Uses the FactStore (NOT an agent).
        
        Args:
            lean_result: The verification result
            block_id: The block this fact belongs to
            statement: The mathematical statement
            
        Returns:
            The saved Fact
        """
        import uuid
        
        fact = Fact(
            id=str(uuid.uuid4()),
            block_id=block_id,
            statement=statement,
            lean_code=lean_result.code,
            proof_status="verified" if lean_result.success else "failed"
        )
        
        verified_result = VerifiedResult(
            fact=fact,
            lean_result=lean_result
        )
        
        return self.facts.save(verified_result)
    
    # ========== High-Level Workflows ==========
    
    async def explore_and_critique(
        self,
        block_id: str
    ) -> List[tuple[Proposal, CriticResult]]:
        """
        Explore and automatically critique all proposals.
        
        Returns:
            List of (proposal, critique) tuples, sorted by score
        """
        exploration = await self.explore(block_id)
        
        results = []
        for proposal in exploration.proposals:
            critique = await self.critique(proposal.content)
            results.append((proposal, critique))
        
        # Sort by critique score
        results.sort(key=lambda x: x[1].score, reverse=True)
        return results
    
    async def full_pipeline(
        self,
        block_id: str,
        auto_select: bool = True
    ) -> Optional[Fact]:
        """
        Run the full pipeline: explore → critique → formalize → verify → persist
        
        Args:
            block_id: Block to process
            auto_select: If True, automatically pick best proposal
            
        Returns:
            The verified Fact, or None if verification failed
        """
        # 1. Explore and critique
        ranked = await self.explore_and_critique(block_id)
        
        if not ranked:
            return None
        
        # 2. Select best proposal
        if auto_select:
            best_proposal, best_critique = ranked[0]
            if best_critique.score < 0.5:
                # Score too low, don't proceed
                return None
        else:
            # In real app, this would involve user selection
            best_proposal, _ = ranked[0]
        
        # 3. Formalize
        formalization = await self.formalize(best_proposal.content)
        
        # 4. Verify
        verification = await self.verify(formalization.lean_code)
        
        # 5. Persist if successful
        if verification.success:
            return self.persist(
                verification,
                block_id,
                best_proposal.content
            )
        
        return None


# Convenience function for quick pipelines
async def quick_formalize_and_verify(
    text: str,
    orchestrator: Optional[Orchestrator] = None
) -> tuple[FormalizationResult, LeanResult]:
    """
    Quick helper to formalize and verify a statement.
    
    Args:
        text: Mathematical text to formalize
        orchestrator: Optional orchestrator instance
        
    Returns:
        Tuple of (formalization, verification)
    """
    orch = orchestrator or Orchestrator()
    formalization = await orch.formalize(text)
    verification = await orch.verify(formalization.lean_code)
    return formalization, verification


if __name__ == "__main__":
    import sys
    
    if "--test" in sys.argv:
        async def test():
            print("Testing Orchestrator...")
            print("Note: Requires GEMINI_API_KEY environment variable")
            
            orch = Orchestrator()
            
            # Create a test block
            block_id = orch.canvas.create(
                "Prove that the sum of two even numbers is even."
            )
            print(f"Created block: {block_id}")
            
            # Try exploration
            try:
                result = await orch.explore(block_id)
                print(f"Exploration complete: {len(result.proposals)} proposals")
                for p in result.proposals:
                    print(f"  - {p.content[:60]}... (score: {p.score})")
            except Exception as e:
                print(f"Exploration failed (expected without API key): {e}")
        
        asyncio.run(test())
