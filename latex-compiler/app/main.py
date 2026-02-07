import json
import os
import re
import subprocess
import time
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Iterable

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


S3_ENDPOINT = os.getenv("S3_ENDPOINT", "http://minio:9000")
# Use ProofMesh defaults so local (non-docker-compose) runs match backend.
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY", "proofmesh")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY", "proofmesh")
S3_BUCKET = os.getenv("S3_BUCKET", "proofmesh")
S3_REGION = os.getenv("S3_REGION", "us-east-1")
S3_SECURE = os.getenv("S3_SECURE", "false").lower() == "true"
DEFAULT_TIMEOUT = int(os.getenv("LATEX_COMPILE_TIMEOUT", "60"))


def make_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=S3_ENDPOINT,
        aws_access_key_id=S3_ACCESS_KEY,
        aws_secret_access_key=S3_SECRET_KEY,
        region_name=S3_REGION,
        config=Config(s3={"addressing_style": "path"}),
        verify=S3_SECURE,
    )


s3_client = make_s3_client()


def ensure_bucket():
    try:
        s3_client.head_bucket(Bucket=S3_BUCKET)
    except ClientError:
        s3_client.create_bucket(Bucket=S3_BUCKET)


def sanitize_prefix(prefix: str) -> str:
    cleaned = prefix.strip("/")
    if not cleaned:
        raise HTTPException(status_code=400, detail="Prefix required")
    if ".." in cleaned.split("/"):
        raise HTTPException(status_code=400, detail="Invalid prefix")
    return cleaned


def iter_objects(prefix: str) -> Iterable[str]:
    try:
        paginator = s3_client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=S3_BUCKET, Prefix=prefix):
            for item in page.get("Contents", []):
                key = item.get("Key")
                if not key or key.endswith("/"):
                    continue
                yield key
    except ClientError as exc:
        raise HTTPException(status_code=502, detail=f"S3 list error: {exc}") from exc


class CompileRequest(BaseModel):
    prefix: str = Field(..., description="Project prefix in S3 (e.g. latex/<problem_id>)")
    main: str = Field(default="main.tex", description="Main LaTeX file")
    timeout: int | None = Field(default=None, ge=5, le=300)


class CompileResponse(BaseModel):
    status: str
    log: str
    pdf_key: str | None
    log_key: str
    synctex_key: str | None
    meta_key: str
    duration_ms: int


class SynctexRequest(BaseModel):
    prefix: str = Field(..., description="Project prefix in S3 (e.g. latex/<problem_id>)")
    page: int = Field(..., ge=1)
    x: float
    y: float


class SynctexResponse(BaseModel):
    path: str
    line: int
    column: int | None


app = FastAPI(title="ProofMesh TeX Compiler", version="0.1.0")


def parse_synctex_output(output: str) -> tuple[str | None, int | None, int | None]:
    input_path = None
    line_number = None
    column_number = None

    for line in output.splitlines():
        input_match = re.match(r"^\s*Input:\s*(?:(\d+):)?\s*(.+)\s*$", line)
        if input_match:
            input_path = input_match.group(2).strip()
            continue

        line_match = re.match(r"^\s*Line:\s*(-?\d+)\s*$", line)
        if line_match:
            try:
                value = int(line_match.group(1))
                line_number = value if value > 0 else None
            except ValueError:
                line_number = None
            continue

        column_match = re.match(r"^\s*Column:\s*(-?\d+)\s*$", line)
        if column_match:
            try:
                value = int(column_match.group(1))
                column_number = value if value > 0 else None
            except ValueError:
                column_number = None

    return input_path, line_number, column_number


