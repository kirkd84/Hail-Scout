"""First-party auth endpoints: OAuth exchange, refresh, logout.

Flow: the web tier runs the Google/Microsoft code-exchange (Arctic) and POSTs us
the provider ``id_token``. We verify it, resolve the user **by verified email**
(no auto-provisioning of unknown emails — same posture as the old Clerk
webhook), link the OAuth subject, and mint our own access + refresh tokens.
"""

from __future__ import annotations

import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.auth.login_guard import clear_failures, is_locked, record_failure
from hailscout_api.auth.oidc import verify_oidc_id_token
from hailscout_api.auth.passwords import (
    DUMMY_HASH,
    hash_password,
    validate_password_strength,
    verify_password,
)
from hailscout_api.auth.session import (
    generate_refresh_token,
    hash_refresh_token,
    mint_access_token,
    new_session_id,
    refresh_expiry,
)
from hailscout_api.core import AuthenticationError, get_logger
from hailscout_api.db.models.org import Organization, User, UserSession
from hailscout_api.db.models.password_auth import UserToken
from hailscout_api.services.audit import write_event
from hailscout_api.db.session import get_db_session
from hailscout_api.services.password_reset_email import send_password_reset

logger = get_logger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])


# ── Schemas ──────────────────────────────────────────────────────────────────


class ExchangeRequest(BaseModel):
    provider: str
    id_token: str


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    id: str
    email: str
    role: str
    is_super_admin: bool


class OrgOut(BaseModel):
    id: str
    name: str
    plan_tier: str


class TokenResponse(BaseModel):
    access_token: str
    expires_in: int
    refresh_token: str
    user: UserOut
    organization: OrgOut


class RefreshResponse(BaseModel):
    access_token: str
    expires_in: int


# ── Helpers ──────────────────────────────────────────────────────────────────


def _client_ip(request: Request) -> str | None:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()[:64] or None
    return request.client.host[:64] if request.client else None


def _as_aware(dt: datetime) -> datetime:
    """Treat naive datetimes as UTC so comparisons never raise."""
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


# ── Endpoints ────────────────────────────────────────────────────────────────


@router.post("/exchange", response_model=TokenResponse)
async def exchange(
    body: ExchangeRequest,
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> TokenResponse:
    """Verify a provider id_token and issue HailScout session tokens."""
    provider = body.provider.lower().strip()
    try:
        identity = await verify_oidc_id_token(provider, body.id_token)
    except AuthenticationError as exc:
        logger.warning("auth.exchange.verify_failed", provider=provider, error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)
        ) from exc

    user = (
        await session.execute(select(User).where(User.email == identity.email))
    ).scalar_one_or_none()
    if user is None:
        # Match the old webhook: we do not auto-provision strangers.
        logger.info("auth.exchange.unknown_email", email=identity.email)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No HailScout account exists for this email. Ask your administrator to add you.",
        )

    # Disabled accounts (e.g. deactivated by the HR provisioning API) cannot
    # sign in, even though the row still exists for audit/history.
    if user.is_disabled:
        logger.info("auth.exchange.disabled", user_id=user.id, email=identity.email)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been disabled. Contact your administrator.",
        )

    org = (
        await session.execute(
            select(Organization).where(Organization.id == user.org_id)
        )
    ).scalar_one_or_none()
    if org is None:
        logger.error("auth.exchange.org_missing", user_id=user.id, org_id=user.org_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Account is misconfigured (no organization).",
        )

    # Link / refresh the OAuth subject + provider on this account.
    user.auth_subject = identity.subject
    user.auth_provider = identity.provider

    access, expires_in = mint_access_token(
        user_id=user.id, email=user.email, org_id=user.org_id
    )
    raw_refresh = generate_refresh_token()
    session.add(
        UserSession(
            id=new_session_id(),
            user_id=user.id,
            refresh_token_hash=hash_refresh_token(raw_refresh),
            expires_at=refresh_expiry(),
            user_agent=(request.headers.get("user-agent") or "")[:512] or None,
            ip=_client_ip(request),
        )
    )
    await session.commit()

    logger.info("auth.exchange.ok", user_id=user.id, provider=provider)
    return TokenResponse(
        access_token=access,
        expires_in=expires_in,
        refresh_token=raw_refresh,
        user=UserOut(
            id=user.id,
            email=user.email,
            role=user.role,
            is_super_admin=user.is_super_admin,
        ),
        organization=OrgOut(id=org.id, name=org.name, plan_tier=org.plan_tier),
    )


