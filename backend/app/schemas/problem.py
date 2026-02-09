from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict
from enum import Enum


class ProblemVisibility(str, Enum):
    PUBLIC = "public"
    PRIVATE = "private"


class ProblemDifficulty(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class ProblemCreate(BaseModel):
    title: str
    description: str | None = None
    visibility: ProblemVisibility = ProblemVisibility.PRIVATE
    difficulty: ProblemDifficulty | None = None
    tags: list[str] = []


class ProblemUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    visibility: ProblemVisibility | None = None
    difficulty: ProblemDifficulty | None = None
    tags: list[str] | None = None


class AuthorInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    username: str
    avatar_url: str | None = None


class ProblemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    title: str
    description: str | None
    visibility: ProblemVisibility
    difficulty: ProblemDifficulty | None
    tags: list[str]
    created_at: datetime
    updated_at: datetime
    author: AuthorInfo
    library_item_count: int = 0
    star_count: int = 0
    access_level: str = "viewer"
    can_edit: bool = False
    can_admin: bool = False
    is_owner: bool = False


class ProblemListResponse(BaseModel):
    problems: list[ProblemResponse]
    total: int


class ProblemPermissionMember(BaseModel):
    id: UUID
    username: str
    avatar_url: str | None = None
    role: str


class ProblemPermissionTeam(BaseModel):
    id: UUID
    name: str
    slug: str
    description: str | None = None
    my_role: str | None = None
    can_manage_members: bool = False
    members: list[ProblemPermissionMember] = []


class ProblemPermissionsResponse(BaseModel):
    problem_id: UUID
    problem_title: str
    visibility: ProblemVisibility
    owner: AuthorInfo
    access_level: str
    can_edit: bool
    can_admin: bool
    is_owner: bool
    actions: list[str]
    teams: list[ProblemPermissionTeam] = []
