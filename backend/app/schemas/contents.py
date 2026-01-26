from __future__ import annotations

from datetime import datetime
from typing import Any
from pydantic import BaseModel


class ContentsModel(BaseModel):
    name: str
    path: str
    type: str
    created: datetime | None
    last_modified: datetime | None
    mimetype: str | None
    size: int | None
    writable: bool = True
    format: str | None = None
    content: Any | None = None


class ContentsCreate(BaseModel):
    type: str
    ext: str | None = None
    format: str | None = None
    content: Any | None = None


class ContentsUpdate(BaseModel):
    path: str | None = None
    format: str | None = None
    content: Any | None = None


class ContentsCopy(BaseModel):
    copy_from: str
