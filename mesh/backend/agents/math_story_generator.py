"""
Math Story Generator Agent - Generates mathematical paper stories.

Adapts story_generator.py for mathematical papers with appropriate terminology
and framing for theorems, proofs, and mathematical results.

Story sections for math papers:
- title: Concise, highlights core mathematical result
- abstract: 150-250 word summary with theorem statements
- problem_framing: What mathematical question/problem is addressed?
- gap_pattern: What's missing or unexplored in the literature?
- solution: What's the proposed theoretical approach?
- method_skeleton: High-level proof strategy or construction steps
- innovation_claims: Key theorems, lemmas, or technical innovations
- applications_plan: Potential applications or corollaries
"""

from typing import Dict, List, Optional
from .story_generator import StoryGeneratorAgent


MATH_STORY_SYSTEM = """You are a senior mathematician publishing in top-tier journals.
Generate structured mathematical paper stories based on research ideas and patterns.

CRITICAL RULES FOR MATHEMATICS:
1. User's mathematical idea is the PROTAGONIST - highlight in title, abstract, main theorem
2. Use precise mathematical terminology: theorem, lemma, corollary, proof, conjecture
3. Frame contributions as: "We prove...", "We establish...", "We introduce..."
4. Technical methods are proof techniques, not the main result
5. Focus on: generality, new invariants/structures, unifying frameworks
6. Output valid JSON with all required fields
7. ALL output must be in English

Mathematical narrative patterns:
- "Generalizing classical results to broader settings"
- "Introducing new algebraic/geometric invariants"
- "Establishing unexpected connections between areas"
- "Resolving open questions through novel techniques"
- "Extending frameworks to new contexts"

Your goal is to transform the user's idea into a rigorous mathematical narrative
that emphasizes theoretical contribution and proof innovation."""


