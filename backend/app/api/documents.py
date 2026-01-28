"""
API endpoints for document sections and anchors.
Enables Canvas ↔ Editor integration with traceability.
"""
from uuid import UUID
from typing import Optional
from datetime import datetime
import re

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.api.deps import get_db, get_current_user
from app.models import User, WorkspaceFile, LibraryItem, DocSection, DocAnchor
from app.schemas.doc_section import (
    DocSectionCreate, DocSectionUpdate, DocSectionResponse,
    DocAnchorCreate, DocAnchorUpdate, DocAnchorResponse,
    CommitToDocumentRequest, CommitToDocumentResponse
)

router = APIRouter()


def slugify(text: str) -> str:
    """Convert text to URL-friendly slug"""
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[-\s]+', '-', text)
    return text[:64]


def generate_section_content(items: list[LibraryItem], format: str = "markdown") -> str:
    """
    Generate document content from library items.
    This is a simple generator - can be enhanced with AI later.
    """
    lines = []
    
    for item in items:
        kind = item.kind.value if hasattr(item.kind, 'value') else item.kind
        title = item.title
        content = item.content or ""
        formula = item.formula
        
        if format == "latex":
            # LaTeX format
            env_map = {
                "DEFINITION": "definition",
                "LEMMA": "lemma", 
                "THEOREM": "theorem",
                "CLAIM": "claim",
                "NOTE": "remark",
                "COUNTEREXAMPLE": "example",
            }
            env = env_map.get(kind, "remark")
            
            lines.append(f"\\begin{{{env}}}[{title}]")
            lines.append(f"\\label{{item:{item.id}}}")
            if formula:
                lines.append(f"\\[")
                lines.append(formula)
                lines.append(f"\\]")
            if content:
                lines.append(content)
            lines.append(f"\\end{{{env}}}")
            lines.append("")
        else:
            # Markdown format
            kind_emoji = {
                "DEFINITION": "📖",
                "LEMMA": "💡",
                "THEOREM": "🏆",
                "CLAIM": "📌",
                "NOTE": "📝",
                "COUNTEREXAMPLE": "⚠️",
            }
            emoji = kind_emoji.get(kind, "•")
            
            lines.append(f"### {emoji} {kind}: {title}")
            lines.append("")
            if formula:
                lines.append(f"$$")
                lines.append(formula)
                lines.append(f"$$")
                lines.append("")
            if content:
                lines.append(content)
                lines.append("")
            lines.append(f"<!-- anchor:{item.id} -->")
            lines.append("")
    
    return "\n".join(lines)


# =============================================================================
# DocSection endpoints
# =============================================================================

