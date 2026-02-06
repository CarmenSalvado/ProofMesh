from __future__ import annotations

import ast
import asyncio
import os
import re
import sys
import time
from dataclasses import dataclass

MAX_CODE_CHARS = int(os.getenv("PYTHON_EXECUTOR_MAX_CODE_CHARS", "12000"))
MAX_OUTPUT_CHARS = int(os.getenv("PYTHON_EXECUTOR_MAX_OUTPUT_CHARS", "12000"))
DEFAULT_TIMEOUT_SECONDS = float(os.getenv("PYTHON_EXECUTOR_TIMEOUT_SECONDS", "6"))

_ALLOWED_MODULES = {
    "math",
    "statistics",
    "fractions",
    "decimal",
    "itertools",
    "functools",
    "collections",
    "random",
}

_BLOCKED_CALLS = {
    "open",
    "exec",
    "eval",
    "compile",
    "__import__",
    "input",
    "breakpoint",
    "globals",
    "locals",
    "vars",
    "getattr",
    "setattr",
    "delattr",
    "help",
    "exit",
    "quit",
}


@dataclass(slots=True)
class PythonExecutionResult:
    success: bool
    stdout: str
    stderr: str
    error: str | None
    exit_code: int | None
    duration_ms: int
    executed_code: str


class PythonExecutionError(ValueError):
    """Raised when code is unsafe or invalid for execution."""


_CODE_BLOCK_RE = re.compile(r"```(?P<lang>[a-zA-Z0-9_+-]*)\\n(?P<code>[\\s\\S]*?)```", re.MULTILINE)


def extract_python_code(content: str) -> str:
    """Extract python code from markdown fences or fallback to raw content."""
    raw = (content or "").strip()
    if not raw:
        return ""

    blocks = list(_CODE_BLOCK_RE.finditer(raw))
    if blocks:
        for match in blocks:
            lang = (match.group("lang") or "").strip().lower()
            if lang in {"py", "python"}:
                return match.group("code").strip()
        return blocks[0].group("code").strip()

    return raw


def _truncate(text: str) -> str:
    if len(text) <= MAX_OUTPUT_CHARS:
        return text
    return text[:MAX_OUTPUT_CHARS] + "\n... [output truncated]"


def _name_from_call(node: ast.Call) -> str | None:
    func = node.func
    if isinstance(func, ast.Name):
        return func.id
    if isinstance(func, ast.Attribute):
        return func.attr
    return None


def validate_python_code(code: str) -> None:
    """Reject clearly unsafe code before execution."""
    if not code.strip():
        raise PythonExecutionError("No Python code provided")
    if len(code) > MAX_CODE_CHARS:
        raise PythonExecutionError(f"Code is too long (max {MAX_CODE_CHARS} chars)")

    try:
        tree = ast.parse(code)
    except SyntaxError as exc:
        raise PythonExecutionError(f"Syntax error: {exc.msg}") from exc

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                module = alias.name.split(".")[0]
                if module not in _ALLOWED_MODULES:
                    raise PythonExecutionError(
                        f"Import '{module}' is not allowed in computation nodes"
                    )
        elif isinstance(node, ast.ImportFrom):
            module = (node.module or "").split(".")[0]
            if module not in _ALLOWED_MODULES:
                raise PythonExecutionError(
                    f"Import from '{module or 'unknown'}' is not allowed in computation nodes"
                )
            if any(alias.name == "*" for alias in node.names):
                raise PythonExecutionError("Wildcard imports are not allowed")
        elif isinstance(node, ast.Attribute):
            if node.attr.startswith("__"):
                raise PythonExecutionError("Dunder attribute access is not allowed")
        elif isinstance(node, ast.Call):
            call_name = _name_from_call(node)
            if call_name in _BLOCKED_CALLS:
                raise PythonExecutionError(f"Call '{call_name}' is not allowed")


def _build_script(user_code: str, timeout_seconds: float) -> str:
    cpu_limit = max(1, int(timeout_seconds))
    memory_limit_bytes = 512 * 1024 * 1024
    return (
        "try:\n"
        "    import resource\n"
        f"    resource.setrlimit(resource.RLIMIT_CPU, ({cpu_limit}, {cpu_limit + 1}))\n"
        f"    resource.setrlimit(resource.RLIMIT_AS, ({memory_limit_bytes}, {memory_limit_bytes}))\n"
        "except Exception:\n"
        "    pass\n\n"
        + user_code
    )


async def execute_python_code(content: str, timeout_seconds: float | None = None) -> PythonExecutionResult:
    """Run Python code in an isolated subprocess with timeout and safety checks."""
    code = extract_python_code(content)
    validate_python_code(code)

    timeout = timeout_seconds or DEFAULT_TIMEOUT_SECONDS
    timeout = max(0.5, min(float(timeout), 20.0))

    script = _build_script(code, timeout)
    start = time.perf_counter()

    process = await asyncio.create_subprocess_exec(
        sys.executable,
        "-I",
        "-S",
        "-c",
        script,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env={
            "PYTHONUNBUFFERED": "1",
            "PYTHONIOENCODING": "utf-8",
            "PYTHONNOUSERSITE": "1",
        },
    )

    try:
        stdout_b, stderr_b = await asyncio.wait_for(process.communicate(), timeout=timeout)
    except asyncio.TimeoutError:
        process.kill()
        await process.communicate()
        duration_ms = int((time.perf_counter() - start) * 1000)
        return PythonExecutionResult(
            success=False,
            stdout="",
            stderr="",
            error=f"Execution timed out after {timeout:.1f}s",
            exit_code=None,
            duration_ms=duration_ms,
            executed_code=code,
        )

    duration_ms = int((time.perf_counter() - start) * 1000)
    stdout = _truncate(stdout_b.decode("utf-8", errors="replace"))
    stderr = _truncate(stderr_b.decode("utf-8", errors="replace"))
    exit_code = process.returncode
    success = exit_code == 0

    return PythonExecutionResult(
        success=success,
        stdout=stdout,
        stderr=stderr,
        error=None if success else (stderr or f"Python exited with code {exit_code}"),
        exit_code=exit_code,
        duration_ms=duration_ms,
        executed_code=code,
    )
