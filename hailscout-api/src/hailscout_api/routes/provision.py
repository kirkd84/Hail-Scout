"""External HR provisioning API.

Machine-to-machine endpoints, mounted at ``/api/provision`` (NOTE: not under the
``/v1`` first-party prefix). An outside HR system calls these with a static
``X-API-Key`` to create and disable rep accounts in one specific tenant.

Auth + org targeting live in :mod:`hailscout_api.auth.hr_provision`: the key maps
to exactly one org (``HR_PROVISION_ORG_ID``). Callers MAY echo that org back in
the request body, but a mismatch is rejected — a key never reaches another tenant.

Provisioned users have NO password. Identity still comes from Google/Microsoft
OAuth: we pre-stage the ``users`` row with a placeholder ``auth_subject``
(``pending_*``) + a seat, and the real provider subject is linked the first time
that email signs in — the same reconcile model the rest of the app uses.
"""

from __future__ import annotations

import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.auth.hr_provision import require_provision_key
from hailscout_api.core import get_logger
from hailscout_api.db.models.org import Organization, Seat, User, UserSession
from hailscout_api.db.session import get_db_session
from hailscout_api.services.audit import write_event

logger = get_logger(__name__)
router = APIRouter(prefix="/api/provision", tags=["provisioning"])


# ── Schemas ──────────────────────────────────────────────────────────────────


class ProvisionUserRequest(BaseModel):
    email: EmailStr
    firstName: str | None = None
    lastName: str | None = None
    phone: str | None = None
    # Optional echo of the target org. When present it MUST equal the org the
    # API key is bound to (HR_PROVISION_ORG_ID); otherwise we 403.
    org_id: str | None = None


class ProvisionUserResponse(BaseModel):
    ok: bool = True
    userId: str


class DisableUserRequest(BaseModel):
    email: EmailStr
    org_id: str | None = None


class DisableUserResponse(BaseModel):
    ok: bool = True


class UserStatusResponse(BaseModel):
    email: str
    exists: bool
    active: bool


# ── Helpers ──────────────────────────────────────────────────────────────────


def _full_name(first: str | None, last: str | None) -> str | None:
    name = " ".join(p.strip() for p in (first, last) if p and p.strip())
    return name or None


def _check_body_org(body_org_id: str | None, target_org_id: str) -> None:
    """Reject a body ``org_id`` that disagrees with the key's bound org."""
    if body_org_id is not None and body_org_id.strip() and body_org_id != target_org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="org_id does not match this API key's organization.",
        )


# ── Endpoints ────────────────────────────────────────────────────────────────


@router.post("/user", response_model=ProvisionUserResponse)
async def provision_user(
    body: ProvisionUserRequest,
    org_id: str = Depends(require_provision_key),
    session: AsyncSession = Depends(get_db_session),
) -> ProvisionUserResponse:
    """Create (or find) a rep account in the target org.

    Idempotent on email *within the org*: if a user with that email already
    exists there, return 200 with the existing id and do nothing else. New
    users are pre-staged with a placeholder ``auth_subject`` + a seat; they sign
    in later via Google/Microsoft OAuth (there is no password).
    """
    _check_body_org(body.org_id, org_id)
    email = str(body.email).strip().lower()

    # Confirm the target org exists — a misconfigured HR_PROVISION_ORG_ID
    # should fail loudly rather than create an orphaned user row.
    org = (
        await session.execute(select(Organization).where(Organization.id == org_id))
    ).scalar_one_or_none()
    if org is None:
        logger.error("provision.user.org_missing", org_id=org_id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="provisioning not configured",
        )

    # Idempotency: reuse an existing account in this org.
    existing = (
        await session.execute(
            select(User).where(User.org_id == org_id, User.email == email)
        )
    ).scalar_one_or_none()
    if existing is not None:
        logger.info(
            "provision.user.exists", org_id=org_id, user_id=existing.id, email=email
        )
        return ProvisionUserResponse(ok=True, userId=existing.id)

    # Pre-stage the user with a placeholder auth_subject (linked on first OAuth
    # sign-in, matched by email) + allocate a seat — same pattern as admin
    # org/user creation.
    user = User(
        id=f"usr_{secrets.token_urlsafe(16)}",
        email=email,
        org_id=org_id,
        role="member",
        is_super_admin=False,
        auth_subject=f"pending_{secrets.token_urlsafe(8)}",
    )
    session.add(user)
    await session.flush()
    session.add(Seat(org_id=org_id, user_id=user.id))

    await write_event(
        session,
        action="provision.user_created",
        org_id=org_id,
        user_id=None,  # actor is the external HR system, not a HailScout user
        subject_type="user",
        subject_id=user.id,
        metadata={
            "email": email,
            "name": _full_name(body.firstName, body.lastName),
            "phone": body.phone,
            "source": "hr_provision",
        },
        commit=False,
    )
    await session.commit()

    logger.info("provision.user.created", org_id=org_id, user_id=user.id, email=email)
    return ProvisionUserResponse(ok=True, userId=user.id)


