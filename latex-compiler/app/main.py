import json
import os
import subprocess
import time
from tempfile import TemporaryDirectory
from typing import Iterable

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


S3_ENDPOINT = os.getenv("S3_ENDPOINT", "http://minio:9000")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY", "minioadmin")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY", "minioadmin")
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
    paginator = s3_client.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=S3_BUCKET, Prefix=prefix):
        for item in page.get("Contents", []):
            key = item.get("Key")
            if not key or key.endswith("/"):
                continue
            yield key


class CompileRequest(BaseModel):
    prefix: str = Field(..., description="Project prefix in S3 (e.g. latex/<problem_id>)")
    main: str = Field(default="main.tex", description="Main LaTeX file")
    timeout: int | None = Field(default=None, ge=5, le=300)


class CompileResponse(BaseModel):
    status: str
    log: str
    pdf_key: str | None
    log_key: str
    meta_key: str
    duration_ms: int


app = FastAPI(title="ProofMesh TeX Compiler", version="0.1.0")


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
        keys = list(iter_objects(prefix_with_slash))
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
            s3_client.download_file(S3_BUCKET, key, dest)

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
                timeout=timeout,
            )
            log = result.stdout or ""
            status = "success" if result.returncode == 0 else "error"
        except subprocess.TimeoutExpired as exc:
            log = (exc.stdout or "") + "\nCompilation timed out."
            status = "timeout"

        duration_ms = int((time.time() - start) * 1000)

        pdf_key = None
        pdf_path = os.path.join(run_dir, os.path.splitext(run_main)[0] + ".pdf")
        if status == "success" and os.path.exists(pdf_path):
            pdf_key = f"{prefix}/.output/latest.pdf"
            s3_client.upload_file(
                pdf_path,
                S3_BUCKET,
                pdf_key,
                ExtraArgs={"ContentType": "application/pdf"},
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
            meta_key=meta_key,
            duration_ms=duration_ms,
        )
