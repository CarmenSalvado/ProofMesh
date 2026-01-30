"""
Explorer Agent - Proposes local mathematical steps.
Robust against global problems and model content blocking.
Refined for difficult problems with Chain-of-Thought and relaxed validation.
"""

import json
import re
from typing import Optional, List

# Asumimos que estas importaciones existen en tu estructura de proyecto
# Si "base" o "models" fallan, asegúrate de que existen en tu path relativo
from .base import Agent, LoopAgent
from ..models.types import Proposal, ExplorationResult, AgentResponse


# SYSTEM PROMPT MEJORADO: Chain-of-Thought + JSON
EXPLORER_SYSTEM_PROMPT = """You are an expert mathematical exploration agent.

Your goal is to propose ONE solid, logical step forward.
Do NOT try to verify or prove the entire statement instantly.

Guidelines:
1. **Analyze**: first think about difficulty and possible strategies in the "thought" field.
2. **Propose**: generate a distinct mathematical step (lemma, simplification, variable change, or case split).
3. **Local**: the step must be self-contained and valid, but does not need to complete the proof.

Format your response as CLEAN JSON:
{
    "thought": "Brief analysis of the current state and why this step is useful...",
    "proposal": "The proposed mathematical step...",
    "reasoning": "Why this step is valid and useful",
    "score": 0.0 to 1.0 (confidence this is the best next step)
}
"""

# REGEX RELAJADO
GLOBAL_CLOSURE_PATTERNS = [
    r"Q\.E\.D\.",
    r"This completes the proof",
    r"This proves the theorem",
    r"The proof is complete",
    r"We have shown the statement",
    r"^proven$",
]