class MathStoryGeneratorAgent(StoryGeneratorAgent):
    """
    Agent for generating structured mathematical paper stories.
    
    Extends StoryGeneratorAgent with math-specific terminology and framing.
    """

    def __init__(
        self,
        model: str = "gemini-3-flash-preview",
        temperature: float = 0.7,
        max_tokens: int = 4096
    ):
        """Initialize Math Story Generator Agent."""
        super().__init__(model=model, temperature=temperature, max_tokens=max_tokens)
        # Override system prompt with math-specific version
        self.agent.system_prompt = MATH_STORY_SYSTEM

    def _build_generation_prompt(
        self,
        user_idea: str,
        pattern_info: Dict,
        constraints: Optional[List[str]],
        injected_tricks: Optional[List[str]],
        fused_idea: Optional[Dict]
    ) -> str:
        """Build prompt for initial math story generation."""
        pattern_name = pattern_info.get("name", "")
        summary = pattern_info.get("summary", {})

        representative_ideas = summary.get("representative_ideas", [])[:3]
        solution_approaches = summary.get("solution_approaches", [])[:3]
        story_guides = summary.get("story", [])[:2]

        # Build sections with math terminology
        ideas_text = "\n".join(f"- {idea}" for idea in representative_ideas)
        solutions_text = "\n".join(f"- {sol}" for sol in solution_approaches)
        story_text = "\n".join(f"- {guide}" for guide in story_guides)

        constraints_text = ""
        if constraints:
            constraints_text = "\n【Constraints】\n" + "\n".join(f"- {c}" for c in constraints)

        techniques_text = ""
        if injected_tricks:
            techniques_text = "\n【Proof Techniques to Consider】\n" + "\n".join(f"- {t}" for t in injected_tricks)

        fused_guidance = ""
        if fused_idea:
            fused_guidance = f"""
【Conceptual Innovation from Idea Synthesis】
Title: {fused_idea.get('fused_idea_title', '')}
Problem Framing: {fused_idea.get('problem_framing', '')}
Novelty Claim: {fused_idea.get('novelty_claim', '')}

This represents a THEORETICAL innovation. Reflect this in problem_framing,
gap_pattern, and main theorem statements.
"""

        return f"""Generate a structured mathematical paper story:

【Mathematical Idea】
"{user_idea}"

{fused_guidance}

【Pattern Template: {pattern_name}】
Representative Mathematical Ideas:
{ideas_text if ideas_text else "N/A"}

Proof Approaches (Technical methods for establishing results):
{solutions_text if solutions_text else "N/A"}

Story Framing Strategy (How to present the contribution):
{story_text if story_text else "N/A"}
{constraints_text}
{techniques_text}

【Requirements for Mathematical Papers】
1. Title MUST highlight core mathematical result (not just technique)
2. Use mathematical verbs: "prove", "establish", "introduce", "characterize"
3. Frame as: generalizing, unifying, resolving, extending classical results
4. Main claims should be theorem-like statements
5. Method skeleton should describe proof strategy
6. All fields in English
7. Valid JSON output

Output JSON:
{{
  "title": "Title highlighting main mathematical result",
  "abstract": "150-250 word abstract including main theorem statement",
  "problem_framing": "What mathematical question or structure is being studied?",
  "gap_pattern": "What's missing or unexplored in the literature?",
  "solution": "What's the main theoretical approach or framework?",
  "method_skeleton": "High-level proof strategy: Step 1; Step 2; Step 3",
  "innovation_claims": [
    "Main Theorem: We prove that...",
    "Technical Lemma: We establish...",
    "New Framework: We introduce..."
  ],
  "applications_plan": "Potential applications, corollaries, or future directions"
}}
"""

    def _build_refinement_prompt(
        self,
        user_idea: str,
        previous_story: Dict,
        review_feedback: Dict,
        pattern_info: Dict,
        injected_tricks: Optional[List[str]],
        fused_idea: Optional[Dict]
    ) -> str:
        """Build prompt for math story refinement."""
        summary = pattern_info.get("summary", {})
        solution_approaches = summary.get("solution_approaches", [])[:3]

        # Build feedback summary
        critique_summary = ""
        for review in review_feedback.get("reviews", []):
            critique_summary += f"- {review['role']}: {review['score']}/10. {review['feedback'][:200]}...\n"

        # Build fused idea guidance
        fused_guidance = ""
        if fused_idea:
            fused_guidance = f"""
【Conceptual Innovation from Idea Synthesis】
Title: {fused_idea.get('fused_idea_title', '')}
Problem Framing: {fused_idea.get('problem_framing', '')}
Novelty Claim: {fused_idea.get('novelty_claim', '')}

This is a THEORETICAL innovation, not just technical combination.
Reflect this in theorem statements and main claims.
"""

        # Build techniques instruction
        techniques_instruction = ""
        if injected_tricks:
            techniques_instruction = "\n【Proof Techniques to Integrate】\n"
            techniques_instruction += "\n".join(f"- {t}" for t in injected_tricks)

        solutions_text = "\n".join(f"- {s}" for s in solution_approaches)

        return f"""Refine the following mathematical paper story based on feedback:

【Mathematical Idea】
"{user_idea}"

{fused_guidance}

【Current Story】
Title: {previous_story.get('title')}
Abstract: {previous_story.get('abstract')}
Problem: {previous_story.get('problem_framing')}
Gap: {previous_story.get('gap_pattern')}
Solution: {previous_story.get('solution')}
Method: {previous_story.get('method_skeleton')}
Claims: {previous_story.get('innovation_claims')}

【Review Feedback】
{critique_summary}
{techniques_instruction}

【Available Proof Approaches】
{solutions_text if solutions_text else "N/A"}

【Refinement Principles】
1. Maintain mathematical idea as core result
2. Preserve rigorous theorem statements
3. Deep integration of new proof techniques (not superficial additions)
4. Use mathematical framing: generalize, extend, unify

Output refined JSON with ALL fields:
{{
  "title": "Title emphasizing main mathematical contribution",
  "abstract": "Abstract with clear theorem statements",
  "problem_framing": "Mathematical question being addressed",
  "gap_pattern": "What's missing in current understanding",
  "solution": "Main theoretical framework or approach",
  "method_skeleton": "Proof strategy overview",
  "innovation_claims": [
    "Main Theorem: ...",
    "Key Lemma: ...",
    "Technical Innovation: ..."
  ],
  "applications_plan": "Applications and future directions"
}}
"""

    def _parse_story(self, response: str) -> Dict:
        """Parse LLM response into math story dict."""
        story = super()._parse_story(response)
        
        # Rename experiments_plan to applications_plan if present
        if 'experiments_plan' in story and 'applications_plan' not in story:
            story['applications_plan'] = story.pop('experiments_plan')
        
        # Ensure mathematical framing in default values
        if not story.get('innovation_claims'):
            story['innovation_claims'] = ["Main Theorem: Novel mathematical result"]
        
        if not story.get('applications_plan'):
            story['applications_plan'] = "Further theoretical developments and applications"
        
        return story
