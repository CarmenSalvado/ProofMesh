from dataclasses import dataclass, field
from enum import Enum
from uuid import UUID
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.problem import Problem, ProblemVisibility
from app.models.team import TeamMember, TeamProblem, TeamRole
from app.services.auth import decode_token

security = HTTPBearer()


class ProblemAccessLevel(str, Enum):
    VIEWER = "viewer"
    EDITOR = "editor"
    ADMIN = "admin"
    OWNER = "owner"


@dataclass(slots=True)
class ProblemAccessInfo:
    level: ProblemAccessLevel
    team_roles: list[TeamRole] = field(default_factory=list)

    @property
    def can_view(self) -> bool:
        return True

    @property
    def can_edit(self) -> bool:
        return self.level in {
            ProblemAccessLevel.EDITOR,
            ProblemAccessLevel.ADMIN,
            ProblemAccessLevel.OWNER,
        }

    @property
    def can_admin(self) -> bool:
        return self.level in {
            ProblemAccessLevel.ADMIN,
            ProblemAccessLevel.OWNER,
        }

    @property
    def is_owner(self) -> bool:
        return self.level == ProblemAccessLevel.OWNER


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Get current authenticated user from JWT token"""
    token = credentials.credentials
    payload = decode_token(token)
    
    if not payload or payload.type != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    result = await db.execute(select(User).where(User.id == UUID(payload.sub)))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return user


async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials | None = Depends(HTTPBearer(auto_error=False)),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """Get current user if authenticated, None otherwise"""
    if not credentials:
        return None
    
    token = credentials.credentials
    payload = decode_token(token)
    
    if not payload or payload.type != "access":
        return None
    
    result = await db.execute(select(User).where(User.id == UUID(payload.sub)))
    return result.scalar_one_or_none()


async def get_problem_access_info(
    problem: Problem,
    db: AsyncSession,
    current_user: User | None,
) -> ProblemAccessInfo | None:
    """
    Resolve effective access level for a problem based on ownership and team membership.

    Access model:
    - owner: problem author
    - admin: member with team role owner/admin in any team linked to this problem
    - editor: member with team role member in any team linked to this problem
    - viewer: any user for public problems
    - none: private problem without ownership/team access
    """
    if current_user and problem.author_id == current_user.id:
        return ProblemAccessInfo(level=ProblemAccessLevel.OWNER)

    team_roles: list[TeamRole] = []
    if current_user:
        team_roles_result = await db.execute(
            select(TeamMember.role)
            .join(TeamProblem, TeamProblem.team_id == TeamMember.team_id)
            .where(
                TeamProblem.problem_id == problem.id,
                TeamMember.user_id == current_user.id,
            )
        )
        team_roles = [role for role in team_roles_result.scalars().all() if role is not None]

    if any(role in {TeamRole.OWNER, TeamRole.ADMIN} for role in team_roles):
        return ProblemAccessInfo(level=ProblemAccessLevel.ADMIN, team_roles=team_roles)
    if any(role == TeamRole.MEMBER for role in team_roles):
        return ProblemAccessInfo(level=ProblemAccessLevel.EDITOR, team_roles=team_roles)

    if problem.visibility == ProblemVisibility.PUBLIC:
        return ProblemAccessInfo(level=ProblemAccessLevel.VIEWER, team_roles=team_roles)

    return None


async def verify_problem_access(
    problem_id: UUID,
    db: AsyncSession,
    current_user: User | None,
    require_owner: bool = False,
    require_admin: bool = False,
    require_write: bool = False,
    load_author: bool = False,
    not_found_message: str = "Problem not found",
) -> Problem:
    """
    Verify user has access to a problem.
    
    Args:
        problem_id: The problem UUID
        db: Database session
        current_user: Current authenticated user (or None)
        require_owner: If True, requires the user to be the problem owner
        require_admin: If True, requires admin/owner access
        require_write: If True, requires editor/admin/owner access
        load_author: If True, eagerly loads the author relationship
        not_found_message: Custom message for 404 errors (e.g., "Workspace not found")
    
    Returns:
        The Problem if access is granted
        
    Raises:
        HTTPException 404: Problem not found or user lacks access
        HTTPException 403: User lacks required access level
    """
    query = select(Problem).where(Problem.id == problem_id)
    if load_author:
        query = query.options(selectinload(Problem.author))
    
    result = await db.execute(query)
    problem = result.scalar_one_or_none()

    if not problem:
        raise HTTPException(status_code=404, detail=not_found_message)

    access = await get_problem_access_info(problem, db, current_user)
    if access is None:
        raise HTTPException(status_code=404, detail=not_found_message)

    if require_owner and not access.is_owner:
        raise HTTPException(status_code=403, detail="Not authorized")
    if require_admin and not access.can_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    if require_write and not access.can_edit:
        raise HTTPException(status_code=403, detail="Not authorized")

    return problem
