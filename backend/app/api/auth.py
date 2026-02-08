from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.user import User
from app.schemas.user import (
    UserCreate,
    UserLogin,
    UserResponse,
    UserUpdate,
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
from app.services.storage import put_object, delete_object

router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = get_settings()

DEMO_EMAIL = "demo@proofmesh.app"
DEMO_USERNAME = "lucia_mora"
DEMO_PASSWORD = "proofmesh-demo"
DEMO_BIO = "Collaborative mathematician exploring conjectures and formal proofs on ProofMesh."


class DemoLoginRequest(BaseModel):
    code: str | None = None


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
async def demo_login(data: DemoLoginRequest | None = None, db: AsyncSession = Depends(get_db)):
    """Return tokens for a pre-made demo user (auto-creates if missing)."""
    if not settings.debug and settings.demo_code_required_in_production:
        provided_code = (data.code or "").strip() if data else ""
        if provided_code != settings.demo_access_code:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid demo access code",
            )

    result = await db.execute(select(User).where(User.email == DEMO_EMAIL))
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            email=DEMO_EMAIL,
            username=DEMO_USERNAME,
            password_hash=get_password_hash(DEMO_PASSWORD),
            bio=DEMO_BIO,
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
    else:
        updated = False
        if user.username != DEMO_USERNAME:
            username_taken = await db.execute(
                select(User).where(User.username == DEMO_USERNAME, User.id != user.id)
            )
            if username_taken.scalar_one_or_none() is None:
                user.username = DEMO_USERNAME
                updated = True
        if user.bio != DEMO_BIO:
            user.bio = DEMO_BIO
            updated = True
        if updated:
            await db.commit()
            await db.refresh(user)

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


@router.patch("/me", response_model=UserResponse)
async def update_me(
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update current user profile fields"""
    updates = data.model_dump(exclude_unset=True)
    if "avatar_url" in updates:
        avatar_url = updates.get("avatar_url")
        if avatar_url is None:
            await delete_object(f"avatars/{current_user.id}")
        current_user.avatar_url = avatar_url
    if "bio" in updates:
        current_user.bio = updates.get("bio")

    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.post("/me/avatar", response_model=UserResponse)
async def upload_avatar(
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload a new avatar image for the current user"""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Avatar must be an image file")

    data = await file.read()
    if len(data) == 0:
        raise HTTPException(status_code=400, detail="Empty avatar file")
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Avatar file too large (max 5MB)")

    key = f"avatars/{current_user.id}"
    await put_object(key, data, file.content_type)

    base_url = str(request.base_url).rstrip("/")
    current_user.avatar_url = f"{base_url}/api/avatars/{current_user.id}"

    await db.commit()
    await db.refresh(current_user)
    return current_user
