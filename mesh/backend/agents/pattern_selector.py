"""
Pattern Selector Agent - Multi-dimensional pattern classification using Gemini.
Based on Idea2Paper's PatternSelector with LLM-based scoring.

The PatternSelectorAgent evaluates research patterns across three dimensions:
1. Stability (0.0-1.0): How proven, mature, and widely-adopted
2. Novelty (0.0-1.0): How original, counter-intuitive, and fresh
3. Domain Distance (0.0-1.0): How different from user's core idea

This multi-dimensional scoring enables strategic pattern selection for different
research goals (conservative, innovative, cross-domain).
"""

from typing import Dict, List, Optional, Tuple
from .base import Agent


PATTERN_SELECTOR_SYSTEM = """You are a critical multi-dimensional pattern scorer for top-tier research conferences (ICLR/NeurIPS).

Your task is to rigorously evaluate research patterns across THREE independent dimensions:
1. Stability (0.0-1.0): How proven, mature, and widely-adopted is this pattern?
2. Novelty (0.0-1.0): How original, counter-intuitive, and fresh is this pattern?
3. Domain Distance (0.0-1.0): How different is this pattern from the user's core idea?

SCORING GUIDELINES:

**Stability Score:**
- 0.1-0.25: Highly experimental, niche idea, Size < 15, no standard benchmarks
- 0.3-0.45: Early-stage research, Size 15-40, some implementations but inconsistent
- 0.5-0.65: Maturing approach, Size 40-70, multiple implementations, emerging consensus
- 0.7-0.85: Well-established, Size 70-120, standard benchmarks, widely replicated
- 0.9-1.0: Foundational/canonical, Size > 120, ubiquitous, considered solved

**Novelty Score:**
- 0.1-0.25: Well-trodden path, combinations of existing techniques
- 0.3-0.45: Some novelty in execution or application domain
- 0.5-0.65: Interesting recombination or new angle on known problems
- 0.7-0.85: Novel methodology, surprising insight, challenges conventional wisdom
- 0.9-1.0: Paradigm shift, highly counter-intuitive, fundamentally new formulation

**Domain Distance:**
- 0.0-0.15: Directly addresses same problem, highly relevant methodology
- 0.2-0.35: Related domain/approach, applicable with minor adaptation
- 0.4-0.55: Different domain but transferable insights, moderate adaptation needed
- 0.6-0.8: Orthogonal domain, interesting cross-domain inspirations
- 0.85-1.0: Completely different field, minimal direct relevance

CRITICAL INSTRUCTIONS:
1. DO NOT give all patterns middle-range scores (0.4-0.6). Spread the distribution.
2. DISTINGUISH between: optimization (low novelty), new methodology (medium), paradigm shift (high).
3. Large cluster size (>100) should NOT automatically mean high stability.
4. Small cluster size (<20) should NOT automatically mean low novelty.

Output JSON only, with this format:
{
  "stability_score": 0.75,
  "novelty_score": 0.55,
  "domain_distance": 0.25,
  "reasoning": "Brief explanation"
}
"""


