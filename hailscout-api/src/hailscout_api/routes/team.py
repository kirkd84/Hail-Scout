"""Team management — list members, change roles, remove members.

The /v1/admin/orgs/{id}/users endpoint exists for super-admins; this
file is the per-org analogue: scoped to the caller's own org and
gated to admins/owners for write actions.
"""

from __future__ import annotations

import secrets
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.auth.session import verify_access_token
from hailscout_api.core import AuthenticationError, AuthorizationError, get_logger
from hailscout_api.db.models.org import Seat, User
from hailscout_api.db.session import get_db_session
from hailscout_api.services.audit import write_event

logger = get_logger(__name__)
router = APIRouter()


class TeamMember(BaseModel):
    id: str
    email: str
    role: str
    is_super_admin: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TeamRoleUpdate(BaseModel):
    role: str  # owner / admin / member


class TeamInvite(BaseModel):
    email: EmailStr
    role: str = "member"


VALID_ROLES = {"owner", "admin", "member"}


async def _resolve_user(request: Request, session: AsyncSession) -> User:
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise AuthenticationError("Missing Authorization header")
    try:
        scheme, token = auth_header.split(" ", 1)
    except ValueError as exc:
        raise AuthenticationError("Invalid Authorization header format") from exc
    if scheme.lower() != "bearer":
        raise AuthenticationError("Only Bearer tokens supported")

    claims = verify_access_token(token)
    user_id = claims.get("sub")
    if not user_id:
        raise AuthenticationError("JWT missing sub claim")

    user = (
        await session.execute(select(User).where(User.id == user_id))
    ).scalars().first()
    if not user:
        raise AuthenticationError("User not found")
    return user


def _require_admin(user: User) -> None:
    if user.is_super_admin:
        return
    if user.role in {"owner", "admin"}:
        return
    raise AuthorizationError("Admin or owner role required")


@router.get("/team", response_model=list[TeamMember])
async def list_team_members(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> list[User]:
    """List all members in the caller's org."""
    user = await _resolve_user(request, session)
    rows = (
        await session.execute(
            select(User)
            .where(User.org_id == user.org_id)
            .order_by(User.created_at.asc()),
        )
    ).scalars().all()
    return list(rows)


@router.patch("/team/{user_id}/role", response_model=TeamMember)
async def update_team_role(
    request: Request,
    user_id: str,
    body: TeamRoleUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> User:
    """Change a teammate's role within the org."""
    me = await _resolve_user(request, session)
    _require_admin(me)

    if body.role not in VALID_ROLES:
        raise HTTPException(status_code=422, detail=f"Invalid role: {body.role}")

    target = (
        await session.execute(
            select(User).where(
                and_(User.id == user_id, User.org_id == me.org_id),
            ),
        )
    ).scalars().first()
    if target is None:
        raise HTTPException(status_code=404, detail="Member not found")

    # Prevent the last owner from being demoted
    if target.role == "owner" and body.role != "owner":
        owners = (
            await session.execute(
                select(User).where(
                    and_(User.org_id == me.org_id, User.role == "owner"),
                ),
            )
        ).scalars().all()
        if len(owners) <= 1:
            raise HTTPException(status_code=409, detail="Cannot demote the last owner")

    prev_role = target.role
    target.role = body.role
    await session.commit()
    await session.refresh(target)
    await write_event(
        session,
        action="team.role_changed",
        org_id=me.org_id,
        user_id=me.id,
        subject_type="user",
        subject_id=target.id,
        metadata={"from": prev_role, "to": target.role},
    )
    return target


@router.delete("/team/{user_id}")
async def remove_team_member(
    request: Request,
    user_id: str,
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    """Remove a teammate from the org. Owners-only for safety."""
    me = await _resolve_user(request, session)
    if me.role != "owner" and not me.is_super_admin:
        raise AuthorizationError("Owner role required")

    target = (
        await session.execute(
            select(User).where(
                and_(User.id == user_id, User.org_id == me.org_id),
            ),
        )
    ).scalars().first()
    if target is None:
        raise HTTPException(status_code=404, detail="Member not found")

    if target.id == me.id:
        raise HTTPException(status_code=409, detail="Cannot remove yourself")
    if target.role == "owner":
        owners = (
            await session.execute(
                select(User).where(
                    and_(User.org_id == me.org_id, User.role == "owner"),
                ),
            )
        ).scalars().all()
        if len(owners) <= 1:
            raise HTTPException(status_code=409, detail="Cannot remove the last owner")

    await session.delete(target)
    await session.commit()
    await write_event(
        session,
        action="team.member_removed",
        org_id=me.org_id,
        user_id=me.id,
        subject_type="user",
        subject_id=target.id,
        metadata={"email": target.email, "role": target.role},
    )
    return Response(status_code=204)


@router.post("/team/invite", response_model=TeamMember, status_code=201)
async def add_team_member(
    request: Request,
    body: TeamInvite,
    session: AsyncSession = Depends(get_db_session),
) -> User:
    """Add a teammate by email.

    We provision the account immediately (pre-staged, exactly like a
    super-admin-created org admin): a ``users`` row with a placeholder
    ``auth_subject`` that links to the real Google/Microsoft identity the
    first time that email signs in. No invite email needed — they just sign
    in with the matching work account. Idempotent for an email already on
    this team; rejected if the email belongs to another workspace.
    """
    me = await _resolve_user(request, session)
    _require_admin(me)
    if body.role not in VALID_ROLES:
        raise HTTPException(status_code=422, detail=f"Invalid role: {body.role}")

    email = str(body.email).lower()
    existing = (
        await session.execute(select(User).where(User.email == email))
    ).scalars().first()
    if existing is not None:
        if existing.org_id != me.org_id:
            raise HTTPException(
                status_code=409,
                detail="That email already belongs to another HailScout workspace.",
            )
        # Already on this team — idempotent.
        return existing

    member = User(
        id=f"usr_{secrets.token_urlsafe(16)}",
        email=email,
        org_id=me.org_id,
        role=body.role,
        is_super_admin=False,
        auth_subject=f"pending_{secrets.token_urlsafe(8)}",
    )
    session.add(member)
    await session.flush()
    session.add(Seat(org_id=me.org_id, user_id=member.id))
    await session.commit()
    await session.refresh(member)

    await write_event(
        session,
        action="team.member_added",
        org_id=me.org_id,
        user_id=me.id,
        subject_type="user",
        subject_id=member.id,
        metadata={"email": email, "role": body.role},
    )
    logger.info(
        "team.member_added",
        org_id=me.org_id, email=email, role=body.role, added_by=me.id,
    )
    return member
