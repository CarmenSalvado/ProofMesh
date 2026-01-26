"""
Shared types for the agent architecture.
Using Pydantic for validation and serialization.
"""

from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum


class LeanResult(BaseModel):
    """Result from running Lean 4 code."""
    success: bool
    code: str
    log: str = ""
    error: Optional[str] = None
    execution_time_ms: int = 0


class Proposal(BaseModel):
    """A mathematical proposal from the explorer agent."""
    id: str
    content: str
    reasoning: str = ""
    score: float = Field(default=0.0, ge=0.0, le=1.0)
    iteration: int = 0


class Fact(BaseModel):
    """A verified mathematical fact stored in the fact store."""
    id: str
    block_id: str
    statement: str
    lean_code: str
    proof_status: str = "verified"
    created_at: datetime = Field(default_factory=datetime.now)
    metadata: dict = Field(default_factory=dict)


class VerifiedResult(BaseModel):
    """Result of a successful verification."""
    fact: Fact
    lean_result: LeanResult
    formalization_attempts: int = 1


class AgentResponse(BaseModel):
    """Generic response from an agent."""
    success: bool
    content: str
    raw_response: Optional[str] = None
    tokens_used: int = 0
    model: str = ""


class ExplorationResult(BaseModel):
    """Result from the explorer agent."""
    proposals: List[Proposal]
    total_iterations: int
    best_score: float
    stopped_reason: str  # "score_threshold", "max_iterations", "user_interrupt"


class FormalizationResult(BaseModel):
    """Result from the formalizer agent."""
    lean_code: str
    imports: List[str] = Field(default_factory=list)
    axioms_used: List[str] = Field(default_factory=list)
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)


class CriticResult(BaseModel):
    """Result from the critic agent."""
    score: float = Field(ge=0.0, le=1.0)
    feedback: str
    suggestions: List[str] = Field(default_factory=list)
    issues: List[str] = Field(default_factory=list)
    should_retry: bool = False
