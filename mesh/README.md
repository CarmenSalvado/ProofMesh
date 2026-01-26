# Mesh - Agent Architecture for Mathematical Formalization

A modular agent architecture for exploring, formalizing, and verifying mathematical proofs using Gemini 3 and Lean 4.

## Architecture

```
backend/
├── orchestrator.py      ← State machine (NOT an agent)
├── adk_runtime.py       ← Agent runtime initialization
├── agents/
│   ├── base.py          ← Agent & LoopAgent classes
│   ├── explorer.py      ← Proposes lemmas (uses Gemini)
│   ├── formalizer.py    ← Math → Lean 4 (uses Gemini)
│   └── critic.py        ← Evaluates proposals (uses Gemini)
├── tools/
│   ├── lean_runner.py   ← Lean 4 executor (deterministic)
│   └── fact_store.py    ← Persistent memory (deterministic)
└── models/
    └── types.py         ← Shared Pydantic types
```

## Key Principle

> **ADK is your runtime, not your backend.**
> Control logic lives in Python. Agents only do thinking.

| Component | Uses ADK/Gemini |
|-----------|-----------------|
| Exploration | ✅ |
| Critique | ✅ |
| Formalization | ✅ |
| Control flow | ❌ |
| Persistence | ❌ |
| Verification | ❌ |

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Set API key
export GEMINI_API_KEY="your-key-here"

# Test import
python -c "from backend import Orchestrator; print('OK')"
```

## Usage

```python
import asyncio
from backend import Orchestrator

async def main():
    orch = Orchestrator()
    
    # Create a block
    block_id = orch.canvas.create(
        "Prove that the sum of two even numbers is even."
    )
    
    # Explore: get proposals
    proposals = await orch.explore(block_id)
    
    # User picks one
    chosen = proposals.proposals[0]
    
    # Formalize to Lean
    formalization = await orch.formalize(chosen.content)
    
    # Verify with Lean 4
    result = await orch.verify(formalization.lean_code)
    
    # Persist if successful
    if result.success:
        fact = orch.persist(result, block_id, chosen.content)
        print(f"Saved fact: {fact.id}")

asyncio.run(main())
```

## Full Pipeline

```python
# One-shot: explore → critique → formalize → verify → persist
fact = await orch.full_pipeline(block_id, auto_select=True)
```

## Testing Individual Components

```bash
# Test Lean runner (requires Lean 4 installed)
python -m backend.tools.lean_runner --test

# Test FactStore
python -m backend.tools.fact_store --test

# Test agents (requires API key)
python -m backend.agents.explorer --test
python -m backend.agents.formalizer --test
python -m backend.agents.critic --test

# Test runtime
python -m backend.adk_runtime --test

# Test orchestrator
python -m backend.orchestrator --test
```

## Requirements

- Python 3.11+
- Gemini API key
- Lean 4 (optional, for verification)
