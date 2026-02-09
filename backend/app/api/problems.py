import uuid
from collections import defaultdict
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, inspect, func, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.problem import Problem, ProblemVisibility, ProblemDifficulty
from app.models.team import Team, TeamMember, TeamProblem, TeamRole
from app.models.star import Star, StarTargetType
from app.models.activity import Activity, ActivityType
from app.models.library_item import LibraryItem
from app.models.canvas_block import CanvasBlock
from app.models.workspace_file import WorkspaceFile, WorkspaceFileType
from app.models.user import User
from app.api.deps import (
    get_current_user,
    get_current_user_optional,
    get_problem_access_info,
    verify_problem_access,
    ProblemAccessInfo,
    ProblemAccessLevel,
)
from app.services.storage import list_objects, copy_object
from app.schemas.problem import (
    ProblemCreate,
    ProblemUpdate,
    ProblemResponse,
    ProblemListResponse,
    AuthorInfo,
    ProblemPermissionsResponse,
    ProblemPermissionTeam,
    ProblemPermissionMember,
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


async def fetch_team_roles_for_problems(
    problem_ids: list[UUID],
    current_user: User | None,
    db: AsyncSession,
) -> dict[UUID, set[TeamRole]]:
    if not current_user or not problem_ids:
        return {}

    result = await db.execute(
        select(TeamProblem.problem_id, TeamMember.role)
        .join(TeamMember, TeamMember.team_id == TeamProblem.team_id)
        .where(
            TeamMember.user_id == current_user.id,
            TeamProblem.problem_id.in_(problem_ids),
        )
    )

    role_map: dict[UUID, set[TeamRole]] = defaultdict(set)
    for problem_id, role in result.all():
        if role is not None:
            role_map[problem_id].add(role)
    return role_map


def resolve_problem_access(
    problem: Problem,
    current_user: User | None,
    team_roles: set[TeamRole] | None = None,
) -> ProblemAccessInfo | None:
    roles = team_roles or set()

    if current_user and problem.author_id == current_user.id:
        return ProblemAccessInfo(level=ProblemAccessLevel.OWNER)
    if TeamRole.OWNER in roles or TeamRole.ADMIN in roles:
        return ProblemAccessInfo(level=ProblemAccessLevel.ADMIN, team_roles=list(roles))
    if TeamRole.MEMBER in roles:
        return ProblemAccessInfo(level=ProblemAccessLevel.EDITOR, team_roles=list(roles))
    if problem.visibility == ProblemVisibility.PUBLIC:
        return ProblemAccessInfo(level=ProblemAccessLevel.VIEWER, team_roles=list(roles))
    return None


def problem_to_response(
    problem: Problem,
    star_count: int = 0,
    access: ProblemAccessInfo | None = None,
    library_count: int | None = None,
) -> ProblemResponse:
    """Convert Problem model to response with counts"""
    resolved_library_count = library_count
    if resolved_library_count is None:
        state = inspect(problem)
        resolved_library_count = 0
        if "library_items" not in state.unloaded:
            resolved_library_count = len(problem.library_items)

    access_info = access or ProblemAccessInfo(level=ProblemAccessLevel.VIEWER)

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
        library_item_count=resolved_library_count,
        star_count=star_count,
        access_level=access_info.level.value,
        can_edit=access_info.can_edit,
        can_admin=access_info.can_admin,
        is_owner=access_info.is_owner,
    )


