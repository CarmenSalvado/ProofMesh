"""
Story Generator Agent - Generates structured paper stories with templates.
Based on Idea2Paper's StoryGenerator with Rho.

The StoryGeneratorAgent creates complete paper narratives from research ideas
using proven writing templates and patterns. It ensures the user's idea remains
the protagonist while integrating technical approaches from research patterns.

Story sections:
- title: Concise, highlights core contribution
- abstract: 150-250 word summary
- problem_framing: What problem does this address?
- gap_pattern: What's missing in current approaches?
- solution: What's the proposed approach?
- method_skeleton: High-level implementation steps
- innovation_claims: Key claims of novelty/contribution
- experiments_plan: How to validate the approach
"""

from typing import Dict, List, Optional
from .base import Agent


STORY_GENERATOR_SYSTEM = """You are a senior paper author at a top AI conference (ICLR/NeurIPS).
Generate structured paper stories based on user ideas and writing templates.

CRITICAL RULES:
1. User Idea is the PROTAGONIST - it must appear in title, abstract, problem framing, and all claims
2. Pattern techniques are TOOLS, not the hero - they implement the user's core concepts
3. Use "Reframe/Transform" narrative patterns for maximum impact
4. Output valid JSON with all required fields
5. ALL output must be in English

Your goal is to transform the user's idea into a compelling research narrative
that reviewers will find novel, sound, and significant."""


