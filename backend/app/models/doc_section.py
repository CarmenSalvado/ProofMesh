import uuid
from datetime import datetime
from sqlalchemy import String, Text, DateTime, ForeignKey, Integer, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class DocSection(Base):
    """
    Represents a logical section in a workspace document.
    Sections have stable IDs that survive heading renames.
    """
    __tablename__ = "doc_sections"
    __table_args__ = (
        Index("ix_doc_section_file_order", "workspace_file_id", "order_index"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    workspace_file_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspace_files.id", ondelete="CASCADE"), nullable=False
    )
    slug: Mapped[str] = mapped_column(String(255), nullable=False)  # e.g. "main-theorem"
    title: Mapped[str] = mapped_column(String(512), nullable=False)  # Display title
    level: Mapped[int] = mapped_column(Integer, nullable=False, default=1)  # Heading level (1-6)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)  # Position in doc
    content_preview: Mapped[str | None] = mapped_column(Text, nullable=True)  # First ~200 chars

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    workspace_file: Mapped["WorkspaceFile"] = relationship("WorkspaceFile", back_populates="sections")
    anchors: Mapped[list["DocAnchor"]] = relationship("DocAnchor", back_populates="section", cascade="all, delete-orphan")


class DocAnchor(Base):
    """
    Links a canvas node (LibraryItem) to a document section.
    Enables bidirectional navigation and staleness detection.
    """
    __tablename__ = "doc_anchors"
    __table_args__ = (
        Index("ix_doc_anchor_library_item", "library_item_id"),
        Index("ix_doc_anchor_section", "section_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    section_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("doc_sections.id", ondelete="CASCADE"), nullable=False
    )
    library_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("library_items.id", ondelete="CASCADE"), nullable=False
    )
    
    # Snapshot for staleness detection
    library_item_updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    is_stale: Mapped[bool] = mapped_column(default=False, nullable=False)
    
    # Optional: position within section (e.g., character offset or line number)
    position_hint: Mapped[str | None] = mapped_column(String(64), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    section: Mapped["DocSection"] = relationship("DocSection", back_populates="anchors")
    library_item: Mapped["LibraryItem"] = relationship("LibraryItem", back_populates="doc_anchors")