@router.post("/user/disable", response_model=DisableUserResponse)
async def disable_user(
    body: DisableUserRequest = Body(...),
    org_id: str = Depends(require_provision_key),
    session: AsyncSession = Depends(get_db_session),
) -> DisableUserResponse:
    """Disable a rep account by email.

    Sets ``is_disabled=true`` (+ ``disabled_at``) and revokes every live refresh
    session so existing tokens stop working. Disabled users are also rejected at
    OAuth exchange. Idempotent: disabling an already-disabled user, or an email
    that doesn't exist in the org, still returns 200.
    """
    _check_body_org(body.org_id, org_id)
    email = str(body.email).strip().lower()

    user = (
        await session.execute(
            select(User).where(User.org_id == org_id, User.email == email)
        )
    ).scalar_one_or_none()

    # Idempotent: unknown email is a no-op success (HR can't observe org
    # membership, and re-sends must be safe).
    if user is None:
        logger.info("provision.disable.unknown", org_id=org_id, email=email)
        return DisableUserResponse(ok=True)

    if user.is_disabled:
        logger.info("provision.disable.noop", org_id=org_id, user_id=user.id)
        return DisableUserResponse(ok=True)

    now = datetime.now(timezone.utc)
    user.is_disabled = True
    user.disabled_at = now
    user.updated_at = now

    # Revoke all live refresh sessions so existing tokens can't be refreshed.
    await session.execute(
        update(UserSession)
        .where(UserSession.user_id == user.id, UserSession.revoked_at.is_(None))
        .values(revoked_at=now)
    )

    await write_event(
        session,
        action="provision.user_disabled",
        org_id=org_id,
        user_id=None,
        subject_type="user",
        subject_id=user.id,
        metadata={"email": email, "source": "hr_provision"},
        commit=False,
    )
    await session.commit()

    logger.info("provision.disable.ok", org_id=org_id, user_id=user.id, email=email)
    return DisableUserResponse(ok=True)


@router.get("/user/status", response_model=UserStatusResponse)
async def user_status(
    email: str = Query(..., description="Email to look up within the bound org."),
    org_id: str = Depends(require_provision_key),
    session: AsyncSession = Depends(get_db_session),
) -> UserStatusResponse:
    """Read-only existence/active check for a rep account by email.

    Looks up the user by the key's bound org + lowercased email. Creates
    nothing and never mutates. ``active`` is true only when the user exists
    *and* is not disabled. An email that doesn't exist in the org returns
    ``exists=false, active=false`` (HR can't observe org membership otherwise).
    """
    normalized = email.strip().lower()

    user = (
        await session.execute(
            select(User).where(User.org_id == org_id, User.email == normalized)
        )
    ).scalar_one_or_none()

    exists = user is not None
    active = exists and not user.is_disabled

    logger.info(
        "provision.status", org_id=org_id, email=normalized, exists=exists, active=active
    )
    return UserStatusResponse(email=normalized, exists=exists, active=active)
