"""
Enhanced Critic Agent - Anchor-based multi-agent review with calibration.
Based on Idea2Paper's MultiAgentCritic with real paper anchors.

The EnhancedCriticAgent provides calibrated, auditable 1-10 scores by comparing
generated stories against real papers with known review scores (anchors). This
produces more reliable evaluation than absolute scoring.

Three specialized reviewers:
1. Methodology Reviewer: Technical soundness and implementation details
2. Novelty Reviewer: Innovation and originality assessment
3. Storyteller Reviewer: Narrative completeness and coherence

The scoring algorithm uses sigmoid fitting to determine the most likely score
based on relative comparisons to anchor papers.
"""

from typing import Dict, List, Optional, Tuple
from .base import Agent


ENHANCED_CRITIC_SYSTEM = """You are a strict reviewer for top-tier ML/NLP conferences (ICLR/NeurIPS).
You must NOT output a direct score. Only compare the Story against anchor papers with real review scores.

For each anchor paper, decide whether the Story is better, tie, or worse, and provide confidence (0-1).
You MUST mention the anchor's score10 in the rationale using "score10: X.X" format.

Output JSON ONLY, with this exact structure:
{
  "comparisons": [
    {"paper_id":"...", "judgement":"better|tie|worse", "confidence":0.0-1.0, "rationale":"...score10: X.X..."}
  ],
  "main_gaps": ["gap1", "gap2", "gap3"]
}

Be discriminative in your comparisons. Don't default to "tie" - make clear judgments."""


