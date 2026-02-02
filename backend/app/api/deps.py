from uuid import UUID
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.problem import Problem, ProblemVisibility
from app.services.auth import decode_token

security = HTTPBearer()


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


async def verify_problem_access(
    problem_id: UUID,
    db: AsyncSession,
    current_user: User | None,
    require_owner: bool = False,
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
        load_author: If True, eagerly loads the author relationship
        not_found_message: Custom message for 404 errors (e.g., "Workspace not found")
    
    Returns:
        The Problem if access is granted
        
    Raises:
        HTTPException 404: Problem not found or user lacks access
        HTTPException 403: User is not the owner (when require_owner=True)
    """
    query = select(Problem).where(Problem.id == problem_id)
    if load_author:
        query = query.options(selectinload(Problem.author))
    
    result = await db.execute(query)
    problem = result.scalar_one_or_none()

    if not problem:
        raise HTTPException(status_code=404, detail=not_found_message)

    if problem.visibility == ProblemVisibility.PRIVATE:
        if not current_user or problem.author_id != current_user.id:
            raise HTTPException(status_code=404, detail=not_found_message)

    if require_owner and (not current_user or problem.author_id != current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized")

    return problem
