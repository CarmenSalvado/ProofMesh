import uuid
from datetime import datetime
from enum import Enum
from sqlalchemy import String, Text, DateTime, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, ENUM

from app.database import Base


class WorkspaceFileType(str, Enum):
    FILE = "file"
    DIRECTORY = "directory"
    NOTEBOOK = "notebook"


class WorkspaceFile(Base):
    __tablename__ = "workspace_files"
    __table_args__ = (
        UniqueConstraint("problem_id", "path", name="uq_workspace_file_problem_path"),
        Index("ix_workspace_file_problem_parent", "problem_id", "parent_path"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    problem_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("problems.id", ondelete="CASCADE"), nullable=False
    )
    path: Mapped[str] = mapped_column(String(1024), nullable=False)
    parent_path: Mapped[str] = mapped_column(String(1024), nullable=False, default="")
    type: Mapped[WorkspaceFileType] = mapped_column(
        ENUM(
            WorkspaceFileType,
            name="workspace_file_type",
            create_type=True,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        nullable=False,
        default=WorkspaceFileType.FILE,
    )
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    format: Mapped[str | None] = mapped_column(String(32), nullable=True, default="text")
    mimetype: Mapped[str | None] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    problem: Mapped["Problem"] = relationship("Problem", back_populates="workspace_files")