@router.get("", response_model=ProblemListResponse)
async def list_problems(
    visibility: ProblemVisibility | None = None,
    mine: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """List problems visible to the current user (including team-shared private problems)."""
    query = select(Problem).options(
        selectinload(Problem.author),
    )

    team_problem_ids = None
    if current_user:
        team_problem_ids = (
            select(TeamProblem.problem_id)
            .join(TeamMember, TeamMember.team_id == TeamProblem.team_id)
            .where(TeamMember.user_id == current_user.id)
        )

    if mine:
        if not current_user:
            return ProblemListResponse(problems=[], total=0)
        query = query.where(Problem.author_id == current_user.id)
    elif visibility is not None:
        if visibility == ProblemVisibility.PUBLIC:
            query = query.where(Problem.visibility == ProblemVisibility.PUBLIC)
        else:
            if not current_user:
                return ProblemListResponse(problems=[], total=0)
            query = query.where(
                Problem.visibility == ProblemVisibility.PRIVATE,
                or_(
                    Problem.author_id == current_user.id,
                    Problem.id.in_(team_problem_ids),
                ),
            )
    else:
        # Default: public + own + team-shared private problems.
        if current_user:
            query = query.where(
                or_(
                    Problem.visibility == ProblemVisibility.PUBLIC,
                    Problem.author_id == current_user.id,
                    Problem.id.in_(team_problem_ids),
                )
            )
        else:
            query = query.where(Problem.visibility == ProblemVisibility.PUBLIC)

    query = query.order_by(Problem.updated_at.desc())
    result = await db.execute(query)
    problems = result.scalars().all()

    star_counts: dict[UUID, int] = {}
    library_counts: dict[UUID, int] = {}
    problem_ids = [p.id for p in problems]
    if problem_ids:
        stars_result = await db.execute(
            select(Star.target_id, func.count(Star.id))
            .where(
                Star.target_type == StarTargetType.PROBLEM,
                Star.target_id.in_(problem_ids),
            )
            .group_by(Star.target_id)
        )
        star_counts = {target_id: count for target_id, count in stars_result.all()}
        library_result = await db.execute(
            select(LibraryItem.problem_id, func.count(LibraryItem.id))
            .where(LibraryItem.problem_id.in_(problem_ids))
            .group_by(LibraryItem.problem_id)
        )
        library_counts = {problem_id: count for problem_id, count in library_result.all()}

    team_roles_map = await fetch_team_roles_for_problems(problem_ids, current_user, db)

    payload: list[ProblemResponse] = []
    for problem in problems:
        access = resolve_problem_access(problem, current_user, team_roles_map.get(problem.id))
        if access is None:
            continue
        payload.append(
            problem_to_response(
                problem,
                star_counts.get(problem.id, 0),
                access=access,
                library_count=library_counts.get(problem.id, 0),
            )
        )

    return ProblemListResponse(
        problems=payload,
        total=len(payload),
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

    access = ProblemAccessInfo(level=ProblemAccessLevel.OWNER)
    return problem_to_response(problem, access=access, library_count=0)


@router.post("/{problem_id}/fork", response_model=ProblemResponse, status_code=201)
async def fork_problem(
    problem_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fork a problem visible to the current user into the user's private workspace."""
    problem = await verify_problem_access(problem_id, db, current_user, load_author=True)

    forked = Problem(
        title=f"{problem.title} (fork)",
        description=problem.description,
        author_id=current_user.id,
        visibility=ProblemVisibility.PRIVATE,
        difficulty=problem.difficulty,
        tags=problem.tags or [],
        fork_of=problem.id,
    )
    db.add(forked)
    await db.flush()

    workspace_doc = WorkspaceFile(
        problem_id=forked.id,
        path="workspace.md",
        parent_path="",
        type=WorkspaceFileType.FILE,
        content=build_workspace_markdown(forked.title, forked.description),
        format="markdown",
        mimetype="text/markdown",
    )
    db.add(workspace_doc)

    items_result = await db.execute(select(LibraryItem).where(LibraryItem.problem_id == problem.id))
    items = items_result.scalars().all()
    id_map = {item.id: uuid.uuid4() for item in items}

    for item in items:
        new_item = LibraryItem(
            id=id_map[item.id],
            problem_id=forked.id,
            title=item.title,
            kind=item.kind,
            content=item.content,
            formula=item.formula,
            lean_code=item.lean_code,
            status=item.status,
            x=item.x,
            y=item.y,
            authors=item.authors,
            source=item.source,
            dependencies=[id_map[dep] for dep in item.dependencies if dep in id_map],
            verification=item.verification,
        )
        db.add(new_item)

    blocks_result = await db.execute(select(CanvasBlock).where(CanvasBlock.problem_id == problem.id))
    blocks = blocks_result.scalars().all()
    for block in blocks:
        new_block = CanvasBlock(
            problem_id=forked.id,
            name=block.name,
            node_ids=[id_map[node_id] for node_id in block.node_ids if node_id in id_map],
        )
        db.add(new_block)

    # Copy LaTeX files (skip build outputs)
    source_prefix = f"latex/{problem.id}/"
    dest_prefix = f"latex/{forked.id}/"
    try:
        objects = await list_objects(source_prefix)
        for obj in objects:
            key = obj.get("Key") or ""
            if not key or key.endswith("/"):
                continue
            if key.startswith(f"{source_prefix}.output/"):
                continue
            await copy_object(key, key.replace(source_prefix, dest_prefix, 1))
    except Exception:
        # Best-effort copy; do not fail fork
        pass

    db.add(
        Activity(
            user_id=current_user.id,
            type=ActivityType.FORKED_PROBLEM,
            target_id=forked.id,
            extra_data={
                "problem_id": str(problem.id),
                "problem_title": problem.title,
                "fork_id": str(forked.id),
            },
        )
    )
    await db.commit()

    result = await db.execute(
        select(Problem)
        .options(selectinload(Problem.author))
        .where(Problem.id == forked.id)
    )
    forked = result.scalar_one()
    access = ProblemAccessInfo(level=ProblemAccessLevel.OWNER)
    return problem_to_response(forked, access=access, library_count=len(items))


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
        problems=[
            problem_to_response(
                problem,
                access=ProblemAccessInfo(level=ProblemAccessLevel.OWNER),
                library_count=0,
            )
            for problem in created
        ],
        total=len(created),
    )


@router.get("/{problem_id}", response_model=ProblemResponse)
async def get_problem(
    problem_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """Get a problem by ID"""
    problem = await verify_problem_access(
        problem_id, db, current_user, load_author=True
    )
    access = await get_problem_access_info(problem, db, current_user)
    if access is None:
        raise HTTPException(status_code=404, detail="Problem not found")

    library_result = await db.execute(
        select(func.count(LibraryItem.id)).where(LibraryItem.problem_id == problem.id)
    )
    library_count = library_result.scalar() or 0
    stars_result = await db.execute(
        select(func.count(Star.id)).where(
            Star.target_type == StarTargetType.PROBLEM,
            Star.target_id == problem.id,
        )
    )
    star_count = stars_result.scalar() or 0
    return problem_to_response(problem, star_count, access=access, library_count=library_count)


@router.get("/{problem_id}/permissions", response_model=ProblemPermissionsResponse)
async def get_problem_permissions(
    problem_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """Get effective permissions and team-role context for a problem."""
    problem = await verify_problem_access(problem_id, db, current_user, load_author=True)
    access = await get_problem_access_info(problem, db, current_user)
    if access is None:
        raise HTTPException(status_code=404, detail="Problem not found")

    team_result = await db.execute(
        select(Team)
        .join(TeamProblem, TeamProblem.team_id == Team.id)
        .where(TeamProblem.problem_id == problem.id)
        .order_by(Team.name.asc())
    )
    teams = team_result.scalars().all()
    team_ids = [team.id for team in teams]

    my_roles_by_team: dict[UUID, TeamRole] = {}
    if current_user and team_ids:
        my_roles_result = await db.execute(
            select(TeamMember.team_id, TeamMember.role).where(
                TeamMember.user_id == current_user.id,
                TeamMember.team_id.in_(team_ids),
            )
        )
        my_roles_by_team = {team_id: role for team_id, role in my_roles_result.all() if role is not None}

    members_by_team: dict[UUID, list[TeamMember]] = defaultdict(list)
    if team_ids:
        members_result = await db.execute(
            select(TeamMember)
            .options(selectinload(TeamMember.user))
            .where(TeamMember.team_id.in_(team_ids))
            .order_by(TeamMember.joined_at.asc())
        )
        for member in members_result.scalars().all():
            members_by_team[member.team_id].append(member)

    teams_payload: list[ProblemPermissionTeam] = []
    for team in teams:
        my_role = my_roles_by_team.get(team.id)
        can_manage_members = access.is_owner or my_role in {TeamRole.OWNER, TeamRole.ADMIN}
        can_view_members = access.is_owner or my_role is not None
        members_payload: list[ProblemPermissionMember] = []
        if can_view_members:
            members_payload = [
                ProblemPermissionMember(
                    id=member.user.id,
                    username=member.user.username,
                    avatar_url=member.user.avatar_url,
                    role=member.role.value,
                )
                for member in members_by_team.get(team.id, [])
                if member.user is not None
            ]

        teams_payload.append(
            ProblemPermissionTeam(
                id=team.id,
                name=team.name,
                slug=team.slug,
                description=team.description,
                my_role=my_role.value if my_role else None,
                can_manage_members=can_manage_members,
                members=members_payload,
            )
        )

    actions = ["view"]
    if access.can_edit:
        actions.extend(["edit_library", "edit_workspace", "edit_canvas"])
    if access.can_admin:
        actions.append("manage_problem")
    if access.is_owner:
        actions.extend(["change_visibility", "delete_problem"])
    if any(team.can_manage_members for team in teams_payload):
        actions.append("manage_team_members")

    return ProblemPermissionsResponse(
        problem_id=problem.id,
        problem_title=problem.title,
        visibility=problem.visibility,
        owner=AuthorInfo(
            id=problem.author.id,
            username=problem.author.username,
            avatar_url=problem.author.avatar_url,
        ),
        access_level=access.level.value,
        can_edit=access.can_edit,
        can_admin=access.can_admin,
        is_owner=access.is_owner,
        actions=actions,
        teams=teams_payload,
    )


@router.patch("/{problem_id}", response_model=ProblemResponse)
async def update_problem(
    problem_id: UUID,
    data: ProblemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a problem (owner/admin)"""
    problem = await verify_problem_access(
        problem_id, db, current_user, require_admin=True, load_author=True
    )
    
    # Only owner can change visibility
    if data.visibility is not None and problem.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can change visibility")
    
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

    access = await get_problem_access_info(problem, db, current_user)
    if access is None:
        raise HTTPException(status_code=404, detail="Problem not found")
    library_result = await db.execute(
        select(func.count(LibraryItem.id)).where(LibraryItem.problem_id == problem.id)
    )
    library_count = library_result.scalar() or 0
    stars_result = await db.execute(
        select(func.count(Star.id)).where(
            Star.target_type == StarTargetType.PROBLEM,
            Star.target_id == problem.id,
        )
    )
    star_count = stars_result.scalar() or 0
    return problem_to_response(problem, star_count, access=access, library_count=library_count)


@router.delete("/{problem_id}")
async def delete_problem(
    problem_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a problem (owner/admin)."""
    problem = await verify_problem_access(
        problem_id, db, current_user, require_admin=True
    )
    await db.delete(problem)
    await db.commit()
