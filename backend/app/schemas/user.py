from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, EmailStr, ConfigDict


class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    email: str
    username: str
    avatar_url: str | None
    bio: str | None
    created_at: datetime


class UserPublic(BaseModel):
    """Public user info (for other users to see)"""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    username: str
    avatar_url: str | None
    bio: str | None


class UserUpdate(BaseModel):
    avatar_url: str | None = None
    bio: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str
