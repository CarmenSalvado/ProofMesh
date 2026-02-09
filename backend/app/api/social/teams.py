"""Team management endpoints."""

from __future__ import annotations

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.team import Team, TeamMember, TeamProblem, TeamRole
from app.models.activity import Activity, ActivityType
from app.models.notification import Notification, NotificationType
from app.api.deps import get_current_user
from app.schemas.social import (
    TeamCreate,
    TeamUpdate,
    TeamResponse,
    TeamDetailResponse,
    TeamListResponse,
    TeamMemberResponse,
    TeamProblemResponse,
    TeamInvite,
    TeamAddProblem,
    TeamMemberRoleUpdate,
)
from .utils import get_follow_sets, build_social_user

router = APIRouter()


@router.get("/teams", response_model=TeamListResponse)
async def list_teams(
    my_teams: bool = False,
    limit: int = Query(default=30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List teams."""
    if my_teams:
        query = (
            select(Team)
            .join(TeamMember, TeamMember.team_id == Team.id)
            .where(TeamMember.user_id == current_user.id)
        )
    else:
        query = select(Team).where(Team.is_public == True)
    
    query = query.order_by(Team.created_at.desc()).limit(limit)
    result = await db.execute(query)
    teams = result.scalars().all()
    
    payload = []
    for t in teams:
        member_count_result = await db.execute(
            select(TeamMember).where(TeamMember.team_id == t.id)
        )
        member_count = len(member_count_result.scalars().all())
        
        problem_count_result = await db.execute(
            select(TeamProblem).where(TeamProblem.team_id == t.id)
        )
        problem_count = len(problem_count_result.scalars().all())
        
        payload.append(TeamResponse(
            id=t.id,
            name=t.name,
            slug=t.slug,
            description=t.description,
            is_public=t.is_public,
            avatar_url=t.avatar_url,
            member_count=member_count,
            problem_count=problem_count,
            created_at=t.created_at,
            updated_at=t.updated_at,
        ))
    
    return TeamListResponse(teams=payload, total=len(payload))


@router.post("/teams", response_model=TeamResponse)
async def create_team(
    data: TeamCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new team."""
    existing = await db.execute(select(Team).where(Team.slug == data.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Team slug already exists")
    
    team = Team(
        name=data.name,
        slug=data.slug,
        description=data.description,
        is_public=data.is_public,
    )
    db.add(team)
    await db.flush()
    
    member = TeamMember(
        team_id=team.id,
        user_id=current_user.id,
        role=TeamRole.OWNER,
    )
    db.add(member)
    await db.commit()
    await db.refresh(team)
    
    return TeamResponse(
        id=team.id,
        name=team.name,
        slug=team.slug,
        description=team.description,
        is_public=team.is_public,
        avatar_url=team.avatar_url,
        member_count=1,
        problem_count=0,
        created_at=team.created_at,
        updated_at=team.updated_at,
    )


@router.get("/teams/{slug}", response_model=TeamDetailResponse)
async def get_team(
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get team details."""
    result = await db.execute(select(Team).where(Team.slug == slug))
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    members_result = await db.execute(
        select(TeamMember).options(selectinload(TeamMember.user))
        .where(TeamMember.team_id == team.id)
    )
    members = members_result.scalars().all()
    
    following_ids, follower_ids = await get_follow_sets(db, current_user.id)
    
    member_payload = [
        TeamMemberResponse(
            id=m.id,
            user=build_social_user(m.user, following_ids, follower_ids),
            role=m.role.value,
            joined_at=m.joined_at,
        )
        for m in members
    ]
    
    team_problems_result = await db.execute(
        select(TeamProblem)
        .options(selectinload(TeamProblem.problem), selectinload(TeamProblem.added_by))
        .where(TeamProblem.team_id == team.id)
        .order_by(TeamProblem.added_at.desc())
    )
    team_problems = team_problems_result.scalars().all()
    problem_payload: list[TeamProblemResponse] = []
    for tp in team_problems:
        if not tp.problem:
            continue
        problem_payload.append(
            TeamProblemResponse(
                problem_id=tp.problem_id,
                title=tp.problem.title,
                visibility=tp.problem.visibility.value,
                added_at=tp.added_at,
                added_by=build_social_user(tp.added_by, following_ids, follower_ids)
                if tp.added_by
                else None,
            )
        )

    return TeamDetailResponse(
        id=team.id,
        name=team.name,
        slug=team.slug,
        description=team.description,
        is_public=team.is_public,
        avatar_url=team.avatar_url,
        member_count=len(members),
        problem_count=len(problem_payload),
        members=member_payload,
        problems=problem_payload,
        created_at=team.created_at,
        updated_at=team.updated_at,
    )


@router.post("/teams/{slug}/members")
async def invite_team_member(
    slug: str,
    data: TeamInvite,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Invite a user to a team (admin/owner only) without auto-joining."""
    team_result = await db.execute(select(Team).where(Team.slug == slug))
    team = team_result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    member_result = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team.id,
            TeamMember.user_id == current_user.id,
        )
    )
    current_member = member_result.scalar_one_or_none()
    if not current_member or current_member.role not in [TeamRole.OWNER, TeamRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized to invite members")
    
    existing_member = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team.id,
            TeamMember.user_id == data.user_id,
        )
    )
    if existing_member.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User already a member")
    
    existing_invite = await db.execute(
        select(Notification).where(
            Notification.user_id == data.user_id,
            Notification.type == NotificationType.TEAM_INVITE,
            Notification.target_id == team.id,
            Notification.is_read == False,
        )
    )
    if existing_invite.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Invitation already pending")
    
    role = TeamRole.ADMIN if data.role == "admin" else TeamRole.MEMBER
    notification = Notification(
        user_id=data.user_id,
        type=NotificationType.TEAM_INVITE,
        title=f"You've been invited to join {team.name}",
        actor_id=current_user.id,
        target_type="team",
        target_id=team.id,
        extra_data={"role": data.role or "member", "team_slug": team.slug},
    )
    db.add(notification)
    await db.flush()

    db.add(
        Activity(
            user_id=current_user.id,
            type=ActivityType.TEAM_INVITE,
            target_id=data.user_id,
            extra_data={
                "team_id": str(team.id),
                "team_name": team.name,
                "team_slug": team.slug,
                "invitee_id": str(data.user_id),
                "role": data.role or "member",
                "notification_id": str(notification.id),
            },
        )
    )
    
    await db.commit()
    return {"status": "invited", "notification_id": notification.id}


@router.post("/teams/{slug}/invites/{notification_id}/accept")
async def accept_team_invite(
    slug: str,
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Accept a pending team invitation and join the team."""
    team_result = await db.execute(select(Team).where(Team.slug == slug))
    team = team_result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    notif_result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
            Notification.type == NotificationType.TEAM_INVITE,
            Notification.target_id == team.id,
            Notification.is_read == False,
        )
    )
    notification = notif_result.scalar_one_or_none()
    if not notification:
        raise HTTPException(status_code=404, detail="Invitation not found or already handled")

    # Ensure not already member
    existing_member = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team.id,
            TeamMember.user_id == current_user.id,
        )
    )
    if existing_member.scalar_one_or_none():
        notification.is_read = True
        await db.commit()
        return {"status": "already_member"}

    role = TeamRole.ADMIN if (notification.extra_data or {}).get("role") == "admin" else TeamRole.MEMBER
    new_member = TeamMember(team_id=team.id, user_id=current_user.id, role=role)
    db.add(new_member)

    notification.is_read = True

    db.add(
        Activity(
            user_id=current_user.id,
            type=ActivityType.TEAM_JOIN,
            target_id=team.id,
            extra_data={
                "team_id": str(team.id),
                "team_name": team.name,
                "team_slug": team.slug,
                "role": role.value,
            },
        )
    )

    await db.commit()
    return {"status": "accepted", "role": role.value}


@router.post("/teams/{slug}/invites/{notification_id}/decline")
async def decline_team_invite(
    slug: str,
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Decline a pending team invitation."""
    team_result = await db.execute(select(Team).where(Team.slug == slug))
    team = team_result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    notif_result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
            Notification.type == NotificationType.TEAM_INVITE,
            Notification.target_id == team.id,
            Notification.is_read == False,
        )
    )
    notification = notif_result.scalar_one_or_none()
    if not notification:
        raise HTTPException(status_code=404, detail="Invitation not found or already handled")

    notification.is_read = True
    await db.commit()
    return {"status": "declined"}


@router.post("/teams/{slug}/problems")
async def add_team_problem(
    slug: str,
    data: TeamAddProblem,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a problem to a team."""
    team_result = await db.execute(select(Team).where(Team.slug == slug))
    team = team_result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    member_result = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team.id,
            TeamMember.user_id == current_user.id,
        )
    )
    if not member_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a team member")
    
    existing = await db.execute(
        select(TeamProblem).where(
            TeamProblem.team_id == team.id,
            TeamProblem.problem_id == data.problem_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Problem already in team")
    
    team_problem = TeamProblem(
        team_id=team.id,
        problem_id=data.problem_id,
        added_by_id=current_user.id,
    )
    db.add(team_problem)
    await db.commit()
    return {"status": "added"}


@router.patch("/teams/{slug}", response_model=TeamResponse)
async def update_team(
    slug: str,
    data: TeamUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update team settings (admin/owner only)."""
    team_result = await db.execute(select(Team).where(Team.slug == slug))
    team = team_result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    member_result = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team.id,
            TeamMember.user_id == current_user.id,
        )
    )
    current_member = member_result.scalar_one_or_none()
    if not current_member or current_member.role not in [TeamRole.OWNER, TeamRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized to update team")
    
    if data.name is not None:
        team.name = data.name
    if data.description is not None:
        team.description = data.description
    if data.is_public is not None:
        team.is_public = data.is_public
    if data.avatar_url is not None:
        team.avatar_url = data.avatar_url
    
    await db.commit()
    await db.refresh(team)
    
    member_count_result = await db.execute(
        select(TeamMember).where(TeamMember.team_id == team.id)
    )
    member_count = len(member_count_result.scalars().all())
    
    problem_count_result = await db.execute(
        select(TeamProblem).where(TeamProblem.team_id == team.id)
    )
    problem_count = len(problem_count_result.scalars().all())
    
    return TeamResponse(
        id=team.id,
        name=team.name,
        slug=team.slug,
        description=team.description,
        is_public=team.is_public,
        avatar_url=team.avatar_url,
        member_count=member_count,
        problem_count=problem_count,
        created_at=team.created_at,
        updated_at=team.updated_at,
    )


@router.delete("/teams/{slug}")
async def delete_team(
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a team (owner only)."""
    team_result = await db.execute(select(Team).where(Team.slug == slug))
    team = team_result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    member_result = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team.id,
            TeamMember.user_id == current_user.id,
        )
    )
    current_member = member_result.scalar_one_or_none()
    if not current_member or current_member.role != TeamRole.OWNER:
        raise HTTPException(status_code=403, detail="Only the owner can delete the team")
    
    members_result = await db.execute(select(TeamMember).where(TeamMember.team_id == team.id))
    for member in members_result.scalars().all():
        await db.delete(member)
    
    problems_result = await db.execute(select(TeamProblem).where(TeamProblem.team_id == team.id))
    for problem in problems_result.scalars().all():
        await db.delete(problem)
    
    await db.delete(team)
    await db.commit()
    
    return {"status": "deleted"}


@router.delete("/teams/{slug}/members/{user_id}")
async def remove_team_member(
    slug: str,
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a member from a team (admin/owner only)."""
    team_result = await db.execute(select(Team).where(Team.slug == slug))
    team = team_result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    current_member_result = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team.id,
            TeamMember.user_id == current_user.id,
        )
    )
    current_member = current_member_result.scalar_one_or_none()
    if not current_member or current_member.role not in [TeamRole.OWNER, TeamRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized to remove members")
    
    target_member_result = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team.id,
            TeamMember.user_id == user_id,
        )
    )
    target_member = target_member_result.scalar_one_or_none()
    if not target_member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    if target_member.role == TeamRole.OWNER:
        raise HTTPException(status_code=400, detail="Cannot remove the team owner")
    
    await db.delete(target_member)
    await db.commit()
    
    return {"status": "removed"}