def run_synctex_edit(tmpdir: str, pdf_path: str, page: int, x: float, y: float) -> tuple[str | None, int | None, int | None]:
    # synctex can be picky with fractional coordinates; use rounded points.
    x_coord = int(round(x))
    y_coord = int(round(y))
    cmd = [
        "synctex",
        "edit",
        "-o",
        f"{page}:{x_coord}:{y_coord}:{pdf_path}",
    ]
    result = subprocess.run(
        cmd,
        cwd=tmpdir,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    if result.returncode != 0:
        return None, None, None
    return parse_synctex_output(result.stdout or "")


def resolve_synctex_input_path(tmpdir: str, input_path: str | None) -> str | None:
    if not input_path:
        return None

    raw = input_path.strip()
    if not raw:
        return None

    # SyncTeX often reports compile-time temp roots: /tmp/tmpxxxx/./main.tex
    normalized = raw.replace("\\", "/")
    if "/./" in normalized:
        tail = normalized.split("/./", 1)[1].lstrip("/")
        candidate = os.path.normpath(tail)
        if candidate and not candidate.startswith(".."):
            return candidate

    # If path points inside current tempdir, keep it relative.
    try:
        rel = os.path.relpath(raw, tmpdir)
        if rel and rel != "." and not rel.startswith(".."):
            return rel
    except ValueError:
        pass

    # Fallback: map by basename against files in the extracted project.
    base = os.path.basename(normalized)
    if not base:
        return None
    matches: list[str] = []
    for path in Path(tmpdir).rglob("*"):
        if path.is_file() and path.name == base:
            matches.append(path.relative_to(tmpdir).as_posix())
            if len(matches) > 1:
                break
    if len(matches) == 1:
        return matches[0]
    return base


@app.on_event("startup")
def on_startup():
    ensure_bucket()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/compile", response_model=CompileResponse)
def compile_project(request: CompileRequest):
    prefix = sanitize_prefix(request.prefix)
    main = request.main.strip("/")
    if ".." in main.split("/"):
        raise HTTPException(status_code=400, detail="Invalid main path")

    timeout = request.timeout or DEFAULT_TIMEOUT

    with TemporaryDirectory() as tmpdir:
        prefix_with_slash = f"{prefix}/"
        try:
            keys = list(iter_objects(prefix_with_slash))
        except HTTPException:
            raise
        except ClientError as exc:
            raise HTTPException(status_code=502, detail=f"S3 list error: {exc}") from exc
        if not keys:
            raise HTTPException(status_code=404, detail="No files found for project")

        for key in keys:
            if key.startswith(f"{prefix_with_slash}.output/"):
                continue
            rel = key[len(prefix_with_slash):]
            if not rel or rel.startswith("/"):
                continue
            dest = os.path.join(tmpdir, rel)
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            try:
                s3_client.download_file(S3_BUCKET, key, dest)
            except ClientError as exc:
                raise HTTPException(status_code=502, detail=f"S3 download error for {key}: {exc}") from exc

        main_path = os.path.join(tmpdir, main)
        if not os.path.exists(main_path):
            raise HTTPException(status_code=400, detail=f"Main file not found: {main}")

        main_dir = os.path.dirname(main)
        run_dir = os.path.join(tmpdir, main_dir) if main_dir else tmpdir
        run_main = os.path.basename(main)

        start = time.time()
        cmd = [
            "latexmk",
            "-pdf",
            "-synctex=1",
            "-interaction=nonstopmode",
            "-halt-on-error",
            "-file-line-error",
            run_main,
        ]

        try:
            result = subprocess.run(
                cmd,
                cwd=run_dir,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=timeout,
            )
            log = result.stdout or ""
            status = "success" if result.returncode == 0 else "error"
        except subprocess.TimeoutExpired as exc:
            log = (exc.stdout or "") + "\nCompilation timed out."
            status = "timeout"

        duration_ms = int((time.time() - start) * 1000)

        pdf_key = None
        synctex_key = None
        pdf_path = os.path.join(run_dir, os.path.splitext(run_main)[0] + ".pdf")
        synctex_path = os.path.join(run_dir, os.path.splitext(run_main)[0] + ".synctex.gz")
        if status == "success" and os.path.exists(pdf_path):
            pdf_key = f"{prefix}/.output/latest.pdf"
            s3_client.upload_file(
                pdf_path,
                S3_BUCKET,
                pdf_key,
                ExtraArgs={"ContentType": "application/pdf"},
            )
            if os.path.exists(synctex_path):
                synctex_key = f"{prefix}/.output/latest.synctex.gz"
                s3_client.upload_file(
                    synctex_path,
                    S3_BUCKET,
                    synctex_key,
                    ExtraArgs={"ContentType": "application/gzip"},
                )
        elif status == "success":
            status = "error"
            log += "\nPDF not generated."

        log_key = f"{prefix}/.output/latest.log"
        meta_key = f"{prefix}/.output/latest.json"
        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=log_key,
            Body=log.encode("utf-8"),
            ContentType="text/plain",
        )
        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=meta_key,
            Body=json.dumps(
                {
                    "status": status,
                    "pdf_key": pdf_key,
                    "log_key": log_key,
                    "synctex_key": synctex_key,
                    "duration_ms": duration_ms,
                    "timestamp": int(time.time()),
                }
            ).encode("utf-8"),
            ContentType="application/json",
        )

        return CompileResponse(
            status=status,
            log=log,
            pdf_key=pdf_key,
            log_key=log_key,
            synctex_key=synctex_key,
            meta_key=meta_key,
            duration_ms=duration_ms,
        )


@app.post("/synctex", response_model=SynctexResponse)
def synctex_lookup(request: SynctexRequest):
    prefix = sanitize_prefix(request.prefix)
    pdf_key = f"{prefix}/.output/latest.pdf"
    synctex_key = f"{prefix}/.output/latest.synctex.gz"

    with TemporaryDirectory() as tmpdir:
        pdf_path = os.path.join(tmpdir, "document.pdf")
        synctex_path = os.path.join(tmpdir, "document.synctex.gz")

        try:
            s3_client.download_file(S3_BUCKET, pdf_key, pdf_path)
            s3_client.download_file(S3_BUCKET, synctex_key, synctex_path)
        except ClientError:
            raise HTTPException(status_code=404, detail="Synctex data not available")

        try:
            input_path, line_number, column_number = run_synctex_edit(
                tmpdir=tmpdir,
                pdf_path=pdf_path,
                page=request.page,
                x=request.x,
                y=request.y,
            )
        except FileNotFoundError as exc:
            raise HTTPException(status_code=500, detail="synctex binary not found") from exc

        # Fallback: search nearby points when exact click lands on whitespace/non-mapped PDF objects.
        if not input_path or line_number is None:
            for radius in (8, 16, 24, 36):
                found = False
                for dx, dy in (
                    (-radius, 0), (radius, 0), (0, -radius), (0, radius),
                    (-radius, -radius), (-radius, radius), (radius, -radius), (radius, radius),
                ):
                    candidate = run_synctex_edit(
                        tmpdir=tmpdir,
                        pdf_path=pdf_path,
                        page=request.page,
                        x=request.x + dx,
                        y=request.y + dy,
                    )
                    if candidate[0] and candidate[1] is not None:
                        input_path, line_number, column_number = candidate
                        found = True
                        break
                if found:
                    break

        if not input_path or line_number is None:
            raise HTTPException(status_code=404, detail="Source location not found")
        rel_path = resolve_synctex_input_path(tmpdir, input_path)
        if not rel_path:
            raise HTTPException(status_code=404, detail="Source location not found")
        return SynctexResponse(path=rel_path, line=line_number, column=column_number)
