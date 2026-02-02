
import sys
import os
import asyncio

# Setup dummy API key to bypass agent initialization
os.environ["GEMINI_API_KEY"] = "dummy_key_for_testing"

# Setup path to import from mesh
mesh_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "mesh"))
sys.path.insert(0, mesh_path)

from backend.tools.lean_runner import LeanRunner

async def test():
    print(f"Testing with mesh path: {mesh_path}")
    
    # Point to the existing mesh_project
    project_path = os.path.join(mesh_path, "mesh_project")
    print(f"Project path: {project_path}")
    
    runner = LeanRunner(workspace_dir=project_path, use_project_context=True)
    
    # Test 1: Simple code
    print("\n--- Test 1: Simple Code ---")
    code1 = "def test := 1"
    result1 = runner.run(code1)
    print(f"Success: {result1.success}")
    if not result1.success:
        print(f"Log: {result1.log}")
        print(f"Error: {result1.error}")

    # Test 2: Mathlib code (Simulating user issue)
    print("\n--- Test 2: Mathlib Code ---")
    code2 = """import Mathlib.Data.Nat.Basic
import Mathlib.Tactic

example (a b : ℕ) (h : a = b) : a + a = b + b := by
  rw [h]
"""
    result2 = runner.run(code2)
    print(f"Success: {result2.success}")
    if not result2.success:
        print(f"Log: {result2.log}")
        print(f"Error: {result2.error}")

if __name__ == "__main__":
    test_sync = asyncio.run(test())
