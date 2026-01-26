"""
Base Agent classes with Gemini integration (using google-genai).
These are the building blocks for all agents in the system.
"""

import os
from typing import Optional, Callable, Any
from abc import ABC, abstractmethod

from google import genai
from google.genai import types

from ..models.types import AgentResponse


class Agent:
    """
    Base agent class using Gemini.
    
    This wraps the Gemini API and provides a consistent interface
    for all agents in the system.
    """
    
    def __init__(
        self,
        model: str = "gemini-3-pro-preview",
        system_prompt: str = "",
        temperature: float = 0.7,
        max_tokens: int = 4096,
        api_key: Optional[str] = None
    ):
        self.model_name = model
        self.system_prompt = system_prompt
        self.temperature = temperature
        self.max_tokens = max_tokens
        
        # Configure client
        api_key = api_key or os.environ.get("GEMINI_API_KEY")
        self.client = genai.Client(api_key=api_key)
        
        # Safety settings - disable blocking for mathematical content
        safety_settings = [
            types.SafetySetting(
                category=types.HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold=types.HarmBlockThreshold.BLOCK_NONE
            ),
            types.SafetySetting(
                category=types.HarmCategory.HARM_CATEGORY_HATE_SPEECH, 
                threshold=types.HarmBlockThreshold.BLOCK_NONE
            ),
            types.SafetySetting(
                category=types.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold=types.HarmBlockThreshold.BLOCK_NONE
            ),
            types.SafetySetting(
                category=types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold=types.HarmBlockThreshold.BLOCK_NONE
            ),
        ]
        
        # Generation config
        self.generation_config = types.GenerateContentConfig(
            temperature=self.temperature,
            max_output_tokens=self.max_tokens,
            system_instruction=self.system_prompt if self.system_prompt else None,
            safety_settings=safety_settings
        )
    
    async def run(self, prompt: str, context: Optional[dict] = None) -> AgentResponse:
        """
        Run the agent with a prompt.
        
        Args:
            prompt: The input prompt
            context: Optional context dict to include
            
        Returns:
            AgentResponse with the result
        """
        try:
            # Build full prompt with context
            full_prompt = prompt
            if context:
                context_str = "\n".join(f"{k}: {v}" for k, v in context.items())
                full_prompt = f"Context:\n{context_str}\n\n{prompt}"
            
            # Generate response
            response = await self.client.aio.models.generate_content(
                model=self.model_name,
                contents=full_prompt,
                config=self.generation_config
            )
            
            # Handle None or empty response
            content = response.text if response.text else ""
            if not content:
                # Try to get content from candidates
                if response.candidates and len(response.candidates) > 0:
                    candidate = response.candidates[0]
                    if hasattr(candidate, 'content') and candidate.content:
                        if hasattr(candidate.content, 'parts') and candidate.content.parts:
                            content = candidate.content.parts[0].text or ""
                
                if not content:
                    # Check for blocked content
                    if hasattr(response, 'prompt_feedback'):
                        return AgentResponse(
                            success=False,
                            content=f"Content blocked: {response.prompt_feedback}",
                            model=self.model_name
                        )
                    return AgentResponse(
                        success=False,
                        content="Empty response from model",
                        model=self.model_name
                    )
            
            return AgentResponse(
                success=True,
                content=content,
                raw_response=str(response),
                tokens_used=response.usage_metadata.total_token_count if hasattr(response, 'usage_metadata') and response.usage_metadata else 0,
                model=self.model_name
            )
            
        except Exception as e:
            return AgentResponse(
                success=False,
                content=f"Error: {str(e)}",
                model=self.model_name
            )
    
    def run_sync(self, prompt: str, context: Optional[dict] = None) -> AgentResponse:
        """Synchronous version of run()."""
        try:
            full_prompt = prompt
            if context:
                context_str = "\n".join(f"{k}: {v}" for k, v in context.items())
                full_prompt = f"Context:\n{context_str}\n\n{prompt}"
            
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=full_prompt,
                config=self.generation_config
            )
            
            # Handle None or empty response
            content = response.text if response.text else ""
            if not content:
                # Try to get content from candidates
                if response.candidates and len(response.candidates) > 0:
                    candidate = response.candidates[0]
                    if hasattr(candidate, 'content') and candidate.content:
                        if hasattr(candidate.content, 'parts') and candidate.content.parts:
                            content = candidate.content.parts[0].text or ""
                
                if not content:
                    # Detailed debug for blocked content
                    debug_info = []
                    if hasattr(response, 'prompt_feedback'):
                        debug_info.append(f"Prompt Feedback: {response.prompt_feedback}")
                    if hasattr(response, 'candidates'):
                        for i, cand in enumerate(response.candidates):
                            debug_info.append(f"Candidate {i} Finish Reason: {cand.finish_reason}")
                            if hasattr(cand, 'safety_ratings'):
                                debug_info.append(f"Candidate {i} Safety: {cand.safety_ratings}")
                    
                    debug_str = "\n".join(debug_info)
                    return AgentResponse(
                        success=False,
                        content=f"Content blocked/empty. Debug info:\n{debug_str}",
                        model=self.model_name
                    )
            
            return AgentResponse(
                success=True,
                content=content,
                raw_response=str(response),
                tokens_used=response.usage_metadata.total_token_count if hasattr(response, 'usage_metadata') and response.usage_metadata else 0,
                model=self.model_name
            )
            
        except Exception as e:
            return AgentResponse(
                success=False,
                content=f"Error: {str(e)}",
                model=self.model_name
            )