class EnhancedCriticAgent:
    """
    Enhanced critic agent using anchored comparisons with real papers.

    Provides calibrated, auditable 1-10 scores through relative comparison
    to anchor papers with known review statistics.
    """

    def __init__(
        self,
        model: str = "gemini-3-pro-preview",
        temperature: float = 0.0,
        max_tokens: int = 1000
    ):
        """
        Initialize the Enhanced Critic Agent.

        Args:
            model: Gemini model to use (pro for better reasoning)
            temperature: Sampling temperature (0 for deterministic)
            max_tokens: Maximum tokens in response
        """
        self.agent = Agent(
            model=model,
            system_prompt=ENHANCED_CRITIC_SYSTEM,
            temperature=temperature,
            max_tokens=max_tokens
        )

        self.reviewers = [
            {'name': 'Reviewer A', 'role': 'Methodology', 'focus': 'Technical soundness'},
            {'name': 'Reviewer B', 'role': 'Novelty', 'focus': 'Innovation and originality'},
            {'name': 'Reviewer C', 'role': 'Storyteller', 'focus': 'Narrative clarity'}
        ]

    async def review(
        self,
        story: Dict,
        anchors: List[Dict],
        pattern_id: Optional[str] = None
    ) -> Dict:
        """
        Review story using anchored multi-agent comparison.

        Args:
            story: Story dict to review
            anchors: List of anchor papers with scores
            pattern_id: Optional pattern ID for context

        Returns:
            Review result with scores, feedback, and pass decision
        """
        if not anchors:
            return self._neutral_review()

        # Run anchored reviews
        reviews = []
        role_scores = {}

        for reviewer in self.reviewers:
            anchored_review = await self._anchored_review(story, reviewer, anchors, pattern_id)
            reviews.append({
                'reviewer': reviewer['name'],
                'role': reviewer['role'],
                'score': anchored_review['score'],
                'feedback': anchored_review['feedback']
            })
            role_scores[reviewer['role']] = anchored_review['score']

        # Compute average
        avg_score = sum(role_scores.values()) / len(role_scores)

        # Diagnose main issue
        main_issue, suggestions = self._diagnose_issue(reviews, role_scores)

        # Compute pass decision
        passed = avg_score >= 6.5  # Threshold for pass

        return {
            'pass': passed,
            'avg_score': avg_score,
            'reviews': reviews,
            'main_issue': main_issue,
            'suggestions': suggestions,
            'audit': {
                'pattern_id': pattern_id,
                'anchors': anchors,
                'role_scores': role_scores
            }
        }

    async def _anchored_review(
        self,
        story: Dict,
        reviewer: Dict,
        anchors: List[Dict],
        pattern_id: str
    ) -> Dict:
        """
        Perform single anchored review.

        Args:
            story: Story to review
            reviewer: Reviewer dict with role and focus
            anchors: Anchor papers
            pattern_id: Pattern ID

        Returns:
            Review dict with score and feedback
        """
        # Get comparisons with retries
        comparisons = await self._get_comparisons_with_retries(
            story, reviewer, anchors, pattern_id
        )

        if not comparisons:
            return {
                'score': 5.0,
                'feedback': f'LLM comparison failed for {reviewer["role"]}',
                'detail': {}
            }

        # Compute score from comparisons
        score, detail = self._compute_score_from_comparisons(anchors, comparisons)

        # Build feedback
        main_gaps = [c.get('rationale', '') for c in comparisons if c.get('judgement') == 'worse']
        feedback = f"Main gaps: {', '.join(main_gaps[:3])}. Anchored against {len(anchors)} papers."

        return {
            'score': score,
            'feedback': feedback,
            'detail': {
                'comparisons': comparisons,
                'score': score,
                **detail
            }
        }

    async def _get_comparisons_with_retries(
        self,
        story: Dict,
        reviewer: Dict,
        anchors: List[Dict],
        pattern_id: str,
        max_retries: int = 2
    ) -> Optional[List[Dict]]:
        """
        Get comparisons with JSON validation and retry.

        Args:
            story: Story to review
            reviewer: Reviewer info
            anchors: Anchor papers
            pattern_id: Pattern ID
            max_retries: Maximum retry attempts

        Returns:
            List of comparison dicts or None if all retries fail
        """
        prompt = self._build_comparison_prompt(story, reviewer, anchors)

        for attempt in range(max_retries + 1):
            try:
                response = await self.agent.run(prompt)
                comparisons = self._parse_comparisons(response.content, anchors)

                if comparisons:
                    return comparisons

                if attempt < max_retries:
                    # Try repair prompt
                    prompt = self._build_repair_prompt(anchors, reviewer['role'], response.content)

            except Exception as e:
                print(f"Comparison attempt {attempt + 1} failed: {e}")
                if attempt < max_retries:
                    continue

        # All retries failed
        return None

    def _build_comparison_prompt(
        self,
        story: Dict,
        reviewer: Dict,
        anchors: List[Dict]
    ) -> str:
        """Build prompt for anchored comparison."""
        anchor_lines = []
        for a in anchors:
            anchor_lines.append(
                f"- paper_id: {a['paper_id']} | title: {a.get('title', 'N/A')} | score10: {a['score10']:.1f}"
            )
        anchor_text = "\n".join(anchor_lines)

        problem_text = story.get('problem_framing', '')
        method_text = story.get('method_skeleton', '')

        return f"""You are a strict reviewer ({reviewer['role']}) for top-tier conferences.
Compare the Story against anchor papers with REAL review scores.

Anchors (score10 from actual review statistics):
{anchor_text}

Story:
Title: {story.get('title', '')}
Abstract: {story.get('abstract', '')}
Problem: {problem_text}
Method: {method_text}
Claims: {', '.join(story.get('innovation_claims', []))}

For EACH anchor, decide: better, tie, or worse on {reviewer['role']}.
Provide confidence (0-1) and ONE sentence rationale.
MUST mention "score10: X.X" for each anchor.

Output JSON ONLY:
{{
  "comparisons": [
    {{"paper_id":"...", "judgement":"better|tie|worse", "confidence":0.0-1.0, "rationale":"...score10: X.X..."}}
  ],
  "main_gaps": ["gap1", "gap2", "gap3"]
}}
"""

    def _build_repair_prompt(
        self,
        anchors: List[Dict],
        reviewer_role: str,
        previous_output: str
    ) -> str:
        """Build prompt to repair invalid JSON."""
        anchor_lines = [f"- paper_id: {a['paper_id']} | score10: {a['score10']:.1f}" for a in anchors]
        anchor_text = "\n".join(anchor_lines)

        return f"""Fix the previous output into VALID JSON.

Role: {reviewer_role}

Anchors (must cover ALL):
{anchor_text}

Rules:
1) JSON ONLY (no markdown)
2) comparisons length = number of anchors
3) Each paper_id must be from list
4) judgement: better|tie|worse
5) confidence: number in [0,1]
6) rationale MUST include "score10: X.X"

Previous output:
{previous_output[:2000]}

Return corrected JSON:
{{
  "comparisons": [
    {{"paper_id":"...", "judgement":"better|tie|worse", "confidence":0.0, "rationale":"...score10: X.X..."}}
  ],
  "main_gaps": ["gap1", "gap2"]
}}
"""

    def _parse_comparisons(
        self,
        content: str,
        anchors: List[Dict]
    ) -> Optional[List[Dict]]:
        """Parse and validate comparisons from LLM response."""
        import json
        import re

        try:
            data = json.loads(content)
        except:
            # Try regex extraction
            match = re.search(r'\{.*\}', content, re.DOTALL)
            if match:
                try:
                    data = json.loads(match.group(0))
                except:
                    return None
            else:
                return None

        comparisons = data.get('comparisons', [])
        if not isinstance(comparisons, list):
            return None

        # Validate
        anchor_ids = {a['paper_id'] for a in anchors}
        validated = []

        for comp in comparisons:
            if not isinstance(comp, dict):
                continue
            pid = comp.get('paper_id')
            if pid not in anchor_ids:
                continue
            judgement = comp.get('judgement')
            if judgement not in ('better', 'tie', 'worse'):
                continue

            validated.append({
                'paper_id': pid,
                'judgement': judgement,
                'confidence': float(comp.get('confidence', 0.0)),
                'rationale': comp.get('rationale', '')
            })

        # Check all anchors covered
        if len(validated) != len(anchors):
            return None

        return validated

    def _compute_score_from_comparisons(
        self,
        anchors: List[Dict],
        comparisons: List[Dict]
    ) -> Tuple[float, Dict]:
        """
        Compute deterministic score from comparisons using sigmoid fitting.
        Based on Idea2Paper's scoring algorithm.

        Args:
            anchors: Anchor papers
            comparisons: Comparison results

        Returns:
            Tuple of (score, detail_dict)
        """
        import math

        comp_map = {c['paper_id']: c for c in comparisons}

        probs = []
        weights = []
        scores = []

        for anchor in anchors:
            comp = comp_map.get(anchor['paper_id'], {'judgement': 'tie', 'confidence': 0.0})
            judgement = comp['judgement']
            confidence = max(0.0, min(1.0, comp['confidence']))

            if judgement == 'better':
                p = 0.5 + 0.45 * confidence
            elif judgement == 'worse':
                p = 0.5 - 0.45 * confidence
            else:
                p = 0.5

            probs.append(p)
            weights.append(anchor.get('weight', 1.0))
            scores.append(anchor['score10'])

        # Sigmoid fitting
        def sigmoid(x):
            return 1 / (1 + math.exp(-1.2 * x))

        best_s = 5.0
        best_loss = float('inf')

        for s_float in [i * 0.01 for i in range(100, 1001)]:
            loss = 0.0
            for p, w, score in zip(probs, weights, scores):
                pred = sigmoid(s_float - score)
                loss += w * (pred - p) ** 2

            if loss < best_loss:
                best_loss = loss
                best_s = s_float

        return best_s, {'loss': best_loss}

    def _diagnose_issue(
        self,
        reviews: List[Dict],
        role_scores: Dict[str, float]
    ) -> Tuple[str, List[str]]:
        """
        Diagnose main issue from reviews.

        Args:
            reviews: List of review dicts
            role_scores: Dict mapping role to score

        Returns:
            Tuple of (main_issue, suggestions_list)
        """
        # Find lowest score
        worst_role = min(role_scores.keys(), key=lambda k: role_scores[k])

        if worst_role == 'Novelty':
            return 'novelty', ['Select more novel patterns', 'Inject innovative techniques']
        elif worst_role == 'Methodology':
            return 'stability', ['Select more stable patterns', 'Add technical depth']
        else:
            return 'domain_distance', ['Select cross-domain patterns', 'Improve narrative']

    def _neutral_review(self) -> Dict:
        """Return neutral review when no anchors available."""
        reviews = []
        for reviewer in self.reviewers:
            reviews.append({
                'reviewer': reviewer['name'],
                'role': reviewer['role'],
                'score': 5.0,
                'feedback': 'No anchors available; defaulted to neutral score.'
            })

        return {
            'pass': False,
            'avg_score': 5.0,
            'reviews': reviews,
            'main_issue': 'no_anchors',
            'suggestions': ['Add anchor papers for calibrated review'],
            'audit': {'anchors': []}
        }
