from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, Field


class LatexFileInfo(BaseModel):
    path: str
    size: int | None = None
    last_modified: datetime | None = None
    content_type: str | None = None


class LatexFileResponse(BaseModel):
    path: str
    content: str | None = None
    content_base64: str | None = None
    content_type: str | None = None
    is_binary: bool = False


class LatexFileWrite(BaseModel):
    content: str | None = None
    content_base64: str | None = None
    content_type: str | None = None


class LatexFileListResponse(BaseModel):
    files: list[LatexFileInfo]


class LatexCompileRequest(BaseModel):
    main: str = Field(default="main.tex")


class LatexCompileResponse(BaseModel):
    status: str
    log: str
    pdf_key: str | None = None
    log_key: str | None = None
    meta_key: str | None = None
    duration_ms: int | None = None


class LatexRenameRequest(BaseModel):
    from_path: str
    to_path: str
