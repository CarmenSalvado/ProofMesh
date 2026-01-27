"""
Lean 4 Runner - Deterministic tool for executing Lean code.
This is NOT an agent. This is infrastructure.
"""

import subprocess
import tempfile
import os
import time
import shutil
from pathlib import Path
from typing import Optional

from ..models.types import LeanResult


class LeanRunner:
    """Handles execution of Lean 4 code."""
    
    def __init__(
        self,
        lean_path: Optional[str] = None,
        lake_path: Optional[str] = None, 
        timeout_seconds: int = 60,
        workspace_dir: Optional[str] = None,
        use_project_context: bool = True
    ):
        # Try to find executables if not provided
        self.lean_path = lean_path or shutil.which("lean") or "lean"
        self.lake_path = lake_path or shutil.which("lake") or "lake"
        
        self.timeout = timeout_seconds
        self.workspace_dir = workspace_dir
        self.use_project_context = use_project_context # If True, uses 'lake env lean'
        
        # If no workspace provided, create temp
        if not self.workspace_dir and not self.use_project_context:
            self.workspace_dir = tempfile.mkdtemp(prefix="lean_")

    def run(self, code: str) -> LeanResult:
        """
        Execute Lean 4 code and return the result.
        """
        start_time = time.time()
        
        # Determine working directory
        cwd = self.workspace_dir
        if not cwd and self.use_project_context:
            # Assume we are in a project root or child
            cwd = os.getcwd()
            
        # Write code to file
        # If using project context, we should write to a file that lake knows about
        # typically Main.lean or a temp file in the project
        
        filename = "Test.lean"
        if self.use_project_context and self.workspace_dir:
             # Ensure we write to the project dir
             file_path = Path(self.workspace_dir) / filename
        elif self.workspace_dir:
             file_path = Path(self.workspace_dir) / filename
        else:
             # Temp file in current dir if no workspace
             file_path = Path(os.getcwd()) / filename

        file_path.write_text(code)

        try:
            # Construct command
            if self.use_project_context:
                cmd = [self.lake_path, "env", "lean", str(file_path)]
            else:
                cmd = [self.lean_path, str(file_path)]

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=self.timeout,
                cwd=self.workspace_dir or os.getcwd()
            )
            
            execution_time = int((time.time() - start_time) * 1000)
            
            # Combine stdout and stderr for full output
            full_output = ""
            if result.stdout:
                full_output += result.stdout
            if result.stderr:
                full_output += "\n" + result.stderr if full_output else result.stderr
            
            if result.returncode == 0:
                return LeanResult(
                    success=True,
                    code=code,
                    log=full_output or "Success (no output)",
                    execution_time_ms=execution_time
                )
            else:
                # For errors, include everything
                error_msg = full_output or f"Lean exited with code {result.returncode}"
                return LeanResult(
                    success=False,
                    code=code,
                    log=result.stdout or "",
                    error=error_msg,
                    execution_time_ms=execution_time
                )
                
        except subprocess.TimeoutExpired:
            return LeanResult(
                success=False,
                code=code,
                error=f"Timeout after {self.timeout} seconds",
                execution_time_ms=self.timeout * 1000
            )
        except FileNotFoundError:
            return LeanResult(
                success=False,
                code=code,
                error=f"Lean not found at path: {self.lean_path}"
            )
        except Exception as e:
            return LeanResult(
                success=False,
                code=code,
                error=str(e)
            )
    
    def check_syntax(self, code: str) -> bool:
        """Quick syntax check without full elaboration."""
        result = self.run(code)
        return result.success
    
    def get_version(self) -> Optional[str]:
        """Get Lean version string."""
        try:
            result = subprocess.run(
                [self.lean_path, "--version"],
                capture_output=True,
                text=True,
                timeout=5
            )
            return result.stdout.strip() if result.returncode == 0 else None
        except:
            return None


# Convenience function matching the spec
def run_lean(code: str) -> dict:
    """
    Simple function interface for running Lean code.
    
    Returns:
        dict with 'success' (bool) and 'log' (str)
    """
    runner = LeanRunner()
    result = runner.run(code)
    return {
        "success": result.success,
        "log": result.error if result.error else result.log
    }


if __name__ == "__main__":
    # Test mode
    import sys
    if "--test" in sys.argv:
        test_code = """
def hello := "world"
#check hello
"""
        print("Testing Lean Runner...")
        result = run_lean(test_code)
        print(f"Success: {result['success']}")
        print(f"Log: {result['log']}")