@router.post("/refresh", response_model=RefreshResponse)
async def refresh(
    body: RefreshRequest,
    session: AsyncSession = Depends(get_db_session),
) -> RefreshResponse:
    """Exchange a valid refresh token for a fresh access token."""
    token_hash = hash_refresh_token(body.refresh_token)
    sess = (
        await session.execute(
            select(UserSession).where(UserSession.refresh_token_hash == token_hash)
        )
    ).scalar_one_or_none()

    now = datetime.now(timezone.utc)
    if sess is None or sess.revoked_at is not None or _as_aware(sess.expires_at) <= now:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session.",
        )

    user = (
        await session.execute(select(User).where(User.id == sess.user_id))
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found."
        )

    access, expires_in = mint_access_token(
        user_id=user.id, email=user.email, org_id=user.org_id
    )
    return RefreshResponse(access_token=access, expires_in=expires_in)


@router.post("/logout")
async def logout(
    body: LogoutRequest,
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    """Revoke a refresh session (idempotent)."""
    token_hash = hash_refresh_token(body.refresh_token)
    sess = (
        await session.execute(
            select(UserSession).where(UserSession.refresh_token_hash == token_hash)
        )
    ).scalar_one_or_none()
    if sess is not None and sess.revoked_at is None:
        sess.revoked_at = datetime.now(timezone.utc)
        await session.commit()
    return Response(status_code=204)


# ── Email + password (LOGIN-STANDARD) ────────────────────────────────────────


class PasswordLoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


_INVALID_CREDS = "Incorrect email or password."


@router.post("/login", response_model=TokenResponse)
async def password_login(
    body: PasswordLoginRequest,
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> TokenResponse:
    """Email + password sign-in. Mints the exact same session as /exchange.

    Error behavior is deliberately uniform: unknown email, wrong password,
    social-only account (no password set), and disabled account all return
    the same 401 so nothing about the account leaks. Durable lockout: 5
    failures / 15 min → locked 15 min (shared with the reset flow).
    """
    email = body.email.lower().strip()

    if await is_locked(session, email):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many sign-in attempts. Wait a few minutes and try again.",
        )

    user = (
        await session.execute(select(User).where(User.email == email))
    ).scalar_one_or_none()

    # Constant-time-ish: always run one argon2 verify even when the user is
    # missing or has no password (social-only).
    candidate_hash = user.password_hash if (user and user.password_hash) else DUMMY_HASH
    ok = verify_password(candidate_hash, body.password)
    if user is None or user.password_hash is None or not ok or user.is_disabled:
        await record_failure(session, email)
        await write_event(
            session,
            action="auth.password_login_failed",
            org_id=user.org_id if user else None,
            user_id=user.id if user else None,
            subject_type="user",
            subject_id=user.id if user else email,
            commit=False,
        )
        await session.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=_INVALID_CREDS)

    org = (
        await session.execute(
            select(Organization).where(Organization.id == user.org_id)
        )
    ).scalar_one_or_none()
    if org is None:
        logger.error("auth.login.org_missing", user_id=user.id, org_id=user.org_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Account is misconfigured (no organization).",
        )

    access, expires_in = mint_access_token(
        user_id=user.id, email=user.email, org_id=user.org_id
    )
    raw_refresh = generate_refresh_token()
    session.add(
        UserSession(
            id=new_session_id(),
            user_id=user.id,
            refresh_token_hash=hash_refresh_token(raw_refresh),
            expires_at=refresh_expiry(),
            user_agent=(request.headers.get("user-agent") or "")[:512] or None,
            ip=_client_ip(request),
        )
    )
    await clear_failures(session, email)
    await write_event(
        session,
        action="auth.password_login",
        org_id=user.org_id,
        user_id=user.id,
        subject_type="user",
        subject_id=user.id,
        commit=False,
    )
    await session.commit()

    logger.info("auth.login.ok", user_id=user.id)
    return TokenResponse(
        access_token=access,
        expires_in=expires_in,
        refresh_token=raw_refresh,
        user=UserOut(
            id=user.id,
            email=user.email,
            role=user.role,
            is_super_admin=user.is_super_admin,
        ),
        organization=OrgOut(id=org.id, name=org.name, plan_tier=org.plan_tier),
    )