@router.patch("/teams/{slug}/members/{user_id}/role")
async def update_team_member_role(
    slug: str,
    user_id: UUID,
    data: TeamMemberRoleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a team member role (owner/admin with restrictions)."""
    team_result = await db.execute(select(Team).where(Team.slug == slug))
    team = team_result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    current_member_result = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team.id,
            TeamMember.user_id == current_user.id,
        )
    )
    current_member = current_member_result.scalar_one_or_none()
    if not current_member or current_member.role not in [TeamRole.OWNER, TeamRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized to update member roles")

    target_member_result = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team.id,
            TeamMember.user_id == user_id,
        )
    )
    target_member = target_member_result.scalar_one_or_none()
    if not target_member:
        raise HTTPException(status_code=404, detail="Member not found")
    if target_member.role == TeamRole.OWNER:
        raise HTTPException(status_code=400, detail="Cannot change role of the team owner")

    if data.role not in {"admin", "member"}:
        raise HTTPException(status_code=400, detail="Role must be admin or member")
    next_role = TeamRole.ADMIN if data.role == "admin" else TeamRole.MEMBER

    # Admins can moderate members but cannot promote/demote admins.
    if current_member.role == TeamRole.ADMIN:
        if target_member.role != TeamRole.MEMBER:
            raise HTTPException(status_code=403, detail="Admins cannot modify admin roles")
        if next_role != TeamRole.MEMBER:
            raise HTTPException(status_code=403, detail="Admins cannot promote members to admin")

    if target_member.role == next_role:
        return {"status": "unchanged", "role": target_member.role.value}

    target_member.role = next_role
    await db.commit()
    return {"status": "updated", "role": target_member.role.value}


@router.post("/teams/{slug}/leave")
async def leave_team(
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Leave a team."""
    team_result = await db.execute(select(Team).where(Team.slug == slug))
    team = team_result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    member_result = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team.id,
            TeamMember.user_id == current_user.id,
        )
    )
    member = member_result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=400, detail="Not a team member")
    
    if member.role == TeamRole.OWNER:
        raise HTTPException(status_code=400, detail="Owner cannot leave the team. Transfer ownership or delete the team.")
    
    await db.delete(member)
    await db.commit()
    
    return {"status": "left"}


@router.delete("/teams/{slug}/problems/{problem_id}")
async def remove_team_problem(
    slug: str,
    problem_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a problem from a team (member who added or admin/owner)."""
    team_result = await db.execute(select(Team).where(Team.slug == slug))
    team = team_result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    member_result = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team.id,
            TeamMember.user_id == current_user.id,
        )
    )
    current_member = member_result.scalar_one_or_none()
    if not current_member:
        raise HTTPException(status_code=403, detail="Not a team member")
    
    team_problem_result = await db.execute(
        select(TeamProblem).where(
            TeamProblem.team_id == team.id,
            TeamProblem.problem_id == problem_id,
        )
    )
    team_problem = team_problem_result.scalar_one_or_none()
    if not team_problem:
        raise HTTPException(status_code=404, detail="Problem not in team")
    
    is_admin = current_member.role in [TeamRole.OWNER, TeamRole.ADMIN]
    is_adder = team_problem.added_by_id == current_user.id
    if not (is_admin or is_adder):
        raise HTTPException(status_code=403, detail="Not authorized to remove this problem")
    
    await db.delete(team_problem)
    await db.commit()
    
    return {"status": "removed"}
