"""Team management — list members, change roles, remove members.

The /v1/admin/orgs/{id}/users endpoint exists for super-admins; this
file is the per-org analogue: scoped to the caller's own org and
gated to admins/owners for write actions.
"""

from __future__ import annotations

import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.auth.session import hash_refresh_token, verify_access_token
from hailscout_api.core import AuthenticationError, AuthorizationError, get_logger
from hailscout_api.db.models.org import Seat, User, UserSession
from hailscout_api.db.models.password_auth import UserToken
from hailscout_api.db.session import get_db_session
from hailscout_api.services.audit import write_event
from hailscout_api.services.password_reset_email import send_password_reset

logger = get_logger(__name__)
router = APIRouter()


class TeamMember(BaseModel):
    id: str
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: str
    is_super_admin: bool
    is_disabled: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class TeamRoleUpdate(BaseModel):
    role: str  # owner / admin / member


class TeamNameUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None


class TeamEmailUpdate(BaseModel):
    email: EmailStr


class TeamActiveUpdate(BaseModel):
    active: bool


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


@router.patch("/team/{user_id}/name", response_model=TeamMember)
async def update_team_name(
    request: Request,
    user_id: str,
    body: TeamNameUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> User:
    """Set a teammate's display name.

    Admins/owners may edit anyone in their org; any user may edit their own
    name. Empty strings clear the field (back to the email-local-part
    fallback in the UI).
    """
    me = await _resolve_user(request, session)

    target = (
        await session.execute(
            select(User).where(and_(User.id == user_id, User.org_id == me.org_id)),
        )
    ).scalars().first()
    if target is None:
        raise HTTPException(status_code=404, detail="Member not found")

    is_admin = me.role in {"owner", "admin"} or me.is_super_admin
    if not is_admin and me.id != target.id:
        raise AuthorizationError("You can only edit your own name")

    prev = {"first": target.first_name, "last": target.last_name}
    target.first_name = (body.first_name or "").strip() or None
    target.last_name = (body.last_name or "").strip() or None
    await session.commit()
    await session.refresh(target)
    await write_event(
        session,
        action="team.name_changed",
        org_id=me.org_id,
        user_id=me.id,
        subject_type="user",
        subject_id=target.id,
        metadata={
            "from": prev,
            "to": {"first": target.first_name, "last": target.last_name},
        },
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


@router.patch("/team/{user_id}/email", response_model=TeamMember)
async def update_team_email(
    request: Request,
    user_id: str,
    body: TeamEmailUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> User:
    """Change a teammate's email. Admin/owner only.

    The new address must not already belong to another account. For SSO
    users it becomes the address they sign in with (their linked provider
    subject still resolves them); for password users it's their login id.
    """
    me = await _resolve_user(request, session)
    _require_admin(me)

    target = (
        await session.execute(
            select(User).where(and_(User.id == user_id, User.org_id == me.org_id)),
        )
    ).scalars().first()
    if target is None:
        raise HTTPException(status_code=404, detail="Member not found")

    new_email = str(body.email).lower().strip()
    if new_email != target.email:
        clash = (
            await session.execute(select(User).where(User.email == new_email))
        ).scalars().first()
        if clash is not None:
            raise HTTPException(status_code=409, detail="That email is already in use.")

    prev = target.email
    target.email = new_email
    await session.commit()
    await session.refresh(target)
    await write_event(
        session,
        action="team.email_changed",
        org_id=me.org_id,
        user_id=me.id,
        subject_type="user",
        subject_id=target.id,
        metadata={"from": prev, "to": new_email},
    )
    return target


@router.post("/team/{user_id}/send-password-reset")
async def send_team_password_reset(
    request: Request,
    user_id: str,
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, bool | str]:
    """Email a teammate a link to set or reset their password. Admin/owner
    only. Doubles as initial-password setup for members who've only ever
    signed in with Google/Microsoft. The link is valid for 24 hours."""
    me = await _resolve_user(request, session)
    _require_admin(me)

    target = (
        await session.execute(
            select(User).where(and_(User.id == user_id, User.org_id == me.org_id)),
        )
    ).scalars().first()
    if target is None:
        raise HTTPException(status_code=404, detail="Member not found")
    if target.is_disabled:
        raise HTTPException(
            status_code=409, detail="Reactivate the account before sending a reset."
        )

    raw = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    session.add(
        UserToken(
            id=f"utk_{secrets.token_hex(12)}",
            user_id=target.id,
            purpose="password_reset",
            token_hash=hash_refresh_token(raw),
            expires_at=now + timedelta(hours=24),
            created_at=now,
        )
    )
    await session.commit()

    web_base = os.environ.get("WEB_BASE_URL", "https://hailscout.net").rstrip("/")
    try:
        await send_password_reset(target.email, f"{web_base}/reset-password?token={raw}")
    except Exception as exc:  # email misconfigured (e.g. RESEND_API_KEY unset)
        logger.warning("team.password_reset_send_failed", error=str(exc))
        raise HTTPException(
            status_code=502,
            detail="Couldn't send the email — check email is configured.",
        ) from exc

    await write_event(
        session,
        action="team.password_reset_sent",
        org_id=me.org_id,
        user_id=me.id,
        subject_type="user",
        subject_id=target.id,
        metadata={"email": target.email},
    )
    return {"ok": True, "message": f"Sent a password setup link to {target.email}."}


@router.patch("/team/{user_id}/active", response_model=TeamMember)
async def set_team_active(
    request: Request,
    user_id: str,
    body: TeamActiveUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> User:
    """Enable or disable a teammate's account. Admin/owner only.

    Disabling blocks sign-in immediately (the auth layer rejects disabled
    users) and revokes their live sessions, so they're signed out at once —
    without deleting the row (keeps audit/history intact). Can't disable
    yourself or the last active owner.
    """
    me = await _resolve_user(request, session)
    _require_admin(me)

    target = (
        await session.execute(
            select(User).where(and_(User.id == user_id, User.org_id == me.org_id)),
        )
    ).scalars().first()
    if target is None:
        raise HTTPException(status_code=404, detail="Member not found")
    if target.id == me.id:
        raise HTTPException(status_code=409, detail="You can't deactivate your own account.")

    if not body.active and target.role == "owner":
        owners = (
            await session.execute(
                select(User).where(and_(User.org_id == me.org_id, User.role == "owner")),
            )
        ).scalars().all()
        if not any(o.id != target.id and not o.is_disabled for o in owners):
            raise HTTPException(
                status_code=409, detail="Can't deactivate the last active owner."
            )

    target.is_disabled = not body.active
    if target.is_disabled:
        now = datetime.now(timezone.utc)
        live = (
            await session.execute(
                select(UserSession).where(
                    and_(
                        UserSession.user_id == target.id,
                        UserSession.revoked_at.is_(None),
                    ),
                ),
            )
        ).scalars()
        for s in live:
            s.revoked_at = now
    await session.commit()
    await session.refresh(target)
    await write_event(
        session,
        action="team.active_changed",
        org_id=me.org_id,
        user_id=me.id,
        subject_type="user",
        subject_id=target.id,
        metadata={"active": body.active},
    )
    return target
