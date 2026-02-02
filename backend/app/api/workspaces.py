from __future__ import annotations

import json
from datetime import datetime
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.problem import Problem
from app.models.workspace_file import WorkspaceFile, WorkspaceFileType
from app.models.activity import Activity, ActivityType
from app.models.user import User
from app.api.deps import get_current_user, get_current_user_optional, verify_problem_access
from app.schemas.contents import ContentsCreate, ContentsUpdate

router = APIRouter(prefix="/api/workspaces/{problem_id}/contents", tags=["workspaces"])


def normalize_path(path: str | None) -> str:
    if not path:
        return ""
    return path.strip("/")


def split_name(path: str) -> str:
    if not path:
        return ""
    return path.split("/")[-1]


def parent_path(path: str) -> str:
    if not path:
        return ""
    if "/" not in path:
        return ""
    return path.rsplit("/", 1)[0]


async def ensure_directory(problem_id: UUID, db: AsyncSession, path: str):
    if path == "":
        return
    result = await db.execute(
        select(WorkspaceFile).where(
            WorkspaceFile.problem_id == problem_id,
            WorkspaceFile.path == path,
            WorkspaceFile.type == WorkspaceFileType.DIRECTORY,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        return

    directory = WorkspaceFile(
        problem_id=problem_id,
        path=path,
        parent_path=parent_path(path),
        type=WorkspaceFileType.DIRECTORY,
        content=None,
        format=None,
    )
    db.add(directory)
    await db.flush()


async def ensure_parent_directories(problem_id: UUID, db: AsyncSession, path: str):
    if not path:
        return
    parts = path.split("/")[:-1]
    current = ""
    for part in parts:
        current = f"{current}/{part}" if current else part
        await ensure_directory(problem_id, db, current)


async def get_file(problem_id: UUID, db: AsyncSession, path: str) -> WorkspaceFile | None:
    result = await db.execute(
        select(WorkspaceFile).where(
            WorkspaceFile.problem_id == problem_id,
            WorkspaceFile.path == path,
        )
    )
    return result.scalar_one_or_none()


def serialize_content(file: WorkspaceFile, include_content: bool):
    if not include_content:
        return None
    if file.type == WorkspaceFileType.DIRECTORY:
        return None
    if file.format == "json":
        try:
            return json.loads(file.content or "{}")
        except json.JSONDecodeError:
            return {}
    return file.content or ""


def build_model(file: WorkspaceFile, include_content: bool, writable: bool):
    content = serialize_content(file, include_content)
    fmt = file.format
    if file.type == WorkspaceFileType.NOTEBOOK and not fmt:
        fmt = "json"
    return {
        "name": split_name(file.path),
        "path": file.path,
        "type": "notebook" if file.type == WorkspaceFileType.NOTEBOOK else file.type.value,
        "created": file.created_at,
        "last_modified": file.updated_at,
        "mimetype": file.mimetype,
        "size": len(file.content) if file.content else None,
        "writable": writable,
        "format": fmt,
        "content": content,
    }


async def list_directory(problem_id: UUID, db: AsyncSession, dir_path: str, writable: bool):
    result = await db.execute(
        select(WorkspaceFile).where(
            WorkspaceFile.problem_id == problem_id,
            WorkspaceFile.parent_path == dir_path,
        ).order_by(WorkspaceFile.type.asc(), WorkspaceFile.path.asc())
    )
    items = result.scalars().all()
    return [build_model(item, False, writable) for item in items]


@router.get("")
@router.get("/{path:path}")
async def get_contents(
    problem_id: UUID,
    path: str = "",
    content: int = Query(default=1),
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    problem = await verify_problem_access(problem_id, db, current_user)
    normalized = normalize_path(path)
    writable = current_user is not None and current_user.id == problem.author_id

    if normalized == "":
        children = await list_directory(problem_id, db, "", writable)
        return {
            "name": "",
            "path": "",
            "type": "directory",
            "created": None,
            "last_modified": None,
            "mimetype": None,
            "size": None,
            "writable": writable,
            "format": "json",
            "content": children if content else None,
        }

    file = await get_file(problem_id, db, normalized)
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    if file.type == WorkspaceFileType.DIRECTORY:
        children = await list_directory(problem_id, db, normalized, writable)
        return {
            "name": split_name(file.path),
            "path": file.path,
            "type": "directory",
            "created": file.created_at,
            "last_modified": file.updated_at,
            "mimetype": None,
            "size": None,
            "writable": writable,
            "format": "json",
            "content": children if content else None,
        }

    return build_model(file, content == 1, writable)


@router.put("/{path:path}")
async def put_contents(
    problem_id: UUID,
    path: str,
    data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    problem = await verify_problem_access(problem_id, db, current_user, require_owner=True)
    normalized = normalize_path(path)
    if normalized == "":
        raise HTTPException(status_code=400, detail="Path required")

    await ensure_parent_directories(problem_id, db, normalized)

    file = await get_file(problem_id, db, normalized)
    payload_type = data.get("type")
    content = data.get("content")
    fmt = data.get("format")

    if payload_type == "directory":
        if file:
            file.type = WorkspaceFileType.DIRECTORY
        else:
            file = WorkspaceFile(
                problem_id=problem_id,
                path=normalized,
                parent_path=parent_path(normalized),
                type=WorkspaceFileType.DIRECTORY,
            )
            db.add(file)
        await db.commit()
        await db.refresh(file)
        return build_model(file, False, True)

    if payload_type not in {"file", "notebook"}:
        raise HTTPException(status_code=400, detail="Unsupported type")

    file_type = WorkspaceFileType.NOTEBOOK if payload_type == "notebook" else WorkspaceFileType.FILE
    if file_type == WorkspaceFileType.NOTEBOOK and not fmt:
        fmt = "json"
    if fmt == "json" and content is not None and not isinstance(content, str):
        content = json.dumps(content)

    is_new = file is None
    if file:
        file.type = file_type
        file.content = content or ""
        file.format = fmt or ("json" if file_type == WorkspaceFileType.NOTEBOOK else "text")
    else:
        file = WorkspaceFile(
            problem_id=problem_id,
            path=normalized,
            parent_path=parent_path(normalized),
            type=file_type,
            content=content or "",
            format=fmt or ("json" if file_type == WorkspaceFileType.NOTEBOOK else "text"),
        )
        db.add(file)

    if is_new and file_type != WorkspaceFileType.DIRECTORY:
        await db.flush()
        db.add(
            Activity(
                user_id=current_user.id,
                type=ActivityType.CREATED_WORKSPACE_FILE,
                target_id=file.id,
                extra_data={
                    "problem_id": str(problem_id),
                    "problem_title": problem.title,
                    "file_path": file.path,
                },
            )
        )

    await db.commit()
    await db.refresh(file)
    return build_model(file, True, True)


@router.post("")
@router.post("/{path:path}")
async def post_contents(
    problem_id: UUID,
    path: str = "",
    data: ContentsCreate | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await verify_problem_access(problem_id, db, current_user, require_owner=True)
    normalized = normalize_path(path)

    payload = data or ContentsCreate(type="file")
    target_type = payload.type
    if target_type not in {"file", "notebook", "directory"}:
        raise HTTPException(status_code=400, detail="Unsupported type")

    await ensure_parent_directories(problem_id, db, normalized)

    base_name = "Untitled" if target_type != "directory" else "Untitled Folder"
    ext = payload.ext or (".ipynb" if target_type == "notebook" else "")
    counter = 0

    while True:
        suffix = "" if counter == 0 else str(counter)
        name = f"{base_name}{suffix}{ext}"
        candidate = f"{normalized}/{name}" if normalized else name
        exists = await get_file(problem_id, db, candidate)
        if not exists:
            break
        counter += 1

    file_type = (
        WorkspaceFileType.DIRECTORY
        if target_type == "directory"
        else WorkspaceFileType.NOTEBOOK
        if target_type == "notebook"
        else WorkspaceFileType.FILE
    )

    if file_type == WorkspaceFileType.NOTEBOOK:
        default_content = json.dumps(
            {
                "cells": [],
                "metadata": {},
                "nbformat": 4,
                "nbformat_minor": 5,
            }
        )
        default_format = "json"
    elif file_type == WorkspaceFileType.DIRECTORY:
        default_content = None
        default_format = None
    else:
        default_content = ""
        default_format = "text"

    file = WorkspaceFile(
        problem_id=problem_id,
        path=candidate,
        parent_path=parent_path(candidate),
        type=file_type,
        content=default_content,
        format=default_format,
    )
    db.add(file)
    await db.commit()
    await db.refresh(file)
    return build_model(file, True, True)


@router.patch("/{path:path}")
async def patch_contents(
    problem_id: UUID,
    path: str,
    data: ContentsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await verify_problem_access(problem_id, db, current_user, require_owner=True)
    normalized = normalize_path(path)
    file = await get_file(problem_id, db, normalized)
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    if data.path:
        new_path = normalize_path(data.path)
        if new_path == "":
            raise HTTPException(status_code=400, detail="Invalid path")
        await ensure_parent_directories(problem_id, db, new_path)

        if file.type == WorkspaceFileType.DIRECTORY:
            # update all descendants
            result = await db.execute(
                select(WorkspaceFile).where(
                    WorkspaceFile.problem_id == problem_id,
                    WorkspaceFile.path.like(f"{normalized}/%"),
                )
            )
            descendants = result.scalars().all()
            for desc in descendants:
                suffix = desc.path[len(normalized) + 1 :]
                desc.path = f"{new_path}/{suffix}"
                desc.parent_path = parent_path(desc.path)

        file.path = new_path
        file.parent_path = parent_path(new_path)

    if data.format is not None:
        file.format = data.format
    if data.content is not None:
        content = data.content
        if data.format == "json" and not isinstance(content, str):
            content = json.dumps(content)
        file.content = content

    await db.commit()
    await db.refresh(file)
    return build_model(file, True, True)


@router.delete("/{path:path}")
async def delete_contents(
    problem_id: UUID,
    path: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await verify_problem_access(problem_id, db, current_user, require_owner=True)
    normalized = normalize_path(path)
    file = await get_file(problem_id, db, normalized)
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    if file.type == WorkspaceFileType.DIRECTORY:
        await db.execute(
            delete(WorkspaceFile).where(
                WorkspaceFile.problem_id == problem_id,
                WorkspaceFile.path.like(f"{normalized}/%"),
            )
        )

    await db.delete(file)
    await db.commit()
    return {"status": "deleted"}