class LoopAgent:
    """
    Agent that runs in a loop until a condition is met.
    Perfect for exploration tasks that need multiple iterations.
    """
    
    def __init__(
        self,
        agent: Agent,
        until: Callable[[AgentResponse, int], bool],
        max_iters: int = 5,
        on_iteration: Optional[Callable[[AgentResponse, int], None]] = None
    ):
        """
        Args:
            agent: The base agent to run
            until: Function that returns True when loop should stop
                   Takes (response, iteration_number) as args
            max_iters: Maximum number of iterations
            on_iteration: Optional callback after each iteration
        """
        self.agent = agent
        self.until = until
        self.max_iters = max_iters
        self.on_iteration = on_iteration
    
    async def run(
        self, 
        initial_prompt: str,
        context: Optional[dict] = None,
        refine_prompt: Optional[Callable[[str, AgentResponse, int], str]] = None
    ) -> list[AgentResponse]:
        """
        Run the agent in a loop.
        
        Args:
            initial_prompt: Starting prompt
            context: Optional context
            refine_prompt: Optional function to modify prompt between iterations
            
        Returns:
            List of all responses from each iteration
        """
        responses = []
        current_prompt = initial_prompt
        
        for i in range(self.max_iters):
            response = await self.agent.run(current_prompt, context)
            responses.append(response)
            
            if self.on_iteration:
                self.on_iteration(response, i)
            
            # Check stop condition
            if self.until(response, i):
                break
            
            # Refine prompt for next iteration
            if refine_prompt:
                current_prompt = refine_prompt(current_prompt, response, i)
            else:
                # Default: append previous response as context
                current_prompt = f"{initial_prompt}\n\nPrevious attempt:\n{response.content}\n\nPlease improve upon this."
        
        return responses
    
    def run_sync(
        self,
        initial_prompt: str,
        context: Optional[dict] = None,
        refine_prompt: Optional[Callable[[str, AgentResponse, int], str]] = None
    ) -> list[AgentResponse]:
        """Synchronous version of run()."""
        responses = []
        current_prompt = initial_prompt
        
        for i in range(self.max_iters):
            response = self.agent.run_sync(current_prompt, context)
            responses.append(response)
            
            if self.on_iteration:
                self.on_iteration(response, i)
            
            if self.until(response, i):
                break
            
            if refine_prompt:
                current_prompt = refine_prompt(current_prompt, response, i)
            else:
                current_prompt = f"{initial_prompt}\n\nPrevious attempt:\n{response.content}\n\nPlease improve upon this."
        
        return responses


def score_threshold(threshold: float = 0.7) -> Callable[[AgentResponse, int], bool]:
    """
    Create a stop condition based on score threshold.
    Expects response content to contain a score as last line.
    """
    def check(response: AgentResponse, iteration: int) -> bool:
        try:
            # Try to extract score from response
            lines = response.content.strip().split('\n')
            for line in reversed(lines):
                if 'score' in line.lower():
                    # Extract number from line
                    import re
                    numbers = re.findall(r'[\d.]+', line)
                    if numbers:
                        score = float(numbers[-1])
                        return score >= threshold
        except:
            pass
        return False
    return check
