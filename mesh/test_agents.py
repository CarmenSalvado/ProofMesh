#!/usr/bin/env python3
"""
Test script for the agent architecture.
Run with: python3 test_agents.py
"""

import asyncio
import os
import sys

# Ensure we have API key
if not os.environ.get("GEMINI_API_KEY"):
    print("❌ Error: Set GEMINI_API_KEY environment variable first")
    print("   export GEMINI_API_KEY='your-key-here'")
    sys.exit(1)

from backend import Orchestrator, Runtime
from backend.agents import ExplorerAgent, FormalizerAgent, CriticAgent


# async def test_explorer():
#     """Test the explorer agent."""
#     print("\n" + "="*50)
#     print("🔍 Testing Explorer Agent")
#     print("="*50)

#     agent = ExplorerAgent(max_iterations=1)
#     result = await agent.explore(
#         "Prove that for any prime p, there exists a positive integer n such that 1^n + 2^(n-1) + 3^(n-2) + ... + n^1 ≡ 2020 (mod p)."
#     )

#     print(f"✓ Total iterations: {result.total_iterations}")
#     print(f"✓ Best score: {result.best_score}")
#     print(f"✓ Stopped reason: {result.stopped_reason}")
#     print(f"✓ Proposals generated: {len(result.proposals)}")

#     for i, p in enumerate(result.proposals):
#         print(f"\n{'─'*60}")
#         print(f"  PROPOSAL {i+1}")
#         print(f"{'─'*60}")
#         print(f"  ID: {p.id}")
#         print(f"  Score: {p.score}")
#         print(f"  Iteration: {p.iteration}")
#         print(f"\n  REASONING:")
#         print(f"  {p.reasoning}")
#         print(f"\n  CONTENT:")
#         print(f"  {p.content}")
#         print(f"{'─'*60}")

#     return result


# async def test_formalizer():
#     """Test the formalizer agent."""
#     print("\n" + "="*50)
#     print("📝 Testing Formalizer Agent")
#     print("="*50)

#     agent = FormalizerAgent()
#     result = await agent.formalize(
#         "Lemma: If n is even and m is even, then n + m is even."
#     )

#     print(f"✓ Confidence: {result.confidence}")
#     print(f"✓ Imports: {result.imports}")
#     print(f"✓ Axioms used: {result.axioms_used}")
#     print(f"\n{'─'*60}")
#     print("LEAN CODE (FULL):")
#     print(f"{'─'*60}")
#     print(result.lean_code)
#     print(f"{'─'*60}")

#     return result


# async def test_critic():
#     """Test the critic agent."""
#     print("\n" + "="*50)
#     print("🎯 Testing Critic Agent")
#     print("="*50)

#     agent = CriticAgent()
#     result = await agent.critique(
#         "Lemma: If n is even and m is even, then n + m is even.",
#         goal="Prove properties of even numbers"
#     )

#     print(f"✓ Score: {result.score}")
#     print(f"✓ Should retry: {result.should_retry}")
#     print(f"✓ Issues: {result.issues}")
#     print(f"✓ Suggestions: {result.suggestions}")
#     print(f"\n{'─'*60}")
#     print("FEEDBACK (FULL):")
#     print(f"{'─'*60}")
#     print(result.feedback)
#     print(f"{'─'*60}")

#     return result


async def test_orchestrator():
    """Test the full orchestrator flow."""
    print("\n" + "="*50)
    print("🎭 Testing Orchestrator (Full Pipeline)")
    print("="*50)

    orch = Orchestrator()

    block_id = orch.canvas.create(
        "Prove that for any prime p, there exists a positive integer n such that 1^n + 2^(n-1) + 3^(n-2) + ... + n^1 ≡ 2020 (mod p)."
    )

    print(f"✓ Created block: {block_id}")

    print("\n  Running exploration...")
    exploration = await orch.explore(block_id, max_iterations=3)
    print(f"  ✓ Got {len(exploration.proposals)} proposals")

    if exploration.proposals:
        best = exploration.proposals[0]
        print(f"\n{'─'*60}")
        print("BEST PROPOSAL (FULL):")
        print(f"{'─'*60}")
        print(best.content)
        print(f"{'─'*60}")
        
        print("\n  Formalizing...")
        formalization = await orch.formalize(best.content)
        print(f"  ✓ Confidence: {formalization.confidence}")
        print(f"\n{'─'*60}")
        print("LEAN CODE (FULL):")
        print(f"{'─'*60}")
        print(formalization.lean_code)
        print(f"{'─'*60}")
        
        print("\n  Verifying with Lean...")
        verification = await orch.verify(formalization.lean_code)
        
        if verification.success:
            print("  ✓ Lean verification PASSED!")
            fact = orch.persist(verification, block_id, best.content)
            print(f"  ✓ Saved fact: {fact.id}")
        else:
            print(f"\n{'─'*60}")
            print("LEAN ERROR (FULL):")
            print(f"{'─'*60}")
            print(verification.error if verification.error else "No error message")
            print(f"{'─'*60}")
            print("    (This is expected if Lean 4 is not installed)")

    return orch


# async def test_runtime():
#     """Test the runtime directly."""
#     print("\n" + "="*50)
#     print("⚡ Testing Runtime")
#     print("="*50)
    
#     runtime = Runtime()
#     print(f"✓ Available agents: {runtime.available_agents}")
    
#     result = await runtime.run("formalizer", {
#         "text": "1 + 1 = 2"
#     })
#     print(f"✓ Formalizer via runtime: confidence = {result.confidence}")
#     print(f"  lean_code: '{result.lean_code[:100]}...'" if result.lean_code else "  lean_code: (empty)")
#     print(f"  axioms_used: {result.axioms_used}")
    
    # return runtime


async def main():
    print("\n" + "#"*50)
    print("# Agent Architecture Test Suite")
    print("# Model: gemini-3-pro-preview")
    print("#"*50)
    
    tests = [
        #("Explorer", test_explorer)
        # ("Formalizer", test_formalizer),
        # ("Critic", test_critic),
        # ("Runtime", test_runtime),
        ("Orchestrator", test_orchestrator),
    ]
    
    if len(sys.argv) > 1:
        test_name = sys.argv[1].lower()
        tests = [(n, f) for n, f in tests if test_name in n.lower()]
        if not tests:
            print(f"❌ Unknown test: {sys.argv[1]}")
            print(f"   Available: explorer, formalizer, critic, runtime, orchestrator")
            sys.exit(1)
    
    for name, test_fn in tests:
        try:
            await test_fn()
            print(f"\n✅ {name} test PASSED")
        except Exception as e:
            print(f"\n❌ {name} test FAILED: {e}")
            import traceback
            traceback.print_exc()
    
    print("\n" + "#"*50)
    print("# Tests complete!")
    print("#"*50 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
