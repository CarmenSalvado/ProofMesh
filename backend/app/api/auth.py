from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.user import (
    UserCreate,
    UserLogin,
    UserResponse,
    TokenResponse,
    RefreshRequest,
)
from app.services.auth import (
    get_password_hash,
    verify_password,
    create_tokens,
    decode_token,
)
from app.api.deps import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

DEMO_EMAIL = "demo@proofmesh.app"
DEMO_USERNAME = "proofmesh-demo"
DEMO_PASSWORD = "proofmesh-demo"


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(data: UserCreate, db: AsyncSession = Depends(get_db)):
    """Register a new user"""
    # Check if email exists
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    
    # Check if username exists
    result = await db.execute(select(User).where(User.username == data.username))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken",
        )
    
    # Create user
    user = User(
        email=data.email,
        username=data.username,
        password_hash=get_password_hash(data.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    return create_tokens(str(user.id))


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    """Login with email and password"""
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    return create_tokens(str(user.id))


@router.post("/demo", response_model=TokenResponse)
async def demo_login(db: AsyncSession = Depends(get_db)):
    """Return tokens for a pre-made demo user (auto-creates if missing)."""
    result = await db.execute(select(User).where(User.email == DEMO_EMAIL))
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            email=DEMO_EMAIL,
            username=DEMO_USERNAME,
            password_hash=get_password_hash(DEMO_PASSWORD),
            bio="Demo account for ProofMesh preview",
        )
        db.add(user)
        try:
            await db.commit()
            await db.refresh(user)
        except Exception:
            await db.rollback()
            # If another request created it concurrently, fetch it
            result = await db.execute(select(User).where(User.email == DEMO_EMAIL))
            user = result.scalar_one_or_none()
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Unable to provision demo user",
                )

    return create_tokens(str(user.id))


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(data: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """Get new access token using refresh token"""
    payload = decode_token(data.refresh_token)
    
    if not payload or payload.type != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )
    
    # Verify user still exists
    result = await db.execute(select(User).where(User.id == UUID(payload.sub)))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    
    return create_tokens(str(user.id))


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current authenticated user"""
    return current_user
