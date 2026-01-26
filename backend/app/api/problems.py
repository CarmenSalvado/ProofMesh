from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, inspect
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.problem import Problem, ProblemVisibility, ProblemDifficulty
from app.models.activity import Activity, ActivityType
from app.models.workspace_file import WorkspaceFile, WorkspaceFileType
from app.models.user import User
from app.api.deps import get_current_user, get_current_user_optional
from app.schemas.problem import (
    ProblemCreate,
    ProblemUpdate,
    ProblemResponse,
    ProblemListResponse,
    AuthorInfo,
)

router = APIRouter(prefix="/api/problems", tags=["problems"])

def build_workspace_markdown(title: str, description: str | None = None) -> str:
    summary = (description or "").strip()
    summary_block = summary if summary else "Describe the problem and its goals here."
    return f"""# {title}

{summary_block}

## Workspace
- Objectives
- Known results
- Open questions

## Notes
"""


def problem_to_response(problem: Problem) -> ProblemResponse:
    """Convert Problem model to response with counts"""
    state = inspect(problem)
    library_count = 0
    if "library_items" not in state.unloaded:
        library_count = len(problem.library_items)
    return ProblemResponse(
        id=problem.id,
        title=problem.title,
        description=problem.description,
        visibility=problem.visibility,
        difficulty=problem.difficulty,
        tags=problem.tags or [],
        created_at=problem.created_at,
        updated_at=problem.updated_at,
        author=AuthorInfo(
            id=problem.author.id,
            username=problem.author.username,
            avatar_url=problem.author.avatar_url,
        ),
        library_item_count=library_count,
    )


@router.get("", response_model=ProblemListResponse)
async def list_problems(
    visibility: ProblemVisibility | None = None,
    mine: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """List problems - public ones or user's own"""
    query = select(Problem).options(
        selectinload(Problem.author),
        selectinload(Problem.library_items),
    )
    
    if mine and current_user:
        query = query.where(Problem.author_id == current_user.id)
    elif visibility:
        query = query.where(Problem.visibility == visibility)
    else:
        # By default, show public or own problems
        if current_user:
            query = query.where(
                (Problem.visibility == ProblemVisibility.PUBLIC) | 
                (Problem.author_id == current_user.id)
            )
        else:
            query = query.where(Problem.visibility == ProblemVisibility.PUBLIC)
    
    query = query.order_by(Problem.updated_at.desc())
    result = await db.execute(query)
    problems = result.scalars().all()
    
    return ProblemListResponse(
        problems=[problem_to_response(p) for p in problems],
        total=len(problems)
    )


@router.post("", response_model=ProblemResponse, status_code=201)
async def create_problem(
    data: ProblemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new problem"""
    problem = Problem(
        title=data.title,
        description=data.description,
        author_id=current_user.id,
        visibility=data.visibility,
        difficulty=data.difficulty,
        tags=data.tags or [],
    )
    db.add(problem)
    await db.flush()

    workspace_doc = WorkspaceFile(
        problem_id=problem.id,
        path="workspace.md",
        parent_path="",
        type=WorkspaceFileType.FILE,
        content=build_workspace_markdown(problem.title, problem.description),
        format="markdown",
        mimetype="text/markdown",
    )
    db.add(workspace_doc)
    db.add(
        Activity(
            user_id=current_user.id,
            type=ActivityType.CREATED_PROBLEM,
            target_id=problem.id,
            extra_data={"problem_id": str(problem.id), "problem_title": problem.title},
        )
    )
    await db.commit()
    
    # Reload with relationships
    result = await db.execute(
        select(Problem)
        .options(selectinload(Problem.author))
        .where(Problem.id == problem.id)
    )
    problem = result.scalar_one()
    
    return problem_to_response(problem)


@router.post("/seed", response_model=ProblemListResponse)
async def seed_problems(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a couple of public sample problems for the current user."""
    templates = [
        {
            "title": "Cyclic Quadrilateral Concurrency",
            "description": (
                "Study a cyclic quadrilateral with auxiliary circle intersections and "
                "a concurrency condition to prove a similarity statement."
            ),
            "difficulty": ProblemDifficulty.HARD,
            "tags": ["geometry", "olympiad", "concurrency"],
        },
        {
            "title": "Polynomial Root Preserver",
            "description": (
                "Characterize additive maps on integer polynomials that preserve the "
                "existence of integer roots."
            ),
            "difficulty": ProblemDifficulty.MEDIUM,
            "tags": ["algebra", "polynomials", "functions"],
        },
    ]

    created: list[Problem] = []
    for template in templates:
        exists = await db.execute(
            select(Problem).where(
                Problem.author_id == current_user.id,
                Problem.title == template["title"],
            )
        )
        if exists.scalar_one_or_none():
            continue

        problem = Problem(
            title=template["title"],
            description=template["description"],
            author_id=current_user.id,
            visibility=ProblemVisibility.PUBLIC,
            difficulty=template["difficulty"],
            tags=template["tags"],
        )
        problem.author = current_user
        db.add(problem)
        await db.flush()

        workspace_doc = WorkspaceFile(
            problem_id=problem.id,
            path="workspace.md",
            parent_path="",
            type=WorkspaceFileType.FILE,
            content=build_workspace_markdown(problem.title, problem.description),
            format="markdown",
            mimetype="text/markdown",
        )
        db.add(workspace_doc)
        db.add(
            Activity(
                user_id=current_user.id,
                type=ActivityType.CREATED_PROBLEM,
                target_id=problem.id,
                extra_data={"problem_id": str(problem.id), "problem_title": problem.title},
            )
        )
        created.append(problem)

    if created:
        await db.commit()
    return ProblemListResponse(
        problems=[problem_to_response(p) for p in created],
        total=len(created),
    )


@router.get("/{problem_id}", response_model=ProblemResponse)
async def get_problem(
    problem_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """Get a problem by ID"""
    result = await db.execute(
        select(Problem)
        .options(
            selectinload(Problem.author),
            selectinload(Problem.library_items),
        )
        .where(Problem.id == problem_id)
    )
    problem = result.scalar_one_or_none()
    
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    
    # Check visibility
    if problem.visibility == ProblemVisibility.PRIVATE:
        if not current_user or problem.author_id != current_user.id:
            raise HTTPException(status_code=404, detail="Problem not found")
    
    return problem_to_response(problem)


@router.patch("/{problem_id}", response_model=ProblemResponse)
async def update_problem(
    problem_id: UUID,
    data: ProblemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a problem (owner only)"""
    result = await db.execute(
        select(Problem)
        .options(
            selectinload(Problem.author),
            selectinload(Problem.library_items),
        )
        .where(Problem.id == problem_id)
    )
    problem = result.scalar_one_or_none()
    
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    
    if problem.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if data.title is not None:
        problem.title = data.title
    if data.description is not None:
        problem.description = data.description
    if data.visibility is not None:
        problem.visibility = data.visibility
    if data.difficulty is not None:
        problem.difficulty = data.difficulty
    if data.tags is not None:
        problem.tags = data.tags
    
    await db.commit()
    await db.refresh(problem)
    
    return problem_to_response(problem)


@router.delete("/{problem_id}", status_code=204)
async def delete_problem(
    problem_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a problem (owner only)"""
    result = await db.execute(select(Problem).where(Problem.id == problem_id))
    problem = result.scalar_one_or_none()
    
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    
    if problem.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.delete(problem)
    await db.commit()
