"""
Idea Fusion Agent - Combines concepts for innovation at conceptual level.
Based on Idea2Paper's IdeaFusionEngine.

The IdeaFusionAgent performs conceptual-level fusion between a user's idea
and research patterns. Unlike simple technical combination (A + B), conceptual
fusion creates new insights by finding complementarities in problem spaces,
assumption spaces, and innovation products.

Key insight: The best innovations come from reframing problems, not just
combining techniques.
"""

from typing import Dict, Optional
from .base import Agent


IDEA_FUSION_SYSTEM = """You are an expert at conceptual-level innovation fusion.
Your task is to combine two research ideas in a way that creates NEW INSIGHTS,
not just technical stacking.

Focus on:
1. Problem space complementarity - How does each approach extend the problem?
2. Assumption space intersection - What shared assumptions can be challenged?
3. Innovation product (1+1>2) - What new capabilities emerge?
4. Organic fusion mechanisms - How can ideas co-evolve rather than co-exist?

AVOID simple "A + B" combinations. Instead, aim for conceptual reframing.

Good fusion examples:
- Image Captioning + Contrastive Learning → "Reframe captioning as contrastive reasoning
  where models distinguish similar scenes through semantic differences"
- Model Compression + Knowledge Distillation → "Transform compression into knowledge
  inheritance where students inherit reasoning structure through distillation-guided
  architecture search"

Output in JSON format with all required fields."""


