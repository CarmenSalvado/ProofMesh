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


# ========== Story Generation Endpoints (Idea2Paper Integration) ==========

@router.post("/generate-story")
async def generate_story_endpoint(
    problem_id: UUID,
    request: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate a structured paper story from user idea.
    Uses Idea2Paper logic integrated with ProofMesh and Gemini 3.

    Request body:
    {
        "user_idea": "Your research idea",
        "pattern_id": "optional-pattern-id",
        "use_fusion": true
    }
    """
    from mesh.backend.orchestrator import Orchestrator
    from app.models.story import Story
    from app.models.activity import Activity, ActivityType

    await verify_problem_access(problem_id, db, current_user)

    user_idea = request.get("user_idea", "")
    pattern_id = request.get("pattern_id")
    use_fusion = request.get("use_fusion", True)
    context = request.get("context")

    if not user_idea:
        raise HTTPException(status_code=400, detail="user_idea is required")

    if context:
        user_idea = f"{user_idea}\n\nContext:\n{context}"

    # Create orchestrator
    orchestrator = Orchestrator()

    # Generate story
    story = await orchestrator.generate_story(
        user_idea=user_idea,
        pattern_id=pattern_id,
        db_session=db,
        use_fusion=use_fusion
    )

    # Check novelty
    novelty_report = await orchestrator.check_novelty(
        story=story,
        db_session=db
    )

    # Review with anchors
    review_result = await orchestrator.review_with_anchors(
        story=story,
        pattern_id=pattern_id,
        db_session=db
    )

    # Save story to database
    story_record = Story(
        user_id=current_user.id,
        problem_id=problem_id,
        user_idea=user_idea,
        pattern_id=pattern_id,
        pattern_name=story.get('pattern_name', ''),
        title=story['title'],
        abstract=story['abstract'],
        problem_framing=story['problem_framing'],
        gap_pattern=story['gap_pattern'],
        solution=story['solution'],
        method_skeleton=story['method_skeleton'],
        innovation_claims=story['innovation_claims'],
        experiments_plan=story['experiments_plan'],
        fused_idea_data=story.get('generation_metadata', {}),
        review_scores=review_result,
        avg_score=review_result['avg_score'],
        passed_review=review_result['pass'],
        novelty_report=novelty_report,
        max_similarity=novelty_report['max_similarity'],
        risk_level=novelty_report['risk_level'],
        generation_metadata=story.get('generation_metadata', {})
    )

    db.add(story_record)
    await db.commit()
    await db.refresh(story_record)

    # Log activity
    db.add(
        Activity(
            user_id=current_user.id,
            type=ActivityType.CREATED_WORKSPACE_FILE,
            target_id=story_record.id,
            extra_data={
                "problem_id": str(problem_id),
                "story_id": str(story_record.id),
                "story_title": story['title'],
                "avg_score": review_result['avg_score']
            }
        )
    )
    await db.commit()

    return {
        "story_id": str(story_record.id),
        "story": story,
        "review": review_result,
        "novelty": novelty_report
    }


@router.post("/fuse-ideas")
async def fuse_ideas_endpoint(
    problem_id: UUID,
    request: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Fuse multiple ideas into a single conceptual innovation.

    Request body:
    {
        "ideas": ["Idea A", "Idea B", ...],
        "context": "optional extra context",
        "pattern_id": "optional-pattern-id"
    }
    """
    from mesh.backend.agents.idea_fusion import IdeaFusionAgent
    from mesh.backend.tools.pattern_store import PatternStore

    await verify_problem_access(problem_id, db, current_user)

    ideas = request.get("ideas") or []
    context = request.get("context", "")
    pattern_id = request.get("pattern_id")

    if not isinstance(ideas, list) or len(ideas) < 2:
        raise HTTPException(status_code=400, detail="At least two ideas are required for fusion")

    idea_block = "\n".join(f"- {idea}" for idea in ideas)
    user_idea = idea_block if not context else f"{idea_block}\n\nContext:\n{context}"

    pattern_store = PatternStore()
    pattern_info = None

    try:
        if pattern_id:
            pattern_info = await pattern_store.get_pattern_by_id(db, pattern_id)

        if not pattern_info:
            patterns = await pattern_store.recall_patterns(session=db, query=user_idea, top_k=5)
            if patterns:
                pattern_info = patterns[0]
                pattern_id = pattern_info.get("pattern_id")
    except Exception:
        pattern_info = None

    if not pattern_info:
        pattern_id = pattern_id or "ad-hoc"
        pattern_info = {
            "pattern_id": pattern_id,
            "name": "Cross-Idea Fusion",
            "summary": {
                "solution_approaches": ideas,
                "story": []
            }
        }

    fusion_agent = IdeaFusionAgent()
    fused = await fusion_agent.fuse(
        user_idea=user_idea,
        pattern_id=pattern_id,
        pattern_info=pattern_info
    )

    fused_title = fused.get("fused_idea_title", "Fused Idea")
    fused_description = fused.get("fused_idea_description", "")
    fused_idea = f"{fused_title}: {fused_description}".strip(": ")

    explanation = fused.get("why_not_straightforward_combination") or fused.get("problem_framing") or ""

    return {
        "fused_idea": fused_idea,
        "source_ideas": ideas,
        "fusion_type": "innovation_fusion",
        "explanation": explanation,
        "pattern_id": pattern_id,
        "pattern_name": pattern_info.get("name", "")
    }


@router.post("/stories/{story_id}/refine")
async def refine_story_endpoint(
    problem_id: UUID,
    story_id: UUID,
    request: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Refine an existing story based on review feedback.

    Request body:
    {
        "review_feedback": {...}
    }
    """
    from mesh.backend.orchestrator import Orchestrator
    from app.models.story import Story

    await verify_problem_access(problem_id, db, current_user)

    # Get existing story
    stmt = select(Story).where(
        Story.id == story_id,
        Story.user_id == current_user.id
    )
    result = await db.execute(stmt)
    story_record = result.scalar_one_or_none()

    if not story_record:
        raise HTTPException(status_code=404, detail="Story not found")

    review_feedback = request.get("review_feedback")

    # Create previous story dict
    previous_story = {
        'title': story_record.title,
        'abstract': story_record.abstract,
        'problem_framing': story_record.problem_framing,
        'gap_pattern': story_record.gap_pattern,
        'solution': story_record.solution,
        'method_skeleton': story_record.method_skeleton,
        'innovation_claims': story_record.innovation_claims,
        'experiments_plan': story_record.experiments_plan
    }

    # Generate refined story
    orchestrator = Orchestrator()
    refined_story = await orchestrator.generate_story(
        user_idea=story_record.user_idea,
        pattern_id=story_record.pattern_id,
        db_session=db,
        previous_story=previous_story,
        review_feedback=review_feedback,
        use_fusion=True
    )

    # Check novelty
    novelty_report = await orchestrator.check_novelty(
        story=refined_story,
        db_session=db,
        exclude_story_id=str(story_id)
    )

    # Review with anchors
    review_result = await orchestrator.review_with_anchors(
        story=refined_story,
        pattern_id=story_record.pattern_id,
        db_session=db
    )

    # Create new version
    new_story_record = Story(
        user_id=current_user.id,
        problem_id=problem_id,
        user_idea=story_record.user_idea,
        pattern_id=story_record.pattern_id,
        pattern_name=refined_story.get('pattern_name', ''),
        title=refined_story['title'],
        abstract=refined_story['abstract'],
        problem_framing=refined_story['problem_framing'],
        gap_pattern=refined_story['gap_pattern'],
        solution=refined_story['solution'],
        method_skeleton=refined_story['method_skeleton'],
        innovation_claims=refined_story['innovation_claims'],
        experiments_plan=refined_story['experiments_plan'],
        fused_idea_data=refined_story.get('generation_metadata', {}),
        review_scores=review_result,
        avg_score=review_result['avg_score'],
        passed_review=review_result['pass'],
        novelty_report=novelty_report,
        max_similarity=novelty_report['max_similarity'],
        risk_level=novelty_report['risk_level'],
        version=story_record.version + 1,
        parent_story_id=story_record.id,
        generation_metadata=refined_story.get('generation_metadata', {})
    )

    db.add(new_story_record)
    await db.commit()
    await db.refresh(new_story_record)

    return {
        "story_id": str(new_story_record.id),
        "story": refined_story,
        "review": review_result,
        "novelty": novelty_report,
        "version": new_story_record.version
    }


@router.get("/stories")
async def list_stories(
    problem_id: UUID,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_optional),
):
    """List stories for a problem."""
    await verify_problem_access(problem_id, db, current_user)

    stmt = select(Story).where(
        Story.problem_id == problem_id
    ).order_by(
        Story.created_at.desc()
    ).offset(offset).limit(limit)

    result = await db.execute(stmt)
    stories = result.scalars().all()

    return {
        "stories": [
            {
                "id": str(s.id),
                "title": s.title,
                "abstract": s.abstract[:200] + "..." if len(s.abstract) > 200 else s.abstract,
                "avg_score": s.avg_score,
                "passed_review": s.passed_review,
                "risk_level": s.risk_level,
                "version": s.version,
                "created_at": s.created_at.isoformat()
            }
            for s in stories
        ],
        "total": len(stories)
    }


@router.get("/stories/{story_id}")
async def get_story(
    problem_id: UUID,
    story_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_optional),
):
    """Get a specific story with all sections."""
    await verify_problem_access(problem_id, db, current_user)

    stmt = select(Story).where(Story.id == story_id)
    result = await db.execute(stmt)
    story = result.scalar_one_or_none()

    if not story:
        raise HTTPException(status_code=404, detail="Story not found")

    return {
        "id": str(story.id),
        "user_idea": story.user_idea,
        "pattern_id": story.pattern_id,
        "pattern_name": story.pattern_name,
        "title": story.title,
        "abstract": story.abstract,
        "problem_framing": story.problem_framing,
        "gap_pattern": story.gap_pattern,
        "solution": story.solution,
        "method_skeleton": story.method_skeleton,
        "innovation_claims": story.innovation_claims,
        "experiments_plan": story.experiments_plan,
        "fused_idea_data": story.fused_idea_data,
        "review_scores": story.review_scores,
        "avg_score": story.avg_score,
        "passed_review": story.passed_review,
        "novelty_report": story.novelty_report,
        "max_similarity": story.max_similarity,
        "risk_level": story.risk_level,
        "version": story.version,
        "parent_story_id": str(story.parent_story_id) if story.parent_story_id else None,
        "generation_metadata": story.generation_metadata,
        "created_at": story.created_at.isoformat(),
        "updated_at": story.updated_at.isoformat()
    }
