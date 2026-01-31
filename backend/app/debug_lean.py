
import sys
import os
import asyncio

# Setup dummy API key to bypass agent initialization
os.environ["GEMINI_API_KEY"] = "dummy_key_for_testing"

# In Docker, mesh is mounted at /app/mesh
# We need to add /app/mesh to sys.path so we can import backend.tools.lean_runner
mesh_path = "/app/mesh"
sys.path.insert(0, mesh_path)

try:
    from backend.tools.lean_runner import LeanRunner
except ImportError as e:
    print(f"Failed to import LeanRunner: {e}")
    print(f"sys.path: {sys.path}")
    # Try alternate import if structure is different
    try:
        sys.path.append("/app/mesh/backend")
        from tools.lean_runner import LeanRunner
        print("Imported LeanRunner from tools.lean_runner")
    except ImportError as e2:
        print(f"Failed secondary import: {e2}")
        sys.exit(1)

async def test():
    print(f"Testing with mesh path: {mesh_path}")
    
    # Point to the existing mesh_project
    project_path = os.path.join(mesh_path, "mesh_project")
    print(f"Project path: {project_path}")
    
    # Check if project path exists
    if not os.path.exists(project_path):
        print(f"ERROR: Project path {project_path} does not exist!")
        ls_mesh = os.listdir(mesh_path)
        print(f"Contents of {mesh_path}: {ls_mesh}")
    
    runner = LeanRunner(workspace_dir=project_path, use_project_context=True)
    
    print(f"Lean path: {runner.lean_path}")
    print(f"Lake path: {runner.lake_path}")
    
    version = runner.get_version()
    print(f"Lean version: {version}")

    if not version:
        print("ERROR: Could not get Lean version. Is Lean installed/in PATH?")

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
    if asyncio.iscoroutinefunction(test):
        asyncio.run(test())
    else:
        test()
