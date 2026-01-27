"""
Formalizer Agent - Translates mathematical text to Lean 4 code.
"""

import json
import re
from typing import Optional, List

from .base import Agent
from ..models.types import FormalizationResult, AgentResponse


FORMALIZER_SYSTEM_PROMPT = """You are a mathematical formalization agent. Your role is to translate natural mathematical language into valid Lean 4 code.

Guidelines:
1. Output ONLY valid Lean 4 code
2. Minimize axioms - prefer constructive proofs
3. Use standard Mathlib conventions when applicable
4. Include necessary imports
5. Add brief comments for clarity

Format your response as JSON:
{
    "lean_code": "-- The complete Lean 4 code",
    "imports": ["List of required imports"],
    "axioms_used": ["Any axioms required"],
    "confidence": 0.0-1.0,
    "notes": "Any important notes about the formalization"
}

Focus on correctness and minimality. The code must type-check in Lean 4."""


class FormalizerAgent:
    """
    Formalizer agent that translates math to Lean 4.
    """
    
    def __init__(
        self,
        model: str = "gemini-3-pro-preview",
        temperature: float = 0.3,  # Lower for precision
    ):
        self.agent = Agent(
            model=model,
            system_prompt=FORMALIZER_SYSTEM_PROMPT,
            temperature=temperature,
            max_tokens=8192,  # Lean code can be long
            timeout=120  # Increased timeout for complex formalization
        )
    
    async def formalize(
        self,
        text: str,
        hints: Optional[List[str]] = None
    ) -> FormalizationResult:
        """
        Formalize mathematical text to Lean 4.
        
        Args:
            text: The mathematical statement to formalize
            hints: Optional hints or related Lean code
            
        Returns:
            FormalizationResult with Lean code
        """
        prompt = f"""Translate this mathematical text to Lean 4:

{text}
"""
        
        context = None
        if hints:
            context = {"hints": "\n".join(hints)}
        
        response = await self.agent.run(prompt, context)
        
        return self._parse_response(response)
    
    def formalize_sync(
        self,
        text: str,
        hints: Optional[List[str]] = None
    ) -> FormalizationResult:
        """Synchronous version of formalize()."""
        prompt = f"""Translate this mathematical text to Lean 4:

{text}
"""
        
        context = None
        if hints:
            context = {"hints": "\n".join(hints)}
        
        response = self.agent.run_sync(prompt, context)
        return self._parse_response(response)
    
    def _parse_response(self, response: AgentResponse) -> FormalizationResult:
        """Parse the agent response into a FormalizationResult."""
        if not response.success:
            # DEBUG: Print the actual error
            print(f"  [DEBUG] Formalizer failed: {response.content}")
            return FormalizationResult(
                lean_code="", 
                confidence=0.0,
                axioms_used=[]
            )
        
        content = response.content
        
        # Helper to try parsing JSON
        def try_parse(text: str) -> Optional[dict]:
            try:
                return json.loads(text)
            except json.JSONDecodeError:
                return None

        # Helper to extract code from JSON data
        def result_from_data(data: dict) -> FormalizationResult:
            lean_code = data.get("lean_code", "")
            # Clean lean_code if it's wrapped in markdown
            if lean_code.strip().startswith("```"):
                lean_code = self._extract_code(lean_code)
            
            return FormalizationResult(
                lean_code=lean_code,
                imports=data.get("imports", []),
                axioms_used=data.get("axioms_used", []),
                confidence=float(data.get("confidence", 0.5))
            )

        # 1. Try parsing full content as JSON directly
        data = try_parse(content)
        if data:
            return result_from_data(data)

        # 2. Try extracting from Markdown code blocks
        # Look for ```json ... ``` or just ``` ... ``` containing JSON
        json_pattern = r'```(?:json)?\s*(.*?)```'
        matches = re.findall(json_pattern, content, re.DOTALL)
        for match in matches:
            data = try_parse(match.strip())
            if data:
                return result_from_data(data)
        
        # 3. Manual bracket search (fallback)
        try:
            start = content.find('{')
            end = content.rfind('}')
            if start != -1 and end != -1:
                data = try_parse(content[start:end+1])
                if data:
                    return result_from_data(data)
        except:
            pass
            
        # 4. Fallback: Assume the whole response is just code? 
        # Or try to extract code block directly if JSON failed completely
        print("  [DEBUG] Formalizer JSON parse failed, falling back to raw code extraction")
        lean_code = self._extract_code(content)
        return FormalizationResult(
            lean_code=lean_code,
            confidence=0.3
        )
    
    def _extract_code(self, text: str) -> str:
        """Extract Lean code from markdown or plain text."""
        # Try to find code blocks
        code_pattern = r'```(?:lean4?|lean)?\n(.*?)```'
        matches = re.findall(code_pattern, text, re.DOTALL)
        
        if matches:
            return matches[0].strip()
        
        # If no code blocks, return cleaned text
        lines = text.split('\n')
        code_lines = [
            line for line in lines
            if not line.startswith('#') and line.strip()
        ]
        return '\n'.join(code_lines)


# Lazy default agent instance
_formalizer_agent: FormalizerAgent | None = None

def get_formalizer_agent() -> FormalizerAgent:
    """Get or create the default formalizer agent."""
    global _formalizer_agent
    if _formalizer_agent is None:
        _formalizer_agent = FormalizerAgent()
    return _formalizer_agent

# Backward compatibility
formalizer_agent = None  # Use get_formalizer_agent() instead


if __name__ == "__main__":
    import sys
    import asyncio
    
    if "--test" in sys.argv:
        async def test():
            print("Testing Formalizer Agent...")
            print("Note: Requires GEMINI_API_KEY environment variable")
            
            agent = FormalizerAgent()
            result = await agent.formalize(
                "The sum of two even natural numbers is even."
            )
            
            print(f"Confidence: {result.confidence}")
            print(f"Imports: {result.imports}")
            print(f"Axioms: {result.axioms_used}")
            print(f"\nLean code:")
            print(result.lean_code)
        
        asyncio.run(test())
