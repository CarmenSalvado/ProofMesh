from uuid import UUID
import re
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from datetime import datetime

from app.database import get_db
from app.models.problem import Problem
from app.models.library_item import LibraryItem, LibraryItemStatus, LibraryItemKind
from app.models.activity import Activity, ActivityType
from app.models.discussion import Discussion
from app.models.comment import Comment
from app.models.user import User
from app.api.deps import get_current_user, get_current_user_optional, verify_problem_access
from app.services.python_executor import (
    PythonExecutionError,
    execute_python_code,
)
from app.schemas.library_item import (
    LibraryItemCreate,
    LibraryItemUpdate,
    LibraryItemResponse,
    LibraryItemListResponse,
    AuthorInfo,
    NodeActivityHistoryResponse,
    NodeActivityEntry,
)

router = APIRouter(prefix="/api/problems/{problem_id}/library", tags=["library"])


class ComputationExecutionRequest(BaseModel):
    code: str | None = None
    timeout_seconds: float | None = Field(default=None, ge=0.5, le=20.0)


class ComputationExecutionResponse(BaseModel):
    success: bool
    stdout: str
    stderr: str
    error: str | None = None
    exit_code: int | None = None
    duration_ms: int
    executed_code: str


def extract_python_source(content: str) -> str:
    """Extract python source from markdown code fences when present."""
    text = (content or "").strip()
    if not text:
        return ""

    fenced_python = re.search(r"```(?:python|py)\s*\n([\s\S]*?)```", text, flags=re.IGNORECASE)
    if fenced_python and fenced_python.group(1):
        return fenced_python.group(1).strip()

    generic_fence = re.search(r"```[a-zA-Z0-9_-]*\s*\n([\s\S]*?)```", text, flags=re.IGNORECASE)
    if generic_fence and generic_fence.group(1):
        return generic_fence.group(1).strip()

    return text


async def enrich_authors_with_avatars(
    authors: list[dict],
    db: AsyncSession
) -> list[AuthorInfo]:
    """Enrich author info with avatar URLs from user database"""
    if not authors:
        return []
    
    # Collect human author IDs
    human_author_ids = [
        UUID(a["id"]) for a in authors 
        if a.get("type") == "human" and a.get("id")
    ]
    
    # Fetch user data for human authors
    user_avatars = {}
    if human_author_ids:
        result = await db.execute(
            select(User.id, User.username, User.avatar_url)
            .where(User.id.in_(human_author_ids))
        )
        for user_id, username, avatar_url in result.all():
            user_avatars[str(user_id)] = {
                "name": username,
                "avatar_url": avatar_url
            }
    
    # Build enriched author list
    enriched = []
    for author in authors:
        author_id = author.get("id", "")
        enriched_author = AuthorInfo(
            type=author.get("type", "human"),
            id=author_id,
            name=author.get("name"),
            avatar_url=None
        )
        
        # Enrich human authors with avatar
        if author.get("type") == "human" and author_id in user_avatars:
            user_data = user_avatars[author_id]
            enriched_author.name = enriched_author.name or user_data["name"]
            enriched_author.avatar_url = user_data["avatar_url"]
        
        enriched.append(enriched_author)
    
    return enriched