class StoryGeneratorAgent:
    """
    Agent for generating structured paper stories from ideas and patterns.

    Supports both initial generation and refinement modes with feedback integration.
    """

    def __init__(
        self,
        model: str = "gemini-3-flash-preview",
        temperature: float = 0.7,
        max_tokens: int = 2000
    ):
        """
        Initialize the Story Generator Agent.

        Args:
            model: Gemini model to use
            temperature: Sampling temperature (higher for more creativity)
            max_tokens: Maximum tokens in response
        """
        self.agent = Agent(
            model=model,
            system_prompt=STORY_GENERATOR_SYSTEM,
            temperature=temperature,
            max_tokens=max_tokens
        )

    async def generate(
        self,
        user_idea: str,
        pattern_info: Dict,
        constraints: Optional[List[str]] = None,
        injected_tricks: Optional[List[str]] = None,
        previous_story: Optional[Dict] = None,
        review_feedback: Optional[Dict] = None,
        fused_idea: Optional[Dict] = None
    ) -> Dict:
        """
        Generate a structured paper story.

        Args:
            user_idea: User's research idea
            pattern_info: Pattern with solution approaches and story guides
            constraints: Optional constraints
            injected_tricks: Optional techniques to inject
            previous_story: Previous version for refinement mode
            review_feedback: Feedback from critic (for refinement mode)
            fused_idea: Optional fused idea from fusion engine

        Returns:
            Story dict with all sections
        """
        if previous_story and review_feedback:
            # Refinement mode
            prompt = self._build_refinement_prompt(
                user_idea, previous_story, review_feedback,
                pattern_info, injected_tricks, fused_idea
            )
        else:
            # Generation mode
            prompt = self._build_generation_prompt(
                user_idea, pattern_info, constraints, injected_tricks, fused_idea
            )

        response = await self.agent.run(prompt)
        story = self._parse_story(response.content)

        # Add pattern metadata
        story["pattern_id"] = pattern_info.get("pattern_id", "")
        story["pattern_name"] = pattern_info.get("name", "")

        return story

    def _build_generation_prompt(
        self,
        user_idea: str,
        pattern_info: Dict,
        constraints: Optional[List[str]],
        injected_tricks: Optional[List[str]],
        fused_idea: Optional[Dict]
    ) -> str:
        """Build prompt for initial story generation."""
        pattern_name = pattern_info.get("name", "")
        summary = pattern_info.get("summary", {})

        representative_ideas = summary.get("representative_ideas", [])[:3]
        solution_approaches = summary.get("solution_approaches", [])[:3]
        story_guides = summary.get("story", [])[:2]

        # Build sections
        ideas_text = "\n".join(f"- {idea}" for idea in representative_ideas)
        solutions_text = "\n".join(f"- {sol}" for sol in solution_approaches)
        story_text = "\n".join(f"- {guide}" for guide in story_guides)

        constraints_text = ""
        if constraints:
            constraints_text = "\n【Constraints】\n" + "\n".join(f"- {c}" for c in constraints)

        tricks_text = ""
        if injected_tricks:
            tricks_text = "\n【Required Techniques】\n" + "\n".join(f"- {t}" for t in injected_tricks)

        fused_guidance = ""
        if fused_idea:
            fused_guidance = f"""
【Conceptual Innovation from Idea Fusion】
Title: {fused_idea.get('fused_idea_title', '')}
Problem Framing: {fused_idea.get('problem_framing', '')}
Novelty Claim: {fused_idea.get('novelty_claim', '')}

This represents a CONCEPTUAL-LEVEL innovation. Reflect this in problem_framing,
gap_pattern, and innovation_claims.
"""

        return f"""Generate a structured paper story:

【User Idea】
"{user_idea}"

{fused_guidance}

【Writing Template: {pattern_name}】
Representative Ideas:
{ideas_text if ideas_text else "N/A"}

Solution Approaches (Technical means to implement core concepts):
{solutions_text if solutions_text else "N/A"}

Story Packaging Strategy (How to frame as transformative):
{story_text if story_text else "N/A"}
{constraints_text}
{tricks_text}

【Requirements】
1. Title MUST highlight User Idea's core concepts (not just techniques)
2. Use "Reframe/Transform" patterns in problem_framing and claims
3. All fields in English
4. Valid JSON output

Output JSON:
{{
  "title": "...",
  "abstract": "...",
  "problem_framing": "...",
  "gap_pattern": "...",
  "solution": "...",
  "method_skeleton": "Step 1; Step 2; Step 3",
  "innovation_claims": ["Claim 1", "Claim 2", "Claim 3"],
  "experiments_plan": "..."
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
        """Build prompt for story refinement."""
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
【Conceptual Innovation from Idea Fusion】
Title: {fused_idea.get('fused_idea_title', '')}
Problem Framing: {fused_idea.get('problem_framing', '')}
Novelty Claim: {fused_idea.get('novelty_claim', '')}

This represents a CONCEPTUAL-LEVEL innovation, not just technical combination.
Reflect this in problem_framing, gap_pattern, and innovation_claims.
"""

        # Build tricks instruction
        tricks_instruction = ""
        if injected_tricks:
            tricks_instruction = "\n【Techniques to Integrate】\n"
            tricks_instruction += "\n".join(f"- {t}" for t in injected_tricks)

        solutions_text = "\n".join(f"- {s}" for s in solution_approaches)

        return f"""Refine the following story based on feedback:

【User Idea】
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
{tricks_instruction}

【Available Solutions】
{solutions_text if solutions_text else "N/A"}

【Refinement Principles】
1. Maintain User Idea as protagonist
2. Preserve well-received sections
3. Deep integration of new techniques (not stacking)
4. Use "Transform/Reframe" patterns

Output refined JSON with ALL fields:
{{
  "title": "...",
  "abstract": "...",
  "problem_framing": "...",
  "gap_pattern": "...",
  "solution": "...",
  "method_skeleton": "...",
  "innovation_claims": ["..."],
  "experiments_plan": "..."
}}
"""

    def _parse_story(self, response: str) -> Dict:
        """Parse LLM response into story dict."""
        import json
        import re

        # Try direct JSON parse
        try:
            return json.loads(response)
        except:
            pass

        # Try regex extraction
        story = {
            'title': self._extract_field(response, 'title'),
            'abstract': self._extract_field(response, 'abstract'),
            'problem_framing': self._extract_field(response, 'problem_framing'),
            'gap_pattern': self._extract_field(response, 'gap_pattern'),
            'solution': self._extract_field(response, 'solution'),
            'method_skeleton': self._extract_field(response, 'method_skeleton'),
            'experiments_plan': self._extract_field(response, 'experiments_plan'),
            'innovation_claims': self._extract_list(response, 'innovation_claims')
        }

        # Ensure all fields exist
        for field in ['title', 'abstract', 'problem_framing', 'gap_pattern',
                     'solution', 'method_skeleton', 'experiments_plan']:
            if not story[field]:
                story[field] = "To be developed"

        if not story['innovation_claims']:
            story['innovation_claims'] = ["Novel approach to the problem"]

        return story

    def _extract_field(self, text: str, field: str) -> str:
        """Extract field value from text."""
        pattern = rf'"{field}"\s*:\s*"([^"]*(?:\\.[^"]*)*)"'
        match = re.search(pattern, text, re.DOTALL)
        if match:
            return match.group(1).replace('\\"', '"').replace('\\n', '\n')
        return ""

    def _extract_list(self, text: str, field: str) -> List[str]:
        """Extract list field from text."""
        pattern = rf'"{field}"\s*:\s*\[(.*?)\]'
        match = re.search(pattern, text, re.DOTALL)
        if match:
            items = re.findall(r'"([^"]*(?:\\.[^"]*)*)"', match.group(1))
            return [i.replace('\\"', '"').replace('\\n', '\n') for i in items]
        return []