@router.get("/files/{file_id}/sections", response_model=list[DocSectionResponse])
async def list_sections(
    file_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all sections in a workspace file"""
    # Verify file exists
    file = db.get(WorkspaceFile, file_id)
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Get sections with anchor stats
    sections = db.execute(
        select(DocSection)
        .where(DocSection.workspace_file_id == file_id)
        .order_by(DocSection.order_index)
    ).scalars().all()
    
    result = []
    for section in sections:
        # Count anchors and check staleness
        anchor_count = len(section.anchors)
        has_stale = any(a.is_stale for a in section.anchors)
        
        result.append(DocSectionResponse(
            id=section.id,
            workspace_file_id=section.workspace_file_id,
            slug=section.slug,
            title=section.title,
            level=section.level,
            order_index=section.order_index,
            content_preview=section.content_preview,
            created_at=section.created_at,
            updated_at=section.updated_at,
            anchor_count=anchor_count,
            has_stale_anchors=has_stale,
        ))
    
    return result


@router.post("/files/{file_id}/sections", response_model=DocSectionResponse)
async def create_section(
    file_id: UUID,
    data: DocSectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new section in a workspace file"""
    file = db.get(WorkspaceFile, file_id)
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Determine order_index if not provided
    order_index = data.order_index
    if order_index is None:
        max_order = db.execute(
            select(func.max(DocSection.order_index))
            .where(DocSection.workspace_file_id == file_id)
        ).scalar() or -1
        order_index = max_order + 1
    
    section = DocSection(
        workspace_file_id=file_id,
        slug=data.slug or slugify(data.title),
        title=data.title,
        level=data.level,
        order_index=order_index,
        content_preview=data.content_preview,
    )
    db.add(section)
    db.commit()
    db.refresh(section)
    
    return DocSectionResponse(
        id=section.id,
        workspace_file_id=section.workspace_file_id,
        slug=section.slug,
        title=section.title,
        level=section.level,
        order_index=section.order_index,
        content_preview=section.content_preview,
        created_at=section.created_at,
        updated_at=section.updated_at,
        anchor_count=0,
        has_stale_anchors=False,
    )


@router.patch("/sections/{section_id}", response_model=DocSectionResponse)
async def update_section(
    section_id: UUID,
    data: DocSectionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a section"""
    section = db.get(DocSection, section_id)
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(section, key, value)
    
    db.commit()
    db.refresh(section)
    
    anchor_count = len(section.anchors)
    has_stale = any(a.is_stale for a in section.anchors)
    
    return DocSectionResponse(
        id=section.id,
        workspace_file_id=section.workspace_file_id,
        slug=section.slug,
        title=section.title,
        level=section.level,
        order_index=section.order_index,
        content_preview=section.content_preview,
        created_at=section.created_at,
        updated_at=section.updated_at,
        anchor_count=anchor_count,
        has_stale_anchors=has_stale,
    )


@router.delete("/sections/{section_id}")
async def delete_section(
    section_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a section and its anchors"""
    section = db.get(DocSection, section_id)
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    
    db.delete(section)
    db.commit()
    
    return {"ok": True}


# =============================================================================
# DocAnchor endpoints
# =============================================================================

@router.get("/sections/{section_id}/anchors", response_model=list[DocAnchorResponse])
async def list_anchors(
    section_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all anchors in a section"""
    section = db.get(DocSection, section_id)
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    
    result = []
    for anchor in section.anchors:
        item = anchor.library_item
        result.append(DocAnchorResponse(
            id=anchor.id,
            section_id=anchor.section_id,
            library_item_id=anchor.library_item_id,
            library_item_updated_at=anchor.library_item_updated_at,
            is_stale=anchor.is_stale,
            position_hint=anchor.position_hint,
            created_at=anchor.created_at,
            updated_at=anchor.updated_at,
            library_item_title=item.title if item else None,
            library_item_kind=item.kind.value if item and hasattr(item.kind, 'value') else None,
        ))
    
    return result


@router.get("/items/{item_id}/anchors", response_model=list[DocAnchorResponse])
async def list_item_anchors(
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all document anchors for a library item (canvas node)"""
    item = db.get(LibraryItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Library item not found")
    
    result = []
    for anchor in item.doc_anchors:
        result.append(DocAnchorResponse(
            id=anchor.id,
            section_id=anchor.section_id,
            library_item_id=anchor.library_item_id,
            library_item_updated_at=anchor.library_item_updated_at,
            is_stale=anchor.is_stale,
            position_hint=anchor.position_hint,
            created_at=anchor.created_at,
            updated_at=anchor.updated_at,
            library_item_title=item.title,
            library_item_kind=item.kind.value if hasattr(item.kind, 'value') else None,
        ))
    
    return result


@router.post("/anchors", response_model=DocAnchorResponse)
async def create_anchor(
    data: DocAnchorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create an anchor linking a canvas node to a document section"""
    section = db.get(DocSection, data.section_id)
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    
    item = db.get(LibraryItem, data.library_item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Library item not found")
    
    anchor = DocAnchor(
        section_id=data.section_id,
        library_item_id=data.library_item_id,
        library_item_updated_at=item.updated_at,
        is_stale=False,
        position_hint=data.position_hint,
    )
    db.add(anchor)
    db.commit()
    db.refresh(anchor)
    
    return DocAnchorResponse(
        id=anchor.id,
        section_id=anchor.section_id,
        library_item_id=anchor.library_item_id,
        library_item_updated_at=anchor.library_item_updated_at,
        is_stale=anchor.is_stale,
        position_hint=anchor.position_hint,
        created_at=anchor.created_at,
        updated_at=anchor.updated_at,
        library_item_title=item.title,
        library_item_kind=item.kind.value if hasattr(item.kind, 'value') else None,
    )


@router.delete("/anchors/{anchor_id}")
async def delete_anchor(
    anchor_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an anchor"""
    anchor = db.get(DocAnchor, anchor_id)
    if not anchor:
        raise HTTPException(status_code=404, detail="Anchor not found")
    
    db.delete(anchor)
    db.commit()
    
    return {"ok": True}


@router.post("/anchors/refresh-staleness")
async def refresh_anchor_staleness(
    problem_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Refresh staleness status for all anchors in a problem.
    Marks anchors as stale if library_item.updated_at > anchor.library_item_updated_at
    """
    # Get all anchors for items in this problem
    anchors = db.execute(
        select(DocAnchor)
        .join(LibraryItem)
        .where(LibraryItem.problem_id == problem_id)
    ).scalars().all()
    
    updated_count = 0
    for anchor in anchors:
        item = anchor.library_item
        if item and item.updated_at > anchor.library_item_updated_at:
            anchor.is_stale = True
            updated_count += 1
    
    db.commit()
    
    return {"ok": True, "updated_count": updated_count}


# =============================================================================
# Commit to Document (Canvas → Editor)
# =============================================================================

@router.post("/problems/{problem_id}/commit-to-document", response_model=CommitToDocumentResponse)
async def commit_to_document(
    problem_id: UUID,
    data: CommitToDocumentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Convert selected canvas nodes into a document section.
    Creates section, generates content, and establishes anchors for traceability.
    """
    # Find workspace file by ID or path
    file = None
    if data.workspace_file_id:
        file = db.get(WorkspaceFile, data.workspace_file_id)
    elif data.workspace_file_path:
        file = db.execute(
            select(WorkspaceFile)
            .where(WorkspaceFile.problem_id == problem_id)
            .where(WorkspaceFile.path == data.workspace_file_path)
        ).scalar_one_or_none()
    
    if not file or file.problem_id != problem_id:
        raise HTTPException(status_code=404, detail="Workspace file not found")
    
    # Get library items (nodes)
    items = db.execute(
        select(LibraryItem)
        .where(LibraryItem.id.in_(data.node_ids))
        .where(LibraryItem.problem_id == problem_id)
    ).scalars().all()
    
    if not items:
        raise HTTPException(status_code=400, detail="No valid nodes found")
    
    # Sort items by dependencies (topological-ish: definitions first, then lemmas, then theorems)
    kind_order = {"DEFINITION": 0, "NOTE": 1, "LEMMA": 2, "CLAIM": 3, "THEOREM": 4, "COUNTEREXAMPLE": 5}
    items = sorted(items, key=lambda x: kind_order.get(x.kind.value if hasattr(x.kind, 'value') else x.kind, 10))
    
    # Determine order_index for new section
    if data.insert_after_section_id:
        after_section = db.get(DocSection, data.insert_after_section_id)
        order_index = (after_section.order_index + 1) if after_section else 0
        # Shift existing sections
        db.execute(
            DocSection.__table__.update()
            .where(DocSection.workspace_file_id == file.id)
            .where(DocSection.order_index >= order_index)
            .values(order_index=DocSection.order_index + 1)
        )
    else:
        # Append at end
        max_order = db.execute(
            select(func.max(DocSection.order_index))
            .where(DocSection.workspace_file_id == file.id)
        ).scalar() or -1
        order_index = max_order + 1
    
    # Generate content
    generated_content = generate_section_content(items, data.format)
    
    # Create section header based on format
    if data.format == "latex":
        section_header = f"\n\n\\section{{{data.section_title}}}\n\\label{{sec:{slugify(data.section_title)}}}\n\n"
    else:
        section_header = f"\n\n## {data.section_title}\n\n"
    
    full_section_content = section_header + generated_content
    
    # Append content to the workspace file
    current_content = file.content or ""
    file.content = current_content + full_section_content
    
    # Create section
    section = DocSection(
        workspace_file_id=file.id,
        slug=data.section_slug or slugify(data.section_title),
        title=data.section_title,
        level=2,
        order_index=order_index,
        content_preview=generated_content[:200] if generated_content else None,
    )
    db.add(section)
    db.flush()  # Get section.id
    
    # Create anchors
    anchors = []
    for item in items:
        anchor = DocAnchor(
            section_id=section.id,
            library_item_id=item.id,
            library_item_updated_at=item.updated_at,
            is_stale=False,
        )
        db.add(anchor)
        anchors.append(anchor)
    
    db.commit()
    db.refresh(section)
    
    # Build response
    anchor_responses = []
    for anchor, item in zip(anchors, items):
        db.refresh(anchor)
        anchor_responses.append(DocAnchorResponse(
            id=anchor.id,
            section_id=anchor.section_id,
            library_item_id=anchor.library_item_id,
            library_item_updated_at=anchor.library_item_updated_at,
            is_stale=anchor.is_stale,
            position_hint=anchor.position_hint,
            created_at=anchor.created_at,
            updated_at=anchor.updated_at,
            library_item_title=item.title,
            library_item_kind=item.kind.value if hasattr(item.kind, 'value') else None,
        ))
    
    return CommitToDocumentResponse(
        section=DocSectionResponse(
            id=section.id,
            workspace_file_id=section.workspace_file_id,
            slug=section.slug,
            title=section.title,
            level=section.level,
            order_index=section.order_index,
            content_preview=section.content_preview,
            created_at=section.created_at,
            updated_at=section.updated_at,
            anchor_count=len(anchors),
            has_stale_anchors=False,
        ),
        anchors=anchor_responses,
        generated_content=full_section_content,
    )


# =============================================================================
# Anchor Status (for Canvas badges)
# =============================================================================

@router.get("/nodes/anchor-status")
async def get_nodes_anchor_status(
    node_ids: list[UUID],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get anchor status for multiple nodes at once.
    Used to show badges on canvas nodes that are linked to documents.
    """
    from sqlalchemy import case
    
    # Query all anchors for these nodes grouped by library_item_id
    result = db.execute(
        select(
            DocAnchor.library_item_id,
            func.count(DocAnchor.id).label("anchor_count"),
            func.bool_or(DocAnchor.is_stale).label("has_stale"),
        )
        .where(DocAnchor.library_item_id.in_(node_ids))
        .group_by(DocAnchor.library_item_id)
    ).all()
    
    # Build response map
    status_map = {
        str(row.library_item_id): {
            "node_id": str(row.library_item_id),
            "has_anchors": True,
            "is_stale": row.has_stale,
            "anchor_count": row.anchor_count,
        }
        for row in result
    }
    
    # Include nodes with no anchors
    response = []
    for node_id in node_ids:
        node_id_str = str(node_id)
        if node_id_str in status_map:
            response.append(status_map[node_id_str])
        else:
            response.append({
                "node_id": node_id_str,
                "has_anchors": False,
                "is_stale": False,
                "anchor_count": 0,
            })
    
    return response

