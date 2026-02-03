"""
Orchestrator - The main state machine that controls the entire flow.
This is NOT an agent. This is Python control logic.
"""

from typing import Optional, List, Any, Dict
from dataclasses import dataclass, field
import asyncio
import uuid
import os

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

# Hard threshold - don't proceed with garbage
MIN_CONFIDENCE_THRESHOLD = 0.3


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
        # Find path relative to this file (backend/orchestrator.py) -> ../mesh_project
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        project_path = os.path.join(base_dir, "mesh_project")
        
        # Also check CWD fallback
        if not os.path.exists(project_path):
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
            "memory": memory,
            "max_iterations": max_iterations
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

    async def latex_assist(
        self,
        prompt: str,
        context: Optional[Dict[str, Any]] = None
    ):
        """
        Assist with LaTeX editing and autocomplete.
        Uses the latex assistant agent via ADK.
        """
        return await self.adk.run("latex_assistant", {
            "prompt": prompt,
            "context": context or {}
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
        loop = asyncio.get_running_loop()
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
        
        # Filter out blocked/invalid proposals BEFORE critiquing
        valid_proposals = [p for p in exploration.proposals if p.is_valid()]
        if not valid_proposals:
            return []
        
        results = []
        for proposal in valid_proposals:
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
        
        # Hard rule: Don't verify garbage
        if formalization.confidence < MIN_CONFIDENCE_THRESHOLD:
            return None
        if not formalization.lean_code.strip():
            return None
        
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

    # ========== Idea2Paper Integration (Story Generation) ==========

    async def generate_story(
        self,
        user_idea: str,
        pattern_id: Optional[str] = None,
        db_session = None,
        previous_story: Optional[Dict] = None,
        review_feedback: Optional[Dict] = None,
        use_fusion: bool = True
    ) -> Dict:
        """
        Generate a structured paper story from user idea and pattern.
        Integrates Idea2Paper logic with Gemini 3.

        Args:
            user_idea: User's research idea
            pattern_id: Optional pattern ID to use
            db_session: Database session for pattern recall
            previous_story: Previous version for refinement
            review_feedback: Feedback for refinement
            use_fusion: Whether to use idea fusion

        Returns:
            Generated story dict with all sections
        """
        from .agents.story_generator import StoryGeneratorAgent
        from .agents.idea_fusion import IdeaFusionAgent
        from .tools.pattern_store import PatternStore

        # Step 1: Recall or select pattern
        pattern_info = {}
        if not pattern_id and db_session:
            pattern_store = PatternStore()
            patterns = await pattern_store.recall_patterns(
                session=db_session,
                query=user_idea,
                top_k=5
            )
            if patterns:
                # Use top stability pattern
                pattern_id = patterns[0]['pattern_id']

        # Step 2: Get pattern info
        if pattern_id and db_session:
            pattern_store = PatternStore()
            pattern_info = await pattern_store.get_pattern_by_id(db_session, pattern_id)
            if pattern_info:
                pattern_info['pattern_id'] = pattern_id

        # Step 3: Optional idea fusion
        fused_idea = None
        if use_fusion and pattern_id and pattern_info:
            fusion_agent = IdeaFusionAgent()
            fused_idea = await fusion_agent.fuse(
                user_idea=user_idea,
                pattern_id=pattern_id,
                pattern_info=pattern_info
            )

        # Step 4: Generate story
        story_agent = StoryGeneratorAgent()
        story = await story_agent.generate(
            user_idea=user_idea,
            pattern_info=pattern_info or {},
            previous_story=previous_story,
            review_feedback=review_feedback,
            fused_idea=fused_idea
        )

        # Step 5: Add metadata
        story['generation_metadata'] = {
            'user_idea': user_idea,
            'pattern_id': pattern_id,
            'pattern_name': pattern_info.get('name', '') if pattern_info else '',
            'used_fusion': fused_idea is not None,
            'fused_idea_title': fused_idea.get('fused_idea_title', '') if fused_idea else ''
        }

        return story

    async def review_with_anchors(
        self,
        story: Dict,
        pattern_id: Optional[str] = None,
        db_session = None
    ) -> Dict:
        """
        Review story using enhanced anchored multi-agent critic.
        Integrates Idea2Paper's anchored review system with Gemini 3.

        Args:
            story: Story dict to review
            pattern_id: Pattern ID for anchor selection
            db_session: Database session

        Returns:
            Review result with calibrated scores
        """
        from .agents.enhanced_critic import EnhancedCriticAgent
        from .tools.paper_anchors import get_paper_anchor_service

        # Step 1: Select anchors
        anchors = []
        if pattern_id and db_session:
            anchor_service = get_paper_anchor_service()
            # Get pattern-specific anchors
            anchors = await anchor_service.select_quantile_anchors(
                session=db_session,
                pattern_id=pattern_id,
                quantiles=[0.1, 0.25, 0.5, 0.75, 0.9]
            )

            # Add exemplars
            anchors = await anchor_service.add_exemplar_anchors(
                session=db_session,
                pattern_id=pattern_id,
                current_anchors=anchors,
                max_exemplars=2
            )

        # Step 2: Run enhanced review
        critic_agent = EnhancedCriticAgent()
        review_result = await critic_agent.review(
            story=story,
            anchors=anchors,
            pattern_id=pattern_id
        )

        return review_result

    async def check_novelty(
        self,
        story: Dict,
        db_session,
        exclude_story_id: Optional[str] = None
    ) -> Dict:
        """
        Check novelty of story against existing work.
        Uses embedding-based similarity detection.

        Args:
            story: Story dict
            db_session: Database session
            exclude_story_id: ID to exclude (for revisions)

        Returns:
            Novelty report with risk level
        """
        from .tools.novelty_checker import get_novelty_checker

        novelty_checker = get_novelty_checker()
        return await novelty_checker.check_novelty(
            session=db_session,
            story=story,
            exclude_story_id=exclude_story_id
        )


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