async def item_to_response(
    item: LibraryItem,
    db: AsyncSession
) -> LibraryItemResponse:
    """Convert LibraryItem to response with enriched authors"""
    enriched_authors = await enrich_authors_with_avatars(item.authors or [], db)
    
    return LibraryItemResponse(
        id=item.id,
        problem_id=item.problem_id,
        title=item.title,
        kind=item.kind,
        content=item.content,
        formula=item.formula,
        lean_code=item.lean_code,
        status=item.status,
        x=item.x,
        y=item.y,
        authors=enriched_authors,
        source=item.source,
        dependencies=item.dependencies or [],
        verification=item.verification,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


@router.get("", response_model=LibraryItemListResponse)
async def list_library_items(
    problem_id: UUID,
    kind: LibraryItemKind | None = None,
    status: LibraryItemStatus | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """List all library items for a problem with optional filters"""
    await verify_problem_access(problem_id, db, current_user)
    
    query = select(LibraryItem).where(LibraryItem.problem_id == problem_id)
    
    if kind:
        query = query.where(LibraryItem.kind == kind)
    if status:
        query = query.where(LibraryItem.status == status)
    
    query = query.order_by(LibraryItem.created_at.desc())
    result = await db.execute(query)
    items = result.scalars().all()
    
    # Enrich all items with author avatars
    enriched_items = [await item_to_response(item, db) for item in items]
    
    return LibraryItemListResponse(items=enriched_items, total=len(enriched_items))


@router.post("", response_model=LibraryItemResponse, status_code=201)
async def create_library_item(
    problem_id: UUID,
    data: LibraryItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Publish a new item to the library"""
    problem = await verify_problem_access(problem_id, db, current_user, require_write=True)
    
    # Add current user as author if not specified
    authors = [a.model_dump(mode="json") for a in data.authors]
    if not authors:
        authors = [{"type": "human", "id": str(current_user.id), "name": current_user.username}]
    
    item = LibraryItem(
        problem_id=problem_id,
        title=data.title,
        kind=data.kind,
        content=data.content,
        formula=data.formula,
        lean_code=data.lean_code,
        x=data.x,
        y=data.y,
        status=LibraryItemStatus.PROPOSED,
        authors=authors,
        source=data.source.model_dump(mode="json") if data.source else None,
        dependencies=data.dependencies,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    
    return await item_to_response(item, db)


@router.get("/{item_id}", response_model=LibraryItemResponse)
async def get_library_item(
    problem_id: UUID,
    item_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """Get a library item by ID"""
    await verify_problem_access(problem_id, db, current_user)
    
    result = await db.execute(
        select(LibraryItem).where(
            LibraryItem.id == item_id, LibraryItem.problem_id == problem_id
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Library item not found")
    
    return await item_to_response(item, db)


@router.patch("/{item_id}", response_model=LibraryItemResponse)
async def update_library_item(
    problem_id: UUID,
    item_id: UUID,
    data: LibraryItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a library item (content, status, verification)"""
    problem = await verify_problem_access(problem_id, db, current_user, require_write=True)
    
    result = await db.execute(
        select(LibraryItem).where(
            LibraryItem.id == item_id, LibraryItem.problem_id == problem_id
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Library item not found")
    
    # Track what changed for activity log
    changes = []
    old_status = item.status
    
    # Status can only become VERIFIED with verification info
    if data.status == LibraryItemStatus.VERIFIED and not data.verification:
        if not item.verification:
            raise HTTPException(
                status_code=400,
                detail="Cannot verify without verification info",
            )
    
    if data.title is not None and data.title != item.title:
        item.title = data.title
        changes.append("title")
    if data.content is not None and data.content != item.content:
        item.content = data.content
        changes.append("content")
    if data.formula is not None and data.formula != item.formula:
        item.formula = data.formula
        changes.append("formula")
    if data.lean_code is not None and data.lean_code != item.lean_code:
        item.lean_code = data.lean_code
        changes.append("lean_code")
    if data.status is not None and data.status != item.status:
        item.status = data.status
        changes.append("status")
    if data.verification is not None:
        new_verification = data.verification.model_dump(mode="json")
        if new_verification != (item.verification or {}):
            item.verification = new_verification
            changes.append("verification")
    if data.dependencies is not None:
        current_dependencies = list(item.dependencies or [])
        new_dependencies = list(data.dependencies)
        if new_dependencies != current_dependencies:
            item.dependencies = new_dependencies
            changes.append("dependencies")
    if data.x is not None:
        item.x = data.x
    if data.y is not None:
        item.y = data.y
    
    # Avoid feed spam from iterative canvas edits.
    # Emit activity only on explicit verification transition.
    if data.status == LibraryItemStatus.VERIFIED and old_status != LibraryItemStatus.VERIFIED:
        db.add(
            Activity(
                user_id=current_user.id,
                type=ActivityType.VERIFIED_LIBRARY,
                target_id=item.id,
                extra_data={
                    "problem_id": str(problem_id),
                    "problem_title": problem.title,
                    "item_title": item.title,
                    "changes": changes,
                },
            )
        )
    
    await db.commit()
    await db.refresh(item)
    return await item_to_response(item, db)


@router.post("/{item_id}/execute", response_model=ComputationExecutionResponse)
async def execute_computation_node(
    problem_id: UUID,
    item_id: UUID,
    data: ComputationExecutionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Execute Python code for a COMPUTATION node.
    The executed source is either `data.code` or the node content.
    """
    problem = await verify_problem_access(problem_id, db, current_user, require_write=True)

    result = await db.execute(
        select(LibraryItem).where(
            LibraryItem.id == item_id, LibraryItem.problem_id == problem_id
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Library item not found")
    if item.kind != LibraryItemKind.COMPUTATION:
        raise HTTPException(
            status_code=400,
            detail="Only COMPUTATION nodes can execute Python",
        )

    source_code = (
        (data.code or "").strip()
        if data.code is not None
        else extract_python_source(item.content or "")
    )
    if not source_code:
        raise HTTPException(status_code=400, detail="No code to execute")

    try:
        execution = await execute_python_code(
            source_code, timeout_seconds=data.timeout_seconds
        )
    except PythonExecutionError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to execute computation: {exc}",
        ) from exc

    verification_status = (
        "pass" if execution.success else ("error" if execution.exit_code is None else "fail")
    )
    combined_logs = "\n\n".join(
        segment for segment in [execution.stdout, execution.stderr, execution.error or ""] if segment
    ).strip()
    now_iso = datetime.utcnow().isoformat() + "Z"
    run_entry = {
        "timestamp": now_iso,
        "status": verification_status,
        "stdout": execution.stdout,
        "stderr": execution.stderr,
        "error": execution.error,
        "logs": combined_logs,
        "exit_code": execution.exit_code,
        "duration_ms": execution.duration_ms,
    }

    previous_verification = item.verification if isinstance(item.verification, dict) else {}
    previous_history = previous_verification.get("history", [])
    history = [entry for entry in previous_history if isinstance(entry, dict)]
    history.append(run_entry)
    history = history[-20:]

    item.verification = {
        "method": "python",
        "status": verification_status,
        "logs": combined_logs,
        "stdout": execution.stdout,
        "stderr": execution.stderr,
        "error": execution.error,
        "exit_code": execution.exit_code,
        "duration_ms": execution.duration_ms,
        "executed_code": execution.executed_code,
        "last_run_at": now_iso,
        "run_count": len(history),
        "history": history,
    }
    if execution.success:
        item.status = LibraryItemStatus.VERIFIED
    elif item.status == LibraryItemStatus.VERIFIED:
        item.status = LibraryItemStatus.PROPOSED

    if execution.success:
        db.add(
            Activity(
                user_id=current_user.id,
                type=ActivityType.VERIFIED_LIBRARY,
                target_id=item.id,
                extra_data={
                    "problem_id": str(problem_id),
                    "problem_title": problem.title,
                    "item_title": item.title,
                    "execution_success": execution.success,
                    "exit_code": execution.exit_code,
                    "duration_ms": execution.duration_ms,
                    "changes": ["execution"],
                },
            )
        )

    await db.commit()

    return ComputationExecutionResponse(
        success=execution.success,
        stdout=execution.stdout,
        stderr=execution.stderr,
        error=execution.error,
        exit_code=execution.exit_code,
        duration_ms=execution.duration_ms,
        executed_code=execution.executed_code,
    )


@router.delete("/{item_id}", status_code=204)
async def delete_library_item(
    problem_id: UUID,
    item_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a library item."""
    await verify_problem_access(problem_id, db, current_user, require_write=True)
    
    result = await db.execute(
        select(LibraryItem).where(
            LibraryItem.id == item_id, LibraryItem.problem_id == problem_id
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Library item not found")
    
    await db.delete(item)
    await db.commit()


# --- Activity History Endpoint ---

@router.get("/{item_id}/activity", response_model=NodeActivityHistoryResponse)
async def get_node_activity_history(
    problem_id: UUID,
    item_id: UUID,
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """Get activity history for a library item (node)"""
    await verify_problem_access(problem_id, db, current_user)
    
    # Get the library item
    result = await db.execute(
        select(LibraryItem).where(
            LibraryItem.id == item_id, LibraryItem.problem_id == problem_id
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Library item not found")
    
    # Get activities related to this item
    result = await db.execute(
        select(Activity, User)
        .join(User, Activity.user_id == User.id)
        .where(Activity.target_id == item_id)
        .order_by(Activity.created_at.desc())
        .limit(limit)
    )
    activities = result.all()
    
    # Get comments as activities too
    result = await db.execute(
        select(Comment, User, Discussion)
        .join(User, Comment.author_id == User.id)
        .join(Discussion, Comment.discussion_id == Discussion.id)
        .where(Discussion.title == f"__item__{item_id}__")
        .order_by(Comment.created_at.desc())
        .limit(limit)
    )
    comments = result.all()
    
    # Build activity entries
    activity_entries = []
    
    # Add creation activity from item data
    authors = item.authors or []
    for author in authors:
        if author.get("type") == "human":
            # Try to get user info
            user_result = await db.execute(
                select(User).where(User.id == UUID(author["id"]))
            )
            user = user_result.scalar_one_or_none()
            activity_entries.append(NodeActivityEntry(
                id=f"create-{item.id}",
                type="created",
                user=AuthorInfo(
                    type="human",
                    id=author["id"],
                    name=author.get("name") or (user.username if user else "Unknown"),
                    avatar_url=user.avatar_url if user else None
                ),
                description=f"Created {item.kind.value.lower() if item.kind else 'item'}: {item.title}",
                timestamp=item.created_at,
                metadata={"kind": item.kind.value if item.kind else None}
            ))
        elif author.get("type") == "agent":
            activity_entries.append(NodeActivityEntry(
                id=f"create-agent-{item.id}",
                type="agent_generated",
                user=AuthorInfo(
                    type="agent",
                    id=author.get("id", "unknown"),
                    name=author.get("name") or "AI Agent",
                    avatar_url=None
                ),
                description=f"AI generated {item.kind.value.lower() if item.kind else 'item'}: {item.title}",
                timestamp=item.created_at,
                metadata={"kind": item.kind.value if item.kind else None}
            ))
    
    # Add activities from Activity table
    for activity, user in activities:
        type_map = {
            ActivityType.PUBLISHED_LIBRARY: "published",
            ActivityType.UPDATED_LIBRARY: "updated",
            ActivityType.VERIFIED_LIBRARY: "verified",
            ActivityType.AGENT_GENERATED: "agent_generated",
        }
        
        activity_entries.append(NodeActivityEntry(
            id=str(activity.id),
            type=type_map.get(activity.type, "updated"),
            user=AuthorInfo(
                type="human",
                id=str(user.id),
                name=user.username,
                avatar_url=user.avatar_url
            ),
            description=activity.extra_data.get("description") or _get_activity_description(activity),
            timestamp=activity.created_at,
            metadata=activity.extra_data
        ))
    
    # Add comments as activities
    for comment, user, _ in comments:
        activity_entries.append(NodeActivityEntry(
            id=f"comment-{comment.id}",
            type="commented",
            user=AuthorInfo(
                type="human",
                id=str(user.id),
                name=user.username,
                avatar_url=user.avatar_url
            ),
            description=f"Commented: {comment.content[:100]}{'...' if len(comment.content) > 100 else ''}",
            timestamp=comment.created_at,
            metadata={"comment_id": str(comment.id)}
        ))
    
    # Sort by timestamp descending
    activity_entries.sort(key=lambda x: x.timestamp, reverse=True)
    
    return NodeActivityHistoryResponse(
        node_id=item_id,
        activities=activity_entries[:limit],
        total=len(activity_entries)
    )


def _get_activity_description(activity: Activity) -> str:
    """Generate a human-readable description for an activity"""
    descriptions = {
        ActivityType.PUBLISHED_LIBRARY: "Published to library",
        ActivityType.UPDATED_LIBRARY: f"Updated {', '.join(activity.extra_data.get('changes', ['item']))}" if activity.extra_data else "Updated item",
        ActivityType.VERIFIED_LIBRARY: "Verified with Lean",
        ActivityType.AGENT_GENERATED: "Generated by AI",
    }
    return descriptions.get(activity.type, "Modified item")


# --- Comment Schemas ---
class ItemCommentCreate(BaseModel):
    content: str


class ItemCommentAuthor(BaseModel):
    id: str
    username: str
    avatar_url: str | None = None


class ItemCommentResponse(BaseModel):
    id: str
    content: str
    author: ItemCommentAuthor
    created_at: datetime
    parent_id: str | None = None


# --- Comments on Library Items ---

async def get_or_create_item_discussion(
    item: LibraryItem,
    problem: Problem,
    db: AsyncSession,
) -> Discussion:
    """Get or create a discussion for a library item"""
    # Look for existing discussion for this item
    result = await db.execute(
        select(Discussion).where(
            Discussion.problem_id == problem.id,
            Discussion.title == f"__item__{item.id}__"  # Special prefix for auto-discussions
        )
    )
    discussion = result.scalar_one_or_none()
    
    if not discussion:
        # Create a hidden discussion for this item
        discussion = Discussion(
            title=f"__item__{item.id}__",
            content=f"Comments for {item.title}",
            problem_id=problem.id,
            author_id=problem.author_id,
        )
        db.add(discussion)
        await db.commit()
        await db.refresh(discussion)
    
    return discussion


@router.get("/{item_id}/comments", response_model=list[ItemCommentResponse])
async def get_item_comments(
    problem_id: UUID,
    item_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """Get comments for a library item"""
    problem = await verify_problem_access(problem_id, db, current_user)
    
    # Get the library item
    result = await db.execute(
        select(LibraryItem).where(
            LibraryItem.id == item_id, LibraryItem.problem_id == problem_id
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Library item not found")
    
    # Get the discussion for this item
    discussion = await get_or_create_item_discussion(item, problem, db)
    
    # Get all comments for this discussion
    result = await db.execute(
        select(Comment)
        .where(Comment.discussion_id == discussion.id)
        .options(selectinload(Comment.author))
        .order_by(Comment.created_at)
    )
    comments = result.scalars().all()
    
    return [
        ItemCommentResponse(
            id=str(c.id),
            content=c.content,
            author=ItemCommentAuthor(
                id=str(c.author.id),
                username=c.author.username,
                avatar_url=c.author.avatar_url,
            ),
            created_at=c.created_at,
            parent_id=str(c.parent_id) if c.parent_id else None,
        )
        for c in comments
    ]


@router.post("/{item_id}/comments", response_model=ItemCommentResponse)
async def create_item_comment(
    problem_id: UUID,
    item_id: UUID,
    data: ItemCommentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a comment on a library item"""
    problem = await verify_problem_access(problem_id, db, current_user)
    
    # Get the library item
    result = await db.execute(
        select(LibraryItem).where(
            LibraryItem.id == item_id, LibraryItem.problem_id == problem_id
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Library item not found")
    
    # Get or create discussion for this item
    discussion = await get_or_create_item_discussion(item, problem, db)
    
    # Create the comment
    comment = Comment(
        content=data.content.strip(),
        author_id=current_user.id,
        discussion_id=discussion.id,
    )
    db.add(comment)
    await db.flush()
    
    # Log activity for comment
    db.add(
        Activity(
            user_id=current_user.id,
            type=ActivityType.COMMENTED_LIBRARY,
            target_id=item.id,
            extra_data={
                "problem_id": str(problem_id),
                "comment_id": str(comment.id),
                "item_title": item.title,
            },
        )
    )
    
    await db.commit()
    await db.refresh(comment)
    
    return ItemCommentResponse(
        id=str(comment.id),
        content=comment.content,
        author=ItemCommentAuthor(
            id=str(current_user.id),
            username=current_user.username,
            avatar_url=current_user.avatar_url,
        ),
        created_at=comment.created_at,
        parent_id=None,
    )
