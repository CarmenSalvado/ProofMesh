from __future__ import annotations

import base64
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Response, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.user import User
from app.api.deps import get_current_user, get_current_user_optional, verify_problem_access
from app.schemas.latex import (
    LatexFileListResponse,
    LatexFileResponse,
    LatexFileWrite,
    LatexCompileRequest,
    LatexCompileResponse,
    LatexFileInfo,
    LatexRenameRequest,
    LatexSynctexRequest,
    LatexSynctexResponse,
)
from app.services.storage import (
    list_objects,
    get_object_bytes,
    put_object,
    delete_object,
    head_object,
    copy_object,
    delete_prefix,
)


settings = get_settings()
router = APIRouter(prefix="/api/latex", tags=["latex"])


def normalize_path(path: str | None) -> str:
    if not path:
        return ""
    cleaned = path.strip("/")
    if ".." in cleaned.split("/"):
        raise HTTPException(status_code=400, detail="Invalid path")
    return cleaned


def latex_prefix(problem_id: UUID) -> str:
    return f"latex/{problem_id}"


@router.get("/{problem_id}/files", response_model=LatexFileListResponse)
async def list_files(
    problem_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    await verify_problem_access(problem_id, db, current_user)
    prefix = f"{latex_prefix(problem_id)}/"
    objects = await list_objects(prefix)
    files: list[LatexFileInfo] = []

    for obj in objects:
        key = obj.get("Key") or ""
        if not key or key.endswith("/"):
            continue
        if key.startswith(f"{prefix}.output/"):
            continue
        rel_path = key[len(prefix):]
        files.append(
            LatexFileInfo(
                path=rel_path,
                size=obj.get("Size"),
                last_modified=obj.get("LastModified"),
                content_type=None,
            )
        )

    return LatexFileListResponse(files=files)


@router.get("/{problem_id}/files/{path:path}", response_model=LatexFileResponse)
async def get_file(
    problem_id: UUID,
    path: str,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    await verify_problem_access(problem_id, db, current_user)
    normalized = normalize_path(path)
    if not normalized:
        raise HTTPException(status_code=400, detail="Path required")

    key = f"{latex_prefix(problem_id)}/{normalized}"
    data = await get_object_bytes(key)
    if data is None:
        raise HTTPException(status_code=404, detail="File not found")
    meta = await head_object(key) or {}
    content_type = meta.get("ContentType")

    try:
        text = data.decode("utf-8")
        return LatexFileResponse(
            path=normalized,
            content=text,
            content_type=content_type,
            is_binary=False,
        )
    except UnicodeDecodeError:
        encoded = base64.b64encode(data).decode("ascii")
        return LatexFileResponse(
            path=normalized,
            content_base64=encoded,
            content_type=content_type,
            is_binary=True,
        )


@router.put("/{problem_id}/files/{path:path}", response_model=LatexFileResponse)
async def put_file(
    problem_id: UUID,
    path: str,
    payload: LatexFileWrite,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await verify_problem_access(problem_id, db, current_user, require_owner=True)
    normalized = normalize_path(path)
    if not normalized:
        raise HTTPException(status_code=400, detail="Path required")

    if payload.content is None and payload.content_base64 is None:
        raise HTTPException(status_code=400, detail="content or content_base64 required")

    if payload.content is not None:
        data = payload.content.encode("utf-8")
        is_binary = False
    else:
        try:
            data = base64.b64decode(payload.content_base64 or "", validate=True)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid base64 content") from exc
        is_binary = True

    key = f"{latex_prefix(problem_id)}/{normalized}"
    content_type = payload.content_type
    if content_type is None:
        content_type = "application/octet-stream" if is_binary else "text/plain"
    await put_object(key, data, content_type)

    return LatexFileResponse(
        path=normalized,
        content=None if is_binary else (payload.content or ""),
        content_base64=payload.content_base64 if is_binary else None,
        content_type=content_type,
        is_binary=is_binary,
    )


@router.delete("/{problem_id}/files/{path:path}")
async def delete_file(
    problem_id: UUID,
    path: str,
    recursive: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await verify_problem_access(problem_id, db, current_user, require_owner=True)
    normalized = normalize_path(path)
    if not normalized:
        raise HTTPException(status_code=400, detail="Path required")
    key = f"{latex_prefix(problem_id)}/{normalized}"
    if recursive:
        prefix = f"{latex_prefix(problem_id)}/{normalized}/"
        count = await delete_prefix(prefix)
        if count == 0:
            await delete_object(key)
            count = 1
        return {"status": "deleted", "count": count}
    await delete_object(key)
    return {"status": "deleted", "count": 1}


@router.post("/{problem_id}/rename")
async def rename_path(
    problem_id: UUID,
    payload: LatexRenameRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await verify_problem_access(problem_id, db, current_user, require_owner=True)
    from_path = normalize_path(payload.from_path)
    to_path = normalize_path(payload.to_path)
    if not from_path or not to_path:
        raise HTTPException(status_code=400, detail="Paths required")
    if from_path == to_path:
        return {"status": "unchanged"}
    if to_path.startswith(f"{from_path}/"):
        raise HTTPException(status_code=400, detail="Cannot move a path into itself")

    base_prefix = latex_prefix(problem_id)
    from_key = f"{base_prefix}/{from_path}"
    to_key = f"{base_prefix}/{to_path}"

    file_exists = await head_object(from_key) is not None
    dir_prefix = f"{base_prefix}/{from_path}/"
    objects = await list_objects(dir_prefix)

    if file_exists and not objects:
        await copy_object(from_key, to_key)
        await delete_object(from_key)
        return {"status": "renamed"}

    if objects:
        for obj in objects:
            key = obj.get("Key")
            if not key:
                continue
            suffix = key[len(dir_prefix):]
            dest_key = f"{base_prefix}/{to_path}/{suffix}"
            await copy_object(key, dest_key)
        # Ensure source prefix is removed even if object-by-object deletes are skipped/fail.
        await delete_prefix(dir_prefix)
        if file_exists:
            await delete_object(from_key)
        return {"status": "renamed", "count": len(objects)}

    raise HTTPException(status_code=404, detail="Path not found")


@router.post("/{problem_id}/compile", response_model=LatexCompileResponse)
async def compile_project(
    problem_id: UUID,
    payload: LatexCompileRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await verify_problem_access(problem_id, db, current_user, require_owner=True)
    prefix = latex_prefix(problem_id)
    main = normalize_path(payload.main)
    if not main:
        raise HTTPException(status_code=400, detail="Main file required")

    timeout = settings.latex_compile_timeout + 5
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                f"{settings.latex_compiler_url}/compile",
                json={"prefix": prefix, "main": main, "timeout": settings.latex_compile_timeout},
            )
            if response.status_code >= 400:
                raise HTTPException(status_code=response.status_code, detail=response.text)
            data = response.json()
            return LatexCompileResponse(**data)
    except httpx.RequestError as exc:
        raise HTTPException(status_code=503, detail=f"Compiler unavailable: {exc}") from exc


@router.get("/{problem_id}/output.pdf")
async def get_output_pdf(
    problem_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    await verify_problem_access(problem_id, db, current_user)
    key = f"{latex_prefix(problem_id)}/.output/latest.pdf"
    data = await get_object_bytes(key)
    if data is None:
        raise HTTPException(status_code=404, detail="PDF not found")
    return Response(content=data, media_type="application/pdf")


@router.get("/{problem_id}/output.log")
async def get_output_log(
    problem_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    await verify_problem_access(problem_id, db, current_user)
    key = f"{latex_prefix(problem_id)}/.output/latest.log"
    data = await get_object_bytes(key)
    if data is None:
        raise HTTPException(status_code=404, detail="Log not found")
    return Response(content=data, media_type="text/plain")


@router.post("/{problem_id}/synctex", response_model=LatexSynctexResponse)
async def synctex_map(
    problem_id: UUID,
    payload: LatexSynctexRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    await verify_problem_access(problem_id, db, current_user)
    prefix = latex_prefix(problem_id)
    timeout = settings.latex_compile_timeout + 5

    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            response = await client.post(
                f"{settings.latex_compiler_url}/synctex",
                json={
                    "prefix": prefix,
                    "page": payload.page,
                    "x": payload.x,
                    "y": payload.y,
                },
            )
        except httpx.RequestError as exc:
            raise HTTPException(status_code=502, detail="Compiler service unavailable") from exc

    if response.status_code != 200:
        detail = response.text
        if response.headers.get("content-type", "").startswith("application/json"):
            try:
                detail = response.json().get("detail", detail)
            except ValueError:
                pass
        raise HTTPException(status_code=response.status_code, detail=detail or "Synctex failed")

    data = response.json()
    return LatexSynctexResponse(
        path=data.get("path", ""),
        line=int(data.get("line", 1)),
        column=data.get("column"),
    )