class IdeaFusionAgent:
    """
    Agent for fusing user ideas with pattern ideas at the conceptual level.

    Performs DNA extraction, fusion point discovery, and generates fused ideas
    with new problem framing and novelty claims.
    """

    def __init__(
        self,
        model: str = "gemini-3-flash-preview",
        temperature: float = 0.9,
        max_tokens: int = 2000
    ):
        """
        Initialize the Idea Fusion Agent.

        Args:
            model: Gemini model to use
            temperature: Sampling temperature (higher for more creativity)
            max_tokens: Maximum tokens in response
        """
        self.agent = Agent(
            model=model,
            system_prompt=IDEA_FUSION_SYSTEM,
            temperature=temperature,
            max_tokens=max_tokens
        )

    async def fuse(
        self,
        user_idea: str,
        pattern_id: str,
        pattern_info: Dict,
        previous_story: Optional[Dict] = None
    ) -> Dict:
        """
        Fuse user idea with pattern idea.

        Args:
            user_idea: User's original idea
            pattern_id: Pattern ID
            pattern_info: Pattern details
            previous_story: Previous story for DNA extraction

        Returns:
            Fused idea dict with new problem framing, assumptions, novelty claims
        """
        # Step 1: Analyze user idea DNA
        user_dna = await self._analyze_idea_dna(user_idea, previous_story)

        # Step 2: Extract pattern idea DNA
        pattern_dna = await self._extract_pattern_dna(pattern_id, pattern_info)

        # Step 3: Discover fusion points
        fusion_analysis = await self._discover_fusion_points(
            user_idea, user_dna, pattern_info.get("name", ""), pattern_dna
        )

        # Step 4: Generate fused idea
        fused_result = await self._generate_fused_idea(
            user_idea, user_dna, pattern_info.get("name", ""), pattern_dna, fusion_analysis
        )

        return fused_result

    async def _analyze_idea_dna(
        self,
        idea: str,
        previous_story: Optional[Dict]
    ) -> Dict:
        """
        Extract core DNA from user idea.

        Args:
            idea: User's idea
            previous_story: Optional previous story for extraction

        Returns:
            DNA dict with problem, assumption, novelty_claim
        """
        if previous_story:
            return {
                'problem': previous_story.get('problem_framing', idea),
                'assumption': previous_story.get('gap_pattern', ''),
                'novelty_claim': previous_story.get('solution', '')
            }

        prompt = f"""Analyze this research idea's core DNA:

【Idea】
"{idea}"

Extract:
1. Problem: What core problem does it address?
2. Assumption: What's the key assumption?
3. Novelty Claim: What's the innovation?

Output JSON:
{{
  "problem": "...",
  "assumption": "...",
  "novelty_claim": "..."
}}
"""

        response = await self.agent.run(prompt)
        return self._parse_json_response(response.content)

    async def _extract_pattern_dna(
        self,
        pattern_id: str,
        pattern_info: Dict
    ) -> Dict:
        """
        Extract core DNA from pattern.

        Args:
            pattern_id: Pattern ID
            pattern_info: Pattern details

        Returns:
            DNA dict with problem, assumption, novelty_claim
        """
        summary = pattern_info.get("summary", {})
        solution_approaches = summary.get("solution_approaches", [])[:2]

        approaches_text = "\n".join(f"- {s}" for s in solution_approaches)

        prompt = f"""Analyze this research pattern's core DNA:

【Pattern】
Name: {pattern_info.get('name', '')}
Solution Approaches:
{approaches_text}

Extract:
1. Problem: What type of problem does this address?
2. Assumption: What's the core insight?
3. Novelty Claim: What's the innovation?

Output JSON:
{{
  "problem": "...",
  "assumption": "...",
  "novelty_claim": "..."
}}
"""

        response = await self.agent.run(prompt)
        return self._parse_json_response(response.content)

    async def _discover_fusion_points(
        self,
        user_idea: str,
        user_dna: Dict,
        pattern_name: str,
        pattern_dna: Dict
    ) -> Dict:
        """
        Discover where fusion can create innovation.

        Args:
            user_idea: User's idea
            user_dna: User's idea DNA
            pattern_name: Pattern name
            pattern_dna: Pattern's DNA

        Returns:
            Fusion analysis dict
        """
        prompt = f"""Analyze fusion potential between:

【User Idea】
Problem: {user_dna['problem']}
Assumption: {user_dna['assumption']}
Innovation: {user_dna['novelty_claim']}

【Pattern: {pattern_name}】
Problem: {pattern_dna['problem']}
Assumption: {pattern_dna['assumption']}
Innovation: {pattern_dna['novelty_claim']}

Identify:
1. Problem Complement: How does pattern extend user idea?
2. Assumption Intersection: Shared assumptions with different angles?
3. Innovation Product: 1+1>2 potential?
4. Fusion Mechanism: How to integrate organically?

Output JSON:
{{
  "problem_complement": "...",
  "assumption_intersection": "...",
  "innovation_product": "...",
  "fusion_mechanism": "..."
}}
"""

        response = await self.agent.run(prompt)
        return self._parse_json_response(response.content)

    async def _generate_fused_idea(
        self,
        user_idea: str,
        user_dna: Dict,
        pattern_name: str,
        pattern_dna: Dict,
        fusion_analysis: Dict
    ) -> Dict:
        """
        Generate the fused idea.

        Args:
            user_idea: User's idea
            user_dna: User's idea DNA
            pattern_name: Pattern name
            pattern_dna: Pattern's DNA
            fusion_analysis: Fusion point analysis

        Returns:
            Fused idea dict
        """
        prompt = f"""Generate a CONCEPTUALLY INNOVATIVE fused idea (not A+B):

【Original User Idea】
{user_idea}

【User Idea DNA】
Problem: {user_dna['problem']}
Assumption: {user_dna['assumption']}
Innovation: {user_dna['novelty_claim']}

【Pattern: {pattern_name}】
Problem: {pattern_dna['problem']}
Assumption: {pattern_dna['assumption']}
Innovation: {pattern_dna['novelty_claim']}

【Fusion Analysis】
Problem Complement: {fusion_analysis['problem_complement']}
Assumption Intersection: {fusion_analysis['assumption_intersection']}
Innovation Product: {fusion_analysis['innovation_product']}
Fusion Mechanism: {fusion_analysis['fusion_mechanism']}

GOOD FUSION EXAMPLES:

Example 1: Image Captioning + Contrastive Learning
❌ Bad: "Use contrastive learning to improve captioning"
✅ Good: "Reframe captioning as contrastive reasoning where models distinguish similar scenes through semantic differences"

Example 2: Model Compression + Knowledge Distillation
❌ Bad: "Apply distillation to compress models"
✅ Good: "Transform compression into knowledge inheritance where students inherit reasoning structure through distillation-guided architecture search"

Now generate YOUR fused idea following this quality standard.

Output JSON:
{{
  "fused_idea_title": "Concise title (10 words)",
  "fused_idea_description": "Brief description (150 words)",
  "problem_framing": "Reframed problem (200 words)",
  "core_assumption": "Core assumption (150 words)",
  "novelty_claim": "Innovation claim (150 words)",
  "key_innovation_points": ["Point 1", "Point 2", "Point 3"],
  "why_not_straightforward_combination": "Explain why this is NOT simple A+B (100 words)"
}}

REQUIREMENTS:
1. Should sound like conceptual innovation, not technical stacking
2. Use "reframe", "transform", "unify" - NOT "combine", "integrate"
3. Show how ideas CO-EVOLVE rather than CO-EXIST
"""

        response = await self.agent.run(prompt)
        return self._parse_json_response(response.content)

    def _parse_json_response(self, content: str) -> Dict:
        """Parse JSON from LLM response."""
        import json
        import re

        try:
            return json.loads(content)
        except:
            # Try regex extraction
            match = re.search(r'\{.*\}', content, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group(0))
                except:
                    pass

        # Return default
        return {
            'fused_idea_title': 'Integrated Approach',
            'fused_idea_description': 'Combination of approaches',
            'problem_framing': 'Extended problem definition',
            'core_assumption': 'Shared assumptions',
            'novelty_claim': 'Combined innovations',
            'key_innovation_points': ['Integration', 'Optimization', 'Validation'],
            'why_not_straightforward_combination': 'Conceptual-level fusion achieved'
        }