class PatternSelectorAgent:
    """
    Agent for selecting and scoring research patterns using multi-dimensional LLM evaluation.

    Uses Rho for LLM-based pattern scoring with fallback to rule-based scoring.
    """

    def __init__(
        self,
        model: str = "gemini-3-flash-preview",
        temperature: float = 0.3,
        max_tokens: int = 500
    ):
        """
        Initialize the Pattern Selector Agent.

        Args:
            model: Gemini model to use
            temperature: Sampling temperature (lower for more consistent scoring)
            max_tokens: Maximum tokens in response
        """
        self.agent = Agent(
            model=model,
            system_prompt=PATTERN_SELECTOR_SYSTEM,
            temperature=temperature,
            max_tokens=max_tokens
        )

    async def score_patterns(
        self,
        patterns: List[Dict],
        user_idea: str,
        top_n: int = 20
    ) -> Dict[str, List[Tuple[str, Dict, Dict]]]:
        """
        Score patterns across three dimensions and rank them.

        Args:
            patterns: List of pattern dicts with metadata
            user_idea: User's research idea
            top_n: Number of patterns to score with LLM

        Returns:
            Dict with three ranked lists:
            {
                'stability': [(pattern_id, pattern_info, metadata), ...],
                'novelty': [(pattern_id, pattern_info, metadata), ...],
                'domain_distance': [(pattern_id, pattern_info, metadata), ...]
            }
        """
        pattern_scores = {}

        # Score top patterns with LLM
        for i, pattern in enumerate(patterns[:top_n]):
            pattern_id = pattern["pattern_id"]
            pattern_name = pattern["name"]
            pattern_size = pattern["size"]

            # Get representative ideas
            summary = pattern.get("summary", {})
            representative_ideas = summary.get("representative_ideas", [])[:3]

            # Build prompt
            prompt = self._build_scoring_prompt(
                user_idea, pattern_name, pattern_size, representative_ideas
            )

            # Call LLM
            try:
                response = await self.agent.run(prompt)
                scores = self._parse_scores(response.content)

                if scores:
                    pattern_scores[pattern_id] = scores
                    print(f"  ✓ {pattern_id}: stability={scores['stability_score']:.2f}, "
                          f"novelty={scores['novelty_score']:.2f}, "
                          f"domain_distance={scores['domain_distance']:.2f}")
                else:
                    # Use fallback
                    pattern_scores[pattern_id] = self._fallback_scoring(pattern_size)
                    print(f"  ⚠ {pattern_id}: Using fallback scoring")
            except Exception as e:
                print(f"  ⚠️  LLM scoring failed ({pattern_id}): {e}")
                pattern_scores[pattern_id] = self._fallback_scoring(pattern_size)

        # Rank patterns by each dimension
        ranked = {
            'stability': [],
            'novelty': [],
            'domain_distance': []
        }

        for pattern in patterns:
            pattern_id = pattern["pattern_id"]
            scores = pattern_scores.get(pattern_id)

            if not scores:
                # Fallback: rule-based scoring
                scores = self._fallback_scoring(pattern["size"])

            metadata = {
                'recall_score': pattern.get('recall_score', 0.0),
                'scores': scores
            }

            # Add to all three rankings
            ranked['stability'].append((pattern_id, pattern, metadata))
            ranked['novelty'].append((pattern_id, pattern, metadata))
            ranked['domain_distance'].append((pattern_id, pattern, metadata))

        # Sort each dimension
        ranked['stability'].sort(
            key=lambda x: x[2]['scores']['stability_score'],
            reverse=True
        )
        ranked['novelty'].sort(
            key=lambda x: x[2]['scores']['novelty_score'],
            reverse=True
        )
        ranked['domain_distance'].sort(
            key=lambda x: x[2]['scores']['domain_distance'],
            reverse=False  # Lower is better (closer to user idea)
        )

        return ranked

    def _build_scoring_prompt(
        self,
        user_idea: str,
        pattern_name: str,
        pattern_size: int,
        representative_ideas: List[str]
    ) -> str:
        """
        Build prompt for multi-dimensional scoring.

        Args:
            user_idea: User's research idea
            pattern_name: Pattern name
            pattern_size: Pattern cluster size
            representative_ideas: Sample ideas from pattern

        Returns:
            Prompt string
        """
        ideas_text = "\n".join(f"- {idea}" for idea in representative_ideas)

        return f"""Evaluate this research pattern:

【User's Research Idea】
"{user_idea}"

【Pattern Information】
Name: {pattern_name}
Cluster Size: {pattern_size} papers
Representative Research Ideas:
{ideas_text if ideas_text else "N/A"}

Provide scores for:
1. Stability: How proven and mature?
2. Novelty: How original and fresh?
3. Domain Distance: How different from user idea?

Output JSON only:
{{
  "stability_score": 0.75,
  "novelty_score": 0.55,
  "domain_distance": 0.25,
  "reasoning": "Brief explanation"
}}
"""

    def _parse_scores(self, response: str) -> Optional[Dict]:
        """
        Parse LLM response into scores dict.

        Args:
            response: LLM response string

        Returns:
            Scores dict or None if parsing fails
        """
        import json
        import re

        # Try JSON parse
        try:
            data = json.loads(response)
            if all(k in data for k in ['stability_score', 'novelty_score', 'domain_distance']):
                return data
        except:
            pass

        # Try regex extraction
        stability_match = re.search(r'"stability_score"\s*:\s*([\d.]+)', response)
        novelty_match = re.search(r'"novelty_score"\s*:\s*([\d.]+)', response)
        domain_match = re.search(r'"domain_distance"\s*:\s*([\d.]+)', response)

        if stability_match and novelty_match and domain_match:
            return {
                'stability_score': float(stability_match.group(1)),
                'novelty_score': float(novelty_match.group(1)),
                'domain_distance': float(domain_match.group(1))
            }

        return None

    def _fallback_scoring(self, pattern_size: int) -> Dict:
        """
        Rule-based scoring when LLM fails.

        Args:
            pattern_size: Pattern cluster size

        Returns:
            Scores dict
        """
        if pattern_size > 100:
            # Large mature community
            return {
                'stability_score': 0.85,
                'novelty_score': 0.25,
                'domain_distance': 0.25
            }
        elif pattern_size > 50:
            # Mature community
            return {
                'stability_score': 0.80,
                'novelty_score': 0.30,
                'domain_distance': 0.30
            }
        elif pattern_size > 20:
            # Medium community
            return {
                'stability_score': 0.65,
                'novelty_score': 0.45,
                'domain_distance': 0.40
            }
        else:
            # Small community, high innovation
            return {
                'stability_score': 0.40,
                'novelty_score': 0.70,
                'domain_distance': 0.50
            }