@router.post("/password/forgot")
async def forgot_password(
    body: ForgotPasswordRequest,
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, bool | str]:
    """Start a self-service reset. Always answers OK (no account enumeration).

    Doubles as SET-initial-password for invited/seeded users who have only
    ever signed in with Google/Microsoft (or never signed in at all).
    """
    email = body.email.lower().strip()

    # Modest abuse brake reusing the durable lockout counter: a flood of
    # forgot requests for one address counts like failures and locks out.
    if await is_locked(session, email):
        return {"ok": True, "message": "If your email is registered, check your inbox."}
    await record_failure(session, email)

    user = (
        await session.execute(select(User).where(User.email == email))
    ).scalar_one_or_none()
    if user is not None and not user.is_disabled:
        raw = secrets.token_urlsafe(32)
        session.add(
            UserToken(
                id=f"utk_{secrets.token_hex(12)}",
                user_id=user.id,
                purpose="password_reset",
                token_hash=hash_refresh_token(raw),
                expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
                created_at=datetime.now(timezone.utc),
            )
        )
        await write_event(
            session,
            action="auth.password_reset_requested",
            org_id=user.org_id,
            user_id=user.id,
            subject_type="user",
            subject_id=user.id,
            commit=False,
        )
        await session.commit()
        web_base = os.environ.get("WEB_BASE_URL", "https://hailscout.net").rstrip("/")
        await send_password_reset(email, f"{web_base}/reset-password?token={raw}")

    return {"ok": True, "message": "If your email is registered, check your inbox."}


@router.post("/password/reset")
async def reset_password(
    body: ResetPasswordRequest,
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, bool]:
    """Complete a reset: set the new password, revoke every session."""
    problem = validate_password_strength(body.new_password)
    if problem:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=problem)

    token_hash = hash_refresh_token(body.token)
    now = datetime.now(timezone.utc)
    record = (
        await session.execute(
            select(UserToken).where(
                UserToken.token_hash == token_hash,
                UserToken.purpose == "password_reset",
                UserToken.used_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if record is None or _as_aware(record.expires_at) <= now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset link is invalid or expired. Request a new one.",
        )

    user = (
        await session.execute(select(User).where(User.id == record.user_id))
    ).scalar_one_or_none()
    if user is None or user.is_disabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset link is invalid or expired. Request a new one.",
        )

    record.used_at = now
    user.password_hash = hash_password(body.new_password)
    # Force re-login everywhere — a reset proves ownership and should evict
    # anyone holding a stolen session.
    stale_sessions = (
        await session.execute(
            select(UserSession).where(
                UserSession.user_id == user.id, UserSession.revoked_at.is_(None)
            )
        )
    ).scalars()
    for s in stale_sessions:
        s.revoked_at = now
    await clear_failures(session, user.email)
    await write_event(
        session,
        action="auth.password_reset_completed",
        org_id=user.org_id,
        user_id=user.id,
        subject_type="user",
        subject_id=user.id,
        commit=False,
    )
    await session.commit()

    logger.info("auth.password_reset.ok", user_id=user.id)
    return {"ok": True}
