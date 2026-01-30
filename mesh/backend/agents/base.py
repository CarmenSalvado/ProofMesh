"""
Base Agent classes with Gemini integration (using google-genai).
These are the building blocks for all agents in the system.
"""

import asyncio
import os
import time
from typing import Optional, Callable, Any, List, Union

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
        model: str = "gemini-3-flash-preview",
        system_prompt: str = "",
        temperature: float = 0.7,
        max_tokens: int = 8192,
        api_key: Optional[str] = None,
        timeout: int = 120,
        retries: int = 2
    ):
        self.model_name = model
        self.system_prompt = system_prompt
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.timeout = timeout
        self.retries = retries
        
        # Configure client
        api_key = api_key or os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY not found. Please set it in environment variables or pass it to the constructor.")
            
        self.client = genai.Client(api_key=api_key)
        
        # Safety settings - disable blocking for mathematical/reasoning content
        self.safety_settings = [
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

    async def run(self, prompt: str, context: Optional[dict] = None) -> AgentResponse:
        """
        Run the agent with a prompt.
        
        Args:
            prompt: The input prompt
            context: Optional context dict to include
            
        Returns:
            AgentResponse with the result
        """
        # Build full prompt with context
        full_prompt = prompt
        if context:
            # Format context nicely
            context_str = "\n".join(f"{k}: {v}" for k, v in context.items())
            full_prompt = f"Context:\n{context_str}\n\n{prompt}"

        # Create config dynamically (allows changing max_tokens on the fly)
        generation_config = types.GenerateContentConfig(
            temperature=self.temperature,
            max_output_tokens=self.max_tokens,
            system_instruction=self.system_prompt if self.system_prompt else None,
            safety_settings=self.safety_settings
        )

        last_exception = None

        # Retry loop for robustness
        for attempt in range(self.retries + 1):
            try:
                response = await asyncio.wait_for(
                    self.client.aio.models.generate_content(
                        model=self.model_name,
                        contents=full_prompt,
                        config=generation_config
                    ),
                    timeout=self.timeout
                )
                
                # Extract content safely
                content = ""
                if response.text:
                    content = response.text
                elif response.candidates and len(response.candidates) > 0:
                    # Fallback for candidates
                    cand = response.candidates[0]
                    if hasattr(cand, 'content') and cand.content.parts:
                        content = cand.content.parts[0].text or ""
                
                if not content:
                    # Check for blocked content
                    if hasattr(response, 'prompt_feedback') and response.prompt_feedback:
                         return AgentResponse(
                            success=False,
                            content=f"Content blocked: {response.prompt_feedback}",
                            model=self.model_name
                        )
                    # If empty but no block, implies an API issue, maybe retry?
                    if attempt < self.retries:
                        continue 
                    return AgentResponse(
                        success=False,
                        content="Empty response from model",
                        model=self.model_name
                    )
                
                # Success
                return AgentResponse(
                    success=True,
                    content=content,
                    raw_response=str(response),
                    tokens_used=response.usage_metadata.total_token_count if hasattr(response, 'usage_metadata') and response.usage_metadata else 0,
                    model=self.model_name
                )
                
            except asyncio.TimeoutError:
                last_exception = f"Timeout after {self.timeout} seconds"
                if attempt < self.retries:
                    await asyncio.sleep(1 * (attempt + 1)) # Backoff linear
                    continue
            except Exception as e:
                last_exception = str(e)
                # Retry on server errors (5xx) or rate limits (429)
                if "429" in str(e) or "503" in str(e) or "500" in str(e):
                    if attempt < self.retries:
                        await asyncio.sleep(2 * (attempt + 1)) # Backoff
                        continue
                # Don't retry on 400 (Bad Request)
                break
        
        # If we exit loop, we failed
        return AgentResponse(
            success=False,
            content=f"Error after {self.retries + 1} attempts: {last_exception}",
            model=self.model_name
        )
    
    def run_sync(self, prompt: str, context: Optional[dict] = None) -> AgentResponse:
        """
        Synchronous version of run().
        Handles existing event loops (Jupyter compatibility).
        """
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            # If we are in a notebook or existing loop, use task creation
            # Note: This technically returns a coroutine if not awaited, 
            # but standard sync usage implies running in a script.
            # To strictly block in a notebook, one needs nest_asyncio.
            import nest_asyncio
            nest_asyncio.apply()
            return loop.run_until_complete(self.run(prompt, context))
        else:
            return asyncio.run(self.run(prompt, context))


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
        self.agent = agent
        self.until = until
        self.max_iters = max_iters
        self.on_iteration = on_iteration
    
    async def run(
        self, 
        initial_prompt: str,
        context: Optional[dict] = None,
        refine_prompt: Optional[Callable[[str, AgentResponse, int], str]] = None,
        max_iters: Optional[int] = None
    ) -> List[AgentResponse]:
        """
        Run the agent in a loop.
        """
        responses = []
        current_prompt = initial_prompt
        limit = max_iters if max_iters is not None else self.max_iters
        
        # Run iterations
        # Use asyncio.gather if parallel exploration is needed later,
        # but for Chain of Thought, serial is usually correct.
        for i in range(limit):
            response = await self.agent.run(current_prompt, context)
            responses.append(response)
            
            if self.on_iteration:
                try:
                    self.on_iteration(response, i)
                except Exception:
                    pass # Don't break loop on callback error
            
            # Check stop condition
            if self.until(response, i):
                break
            
            # Refine prompt for next iteration
            if refine_prompt:
                current_prompt = refine_prompt(current_prompt, response, i)
            else:
                # Default behavior: If no specific refinement logic,
                # we assume the 'context' object holds the state (memory),
                # so we just re-send the initial prompt or update it slightly.
                # Avoid appending history endlessly if not requested.
                pass 
        
        return responses
    
    def run_sync(
        self,
        initial_prompt: str,
        context: Optional[dict] = None,
        refine_prompt: Optional[Callable[[str, AgentResponse, int], str]] = None
    ) -> List[AgentResponse]:
        """Synchronous version of run()."""
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            import nest_asyncio
            nest_asyncio.apply()
            return loop.run_until_complete(self.run(initial_prompt, context, refine_prompt))
        else:
            return asyncio.run(self.run(initial_prompt, context, refine_prompt))
