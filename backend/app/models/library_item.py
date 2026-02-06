import uuid
from datetime import datetime
from enum import Enum
from sqlalchemy import String, Text, DateTime, ForeignKey, ARRAY, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, ENUM, JSONB

from app.database import Base


class LibraryItemKind(str, Enum):
    RESOURCE = "RESOURCE"
    IDEA = "IDEA"
    CONTENT = "CONTENT"
    FORMAL_TEST = "FORMAL_TEST"
    LEMMA = "LEMMA"
    CLAIM = "CLAIM"
    DEFINITION = "DEFINITION"
    THEOREM = "THEOREM"
    COUNTEREXAMPLE = "COUNTEREXAMPLE"
    COMPUTATION = "COMPUTATION"
    NOTE = "NOTE"


class LibraryItemStatus(str, Enum):
    PROPOSED = "PROPOSED"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"


class LibraryItem(Base):
    __tablename__ = "library_items"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    problem_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("problems.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    kind: Mapped[LibraryItemKind] = mapped_column(
        ENUM(LibraryItemKind, name="library_item_kind", create_type=True), nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    
    # LaTeX formula (optional, for display)
    formula: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Lean 4 code (optional, for verification)
    lean_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    status: Mapped[LibraryItemStatus] = mapped_column(
        ENUM(LibraryItemStatus, name="library_item_status", create_type=True),
        nullable=False,
        default=LibraryItemStatus.PROPOSED
    )
    
    # Canvas position (optional, for visual layout)
    x: Mapped[float | None] = mapped_column(Float, nullable=True)
    y: Mapped[float | None] = mapped_column(Float, nullable=True)
    
    # JSON fields
    authors: Mapped[dict] = mapped_column(JSONB, nullable=False, default=list)
    source: Mapped[dict] = mapped_column(JSONB, nullable=True)
    dependencies: Mapped[list] = mapped_column(ARRAY(UUID(as_uuid=True)), nullable=False, default=list)
    verification: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )
    
    # Relationships
    problem: Mapped["Problem"] = relationship("Problem", back_populates="library_items")
    doc_anchors: Mapped[list["DocAnchor"]] = relationship("DocAnchor", back_populates="library_item", cascade="all, delete-orphan")