class ExplorerAgent:
    """
    Explorer agent that proposes LOCAL mathematical steps.
    """

    def __init__(
        self,
        model: str = "gemini-3-flash-preview",
        temperature: float = 0.8,
        max_iterations: int = 5,
        timeout: int = 180,
        max_tokens: int = 16384,  # Increased default
    ):
        self.base_agent = Agent(
            model=model,
            system_prompt=EXPLORER_SYSTEM_PROMPT,
            temperature=temperature,
            timeout=timeout,
            max_tokens=max_tokens,
        )

        self.max_iterations = max_iterations

        def stop_condition(_: AgentResponse, iteration: int) -> bool:
            return iteration + 1 >= self.max_iterations

        self.loop_agent = LoopAgent(
            agent=self.base_agent,
            until=stop_condition,
            max_iters=max_iterations,
        )

    # ---------- VALIDATION ----------

    def _is_local_proposal(self, text: str) -> bool:
        lowered = text.lower().strip()
        if not lowered:
            return False
        for pattern in GLOBAL_CLOSURE_PATTERNS:
            if re.search(pattern, lowered, re.IGNORECASE):
                return False
        return True

    def _parse_json(self, content: str) -> Optional[dict]:
        """
        Attempts to extract JSON even if the model wraps it in text or markdown.
        Handles common LaTeX escaping issues.
        """
        def clean_and_parse(text: str) -> Optional[dict]:
            # Try parsing directly
            try:
                return json.loads(text)
            except json.JSONDecodeError:
                # Try fixing backslashes for LaTeX (e.g., \sum -> \\sum)
                # But be careful not to double escape existing valid escapes
                # Simple heuristic: replace single backslash with double if followed by non-tranditional escape
                # Better approach: use a strict decoding fallback or just try to blindly fix common math command starts
                pass
            return None

        # 1. Try pure content
        res = clean_and_parse(content)
        if res: return res

        # 2. Extract from Markdown code blocks
        json_pattern = r'```(?:json)?\s*(.*?)```'
        matches = re.findall(json_pattern, content, re.DOTALL)
        if matches:
            res = clean_and_parse(matches[0].strip())
            if res: return res
        
        # 3. Manual bracket search (brittle but useful fallback)
        try:
            start_index = content.find('{')
            end_index = content.rfind('}')
            if start_index != -1 and end_index != -1:
                json_str = content[start_index : end_index + 1]
                # Try to sanitize backslashes in the extracted string before parsing
                # Replace single backslash with double, except for known JSON escapes like \n, \t, \", \\
                # This is a bit risky but helps with LaTeX. 
                # actually, 'json5' library would be great here but we might not have it.
                # Let's try to just parse it.
                res = clean_and_parse(json_str) 
                if res: return res
                
                # Last resort: simplistic fix for LaTeX backslashes
                # We assume the model didn't escape them.
                # We replace \ with \\, but then we must revert actual escapes? Hard.
                # Let's just try to be lenient or ask the model to fix.
                # For now, let's just return what we have if clean_and_parse works.
        except Exception:
            pass

        return None

    # ---------- MAIN API ----------

    async def explore(
        self,
        block: str,
        memory: Optional[List[dict]] = None,
        max_iterations: Optional[int] = None,
    ) -> ExplorationResult:

        context = {"block": block}
        memory_str = json.dumps(memory, indent=2) if memory else "No previous steps."
        
        prompt = f"""Current Mathematical Problem/State:
{block}

Previous Known Facts/Steps:
{memory_str}

Task: provide a valid next local step.
Remember to use the "thought" field to plan your strategy before proposing.
IMPORTANT: you are writing JSON. If you use LaTeX, you MUST escape backslashes (e.g., use "\\\\sum" instead of "\\sum").
"""

        responses = await self.loop_agent.run(
            prompt,
            context=context,
            max_iters=max_iterations
        )

        proposals: List[Proposal] = []
        best_score = 0.0

        for i, response in enumerate(responses):
            if not response.success or not response.content:
                proposals.append(self._create_blocked_proposal(i, "Empty or failed response"))
                continue

            data = self._parse_json(response.content)
            
            if not data:
                # Increased debug length to 500 characters to see what went wrong
                proposals.append(self._create_blocked_proposal(i, "JSON Parse Error", raw_content=response.content[:500]))
                continue

            proposal_text = data.get("proposal", "").strip()
            thought_process = data.get("thought", "")
            
            if not proposal_text:
                proposals.append(self._create_blocked_proposal(i, "Empty proposal text"))
                continue

            if not self._is_local_proposal(proposal_text):
                proposals.append(self._create_blocked_proposal(i, "Rejected: Global closure attempt"))
                continue

            try:
                score = float(data.get("score", 0.5))
            except (ValueError, TypeError):
                score = 0.5

            full_reasoning = f"Thought: {thought_process}\nReasoning: {data.get('reasoning', '')}"

            proposal = Proposal(
                id=f"prop-{i}",
                content=proposal_text,
                reasoning=full_reasoning.strip(),
                score=score,
                iteration=i,
                blocked=False,
                block_reason=None,
            )

            proposals.append(proposal)
            best_score = max(best_score, score)

        valid_proposals = [p for p in proposals if p.is_valid()]

        if not valid_proposals:
            return ExplorationResult(
                proposals=proposals,
                total_iterations=len(responses),
                best_score=0.0,
                stopped_reason="all_proposals_rejected",
            )

        valid_proposals.sort(key=lambda x: x.score, reverse=True)

        return ExplorationResult(
            proposals=valid_proposals,
            total_iterations=len(responses),
            best_score=best_score,
            stopped_reason="max_iterations",
        )

    def _create_blocked_proposal(self, iteration: int, reason: str, raw_content: str = None) -> Proposal:
        return Proposal(
            id=f"prop-{iteration}",
            content=None,
            reasoning=f"Blocked: {reason}" + (f" (Raw: {raw_content})" if raw_content else ""),
            score=0.0,
            iteration=iteration,
            blocked=True,
            block_reason=reason,
        )

    def explore_sync(
        self,
        block: str,
        memory: Optional[List[dict]] = None,
    ) -> ExplorationResult:
        import asyncio
        return asyncio.run(self.explore(block, memory))


# ---------- FACTORY & EXPORT ----------

_explorer_instance = None

def get_explorer_agent() -> ExplorerAgent:
    global _explorer_instance
    if _explorer_instance is None:
        _explorer_instance = ExplorerAgent()
    return _explorer_instance

explorer_agent = get_explorer_agent()
