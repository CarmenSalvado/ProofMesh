import os
import re
import shutil
import subprocess
import time
import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


PROJECT_DIR = os.getenv("LEAN_PROJECT_DIR", "/workspace/mesh_project")
DEFAULT_TIMEOUT = int(os.getenv("LEAN_TIMEOUT", "60"))
LAKE_JOBS = os.getenv("LAKE_JOBS", "2")
LEANTAR_JOBS = os.getenv("LEANTAR_JOBS", "2")
MATHLIB_CORRUPTION_MARKERS = (
    "could not resolve 'head' to a commit",
    "repository may be corrupt",
)
NO_GOALS_ERROR_MARKER = "error: No goals to be solved"
NO_GOALS_LINE_RE = re.compile(r":(\d+):\d+:\s*error:\s*No goals to be solved", re.IGNORECASE)


class VerifyRequest(BaseModel):
    code: str = Field(..., min_length=1)
    timeout_seconds: int | None = Field(default=None, ge=5, le=300)


class VerifyResponse(BaseModel):
    success: bool
    log: str = ""
    error: str | None = None
    execution_time_ms: int = 0


app = FastAPI(title="ProofMesh Lean Runner", version="0.1.0")


def run_lean(project_path: Path, file_path: Path, timeout: int) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["lake", "env", "lean", str(file_path)],
        cwd=str(project_path),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        timeout=timeout,
    )


def run_command(project_path: Path, cmd: list[str], timeout: int) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        cmd,
        cwd=str(project_path),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        timeout=timeout,
    )


def is_mathlib_corruption(log: str) -> bool:
    lowered = (log or "").lower()
    return all(marker in lowered for marker in MATHLIB_CORRUPTION_MARKERS)


def repair_mathlib(project_path: Path) -> tuple[bool, str]:
    mathlib_path = project_path / ".lake" / "packages" / "mathlib"
    repair_log: list[str] = []
    try:
        if mathlib_path.exists():
            shutil.rmtree(mathlib_path)
            repair_log.append("Removed corrupted .lake/packages/mathlib")
    except Exception as exc:
        repair_log.append(f"Failed to remove mathlib: {exc}")
        return False, "\n".join(repair_log)

    repair_steps = (
        (
            ["lake", "update", "--jobs", LAKE_JOBS],
            ["lake", "update"],
            "lake update",
        ),
        (
            ["lake", "exe", "cache", "get", "--jobs", LEANTAR_JOBS],
            ["lake", "exe", "cache", "get"],
            "lake exe cache get",
        ),
    )
    for cmd, fallback_cmd, label in repair_steps:
        try:
            result = run_command(project_path, cmd, timeout=max(DEFAULT_TIMEOUT, 120))
        except Exception as exc:
            repair_log.append(f"{label} failed to run: {exc}")
            return False, "\n".join(repair_log)

        repair_log.append(f"$ {' '.join(cmd)}")
        repair_log.append((result.stdout or "").strip())
        if result.returncode != 0 and "unknown long opt" in (result.stdout or "").lower():
            try:
                fallback_result = run_command(
                    project_path,
                    fallback_cmd,
                    timeout=max(DEFAULT_TIMEOUT, 120),
                )
            except Exception as exc:
                repair_log.append(f"{label} fallback failed to run: {exc}")
                return False, "\n".join(repair_log)

            repair_log.append(f"[compat] Retrying without --jobs")
            repair_log.append(f"$ {' '.join(fallback_cmd)}")
            repair_log.append((fallback_result.stdout or "").strip())
            result = fallback_result

        if result.returncode != 0:
            repair_log.append(f"{label} exited with code {result.returncode}")
            return False, "\n".join(repair_log)

    return True, "\n".join(repair_log).strip()


def build_no_goals_autofix(code: str, log: str) -> tuple[str | None, str]:
    if NO_GOALS_ERROR_MARKER.lower() not in (log or "").lower():
        return None, ""

    matches = list(NO_GOALS_LINE_RE.finditer(log or ""))
    if not matches:
        return None, "Detected 'No goals to be solved' but couldn't locate line number."

    line_no = int(matches[-1].group(1))
    lines = code.splitlines()
    if line_no < 1 or line_no > len(lines):
        return None, f"Detected invalid line number {line_no} for no-goals auto-fix."

    removed_line = lines[line_no - 1]
    if not removed_line.strip():
        return None, f"Line {line_no} was empty; skipping no-goals auto-fix."

    lines.pop(line_no - 1)
    fixed_code = "\n".join(lines)
    if code.endswith("\n"):
        fixed_code += "\n"

    return fixed_code, f"Removed redundant line {line_no}: {removed_line.strip()}"


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/verify", response_model=VerifyResponse)
def verify(request: VerifyRequest):
    project_path = Path(PROJECT_DIR)
    if not project_path.exists():
        raise HTTPException(status_code=500, detail=f"Project dir not found: {PROJECT_DIR}")

    timeout = request.timeout_seconds or DEFAULT_TIMEOUT
    filename = f"Test_{uuid.uuid4().hex}.lean"
    file_path = project_path / filename
    file_path.write_text(request.code)

    start = time.time()
    try:
        result = run_lean(project_path, file_path, timeout)
        log = result.stdout or ""

        if result.returncode != 0 and is_mathlib_corruption(log):
            repaired, repair_log = repair_mathlib(project_path)
            if repaired:
                retry_result = run_lean(project_path, file_path, timeout)
                retry_log = retry_result.stdout or ""
                combined_log = (
                    f"{log.rstrip()}\n\n[auto-repair] Detected corrupted mathlib repo.\n"
                    f"{repair_log}\n\n[retry]\n{retry_log}"
                ).strip()
                result = retry_result
                log = combined_log
            else:
                log = (
                    f"{log.rstrip()}\n\n[auto-repair] Failed to repair mathlib repo.\n{repair_log}"
                ).strip()

        if result.returncode != 0:
            fixed_code, fix_note = build_no_goals_autofix(request.code, log)
            if fixed_code:
                file_path.write_text(fixed_code)
                retry_result = run_lean(project_path, file_path, timeout)
                retry_log = retry_result.stdout or ""
                log = (
                    f"{log.rstrip()}\n\n[auto-fix] Detected redundant tactic after goals were closed.\n"
                    f"{fix_note}\n\n[retry]\n{retry_log}"
                ).strip()
                result = retry_result
            elif fix_note:
                log = f"{log.rstrip()}\n\n[auto-fix] {fix_note}".strip()

        duration_ms = int((time.time() - start) * 1000)
        if result.returncode == 0:
            return VerifyResponse(
                success=True,
                log=log or "Success (no output)",
                execution_time_ms=duration_ms,
            )
        return VerifyResponse(
            success=False,
            log=log,
            error=log or f"Lean exited with code {result.returncode}",
            execution_time_ms=duration_ms,
        )
    except subprocess.TimeoutExpired as exc:
        log = (exc.stdout or "") + "\nVerification timed out."
        return VerifyResponse(
            success=False,
            log=log.strip(),
            error=f"Timeout after {timeout} seconds",
            execution_time_ms=timeout * 1000,
        )
    except FileNotFoundError:
        return VerifyResponse(
            success=False,
            error="lake not found in PATH",
        )
    except Exception as exc:
        return VerifyResponse(
            success=False,
            error=str(exc),
        )
    finally:
        try:
            file_path.unlink(missing_ok=True)
        except OSError:
            pass
