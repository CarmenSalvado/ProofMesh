import uuid as uuid_lib
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.canvas import Canvas
from app.models.canvas_line import CanvasLine, LineType, AuthorType
from app.schemas.canvas_line import (
    CanvasLineCreate,
    CanvasLineUpdate,
    CanvasLineResponse,
)

router = APIRouter(prefix="/api/canvases/{canvas_id}/lines", tags=["lines"])


def generate_order_key(prev_key: str | None, next_key: str | None) -> str:
    """Generate a fractional key between two existing keys.
    Uses lexicographic ordering with 'a'-'z' range.
    """
    if prev_key is None and next_key is None:
        return "m"  # Middle of alphabet
    
    if prev_key is None:
        # Insert at beginning
        first_char = next_key[0] if next_key else "m"
        if first_char > "a":
            return chr(ord(first_char) - 1)
        return "a" + "m"
    
    if next_key is None:
        # Insert at end
        last_char = prev_key[-1]
        if last_char < "z":
            return prev_key[:-1] + chr(ord(last_char) + 1)
        return prev_key + "m"
    
    # Insert between two keys
    i = 0
    while i < len(prev_key) and i < len(next_key) and prev_key[i] == next_key[i]:
        i += 1
    
    if i < len(prev_key) and i < len(next_key):
        mid_char = chr((ord(prev_key[i]) + ord(next_key[i])) // 2)
        if mid_char != prev_key[i]:
            return prev_key[:i] + mid_char
    
    # Need to append
    return prev_key + "m"


@router.get("", response_model=list[CanvasLineResponse])
async def list_lines(canvas_id: UUID, db: AsyncSession = Depends(get_db)):
    """List all lines in a canvas, ordered by order_key"""
    result = await db.execute(
        select(CanvasLine)
        .where(CanvasLine.canvas_id == canvas_id)
        .order_by(CanvasLine.order_key)
    )
    return result.scalars().all()


@router.post("", response_model=CanvasLineResponse, status_code=201)
async def create_line(
    canvas_id: UUID, data: CanvasLineCreate, db: AsyncSession = Depends(get_db)
):
    """Create a new line in the canvas"""
    # Verify canvas exists
    result = await db.execute(select(Canvas).where(Canvas.id == canvas_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Canvas not found")
    
    # Generate order_key if not provided
    order_key = data.order_key
    if not order_key:
        # Get last line's order_key
        result = await db.execute(
            select(CanvasLine.order_key)
            .where(CanvasLine.canvas_id == canvas_id)
            .order_by(CanvasLine.order_key.desc())
            .limit(1)
        )
        last_key = result.scalar_one_or_none()
        order_key = generate_order_key(last_key, None)
    
    line = CanvasLine(
        canvas_id=canvas_id,
        order_key=order_key,
        type=data.type,
        content=data.content,
        author_type=data.author_type,
        author_id=data.author_id,
        agent_run_id=data.agent_run_id,
        library_item_id=data.library_item_id,
    )
    db.add(line)
    await db.commit()
    await db.refresh(line)
    return line


@router.get("/{line_id}", response_model=CanvasLineResponse)
async def get_line(canvas_id: UUID, line_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get a line by ID"""
    result = await db.execute(
        select(CanvasLine).where(
            CanvasLine.id == line_id, CanvasLine.canvas_id == canvas_id
        )
    )
    line = result.scalar_one_or_none()
    if not line:
        raise HTTPException(status_code=404, detail="Line not found")
    return line


@router.patch("/{line_id}", response_model=CanvasLineResponse)
async def update_line(
    canvas_id: UUID,
    line_id: UUID,
    data: CanvasLineUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a line. If editing an agent_insert, tracks derivation."""
    result = await db.execute(
        select(CanvasLine).where(
            CanvasLine.id == line_id, CanvasLine.canvas_id == canvas_id
        )
    )
    line = result.scalar_one_or_none()
    if not line:
        raise HTTPException(status_code=404, detail="Line not found")
    
    # If editing an agent_insert, mark derivation (per CLAUDE.md)
    if line.type == LineType.AGENT_INSERT and data.content is not None:
        if line.derived_from is None:
            line.derived_from = line.id  # Track original
        line.author_type = AuthorType.HUMAN  # Becomes human-authored
    
    # Library refs cannot be edited (per CLAUDE.md)
    if line.type == LineType.LIBRARY_REF:
        raise HTTPException(
            status_code=400, detail="Library references cannot be edited"
        )
    
    if data.content is not None:
        line.content = data.content
    if data.type is not None:
        line.type = data.type
    if data.order_key is not None:
        line.order_key = data.order_key
    
    await db.commit()
    await db.refresh(line)
    return line


@router.delete("/{line_id}", status_code=204)
async def delete_line(
    canvas_id: UUID, line_id: UUID, db: AsyncSession = Depends(get_db)
):
    """Delete a line"""
    result = await db.execute(
        select(CanvasLine).where(
            CanvasLine.id == line_id, CanvasLine.canvas_id == canvas_id
        )
    )
    line = result.scalar_one_or_none()
    if not line:
        raise HTTPException(status_code=404, detail="Line not found")
    
    await db.delete(line)
    await db.commit()
