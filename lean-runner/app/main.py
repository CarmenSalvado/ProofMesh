import os
import subprocess
import time
import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


PROJECT_DIR = os.getenv("LEAN_PROJECT_DIR", "/workspace/mesh_project")
DEFAULT_TIMEOUT = int(os.getenv("LEAN_TIMEOUT", "60"))


class VerifyRequest(BaseModel):
    code: str = Field(..., min_length=1)
    timeout_seconds: int | None = Field(default=None, ge=5, le=300)


class VerifyResponse(BaseModel):
    success: bool
    log: str = ""
    error: str | None = None
    execution_time_ms: int = 0


app = FastAPI(title="ProofMesh Lean Runner", version="0.1.0")


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
        cmd = ["lake", "env", "lean", str(file_path)]
        result = subprocess.run(
            cmd,
            cwd=str(project_path),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            timeout=timeout,
        )
        duration_ms = int((time.time() - start) * 1000)
        log = result.stdout or ""
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
