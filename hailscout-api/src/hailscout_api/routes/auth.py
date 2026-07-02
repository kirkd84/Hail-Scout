"""First-party auth endpoints: OAuth exchange, refresh, logout.

Flow: the web tier runs the Google/Microsoft/Apple code-exchange (Arctic) and
POSTs us the provider ``id_token``. We verify it, resolve the user **by verified
email** (no auto-provisioning of unknown emails — same posture as the old Clerk
webhook), link the OAuth subject, and mint our own access + refresh tokens.
Apple omits email after the first consent, so a returning Apple user is resolved
by the provider subject linked on that first sign-in instead.
"""

from __future__ import annotations

import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.auth.login_guard import clear_failures, is_locked, record_failure
from hailscout_api.auth.mfa_challenge import create_and_send_challenge, verify_challenge
from hailscout_api.auth.oidc import verify_oidc_id_token
from hailscout_api.auth.passwords import (
    DUMMY_HASH,
    hash_password,
    validate_password_strength,
    verify_password,
)
from hailscout_api.auth.session import (
    absolute_session_deadline,
    generate_refresh_token,
    hash_refresh_token,
    mint_access_token,
    new_session_id,
    refresh_expiry,
)
from hailscout_api.auth.trusted_device import (
    is_trusted_device,
    mint_trusted_device,
    revoke_all_trusted_devices,
)
from hailscout_api.core import AuthenticationError, get_logger
from hailscout_api.db.models.mfa import UserMfaSecret
from hailscout_api.db.models.org import Organization, User, UserSession
from hailscout_api.db.models.password_auth import UserToken
from hailscout_api.services.audit import write_event
from hailscout_api.db.session import get_db_session
from hailscout_api.services.password_reset_email import send_password_reset
from hailscout_api.services.sms_sender import mask_phone

# Org roles that MUST enroll in SMS 2FA for password logins (LOGIN-STANDARD §4
# — roles mapping to OWNER/ADMIN; social sign-ins inherit provider MFA).
MFA_REQUIRED_ROLES = {"owner", "admin"}
MFA_GRACE_DAYS = 7

logger = get_logger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])


# ── Schemas ──────────────────────────────────────────────────────────────────


class ExchangeRequest(BaseModel):
    provider: str
    id_token: str


class RefreshRequest(BaseModel):
    refresh_token: str
    # Rotation opt-in (LOGIN-STANDARD §5). The DEPLOYED clients predate
    # rotation — they type the response as {access_token, expires_in} and
    # never store a successor, so rotating under them kills the session on
    # their next refresh. Only clients that persist the returned
    # refresh_token send rotate=true.
    rotate: bool = False


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


class MfaEnrollmentNag(BaseModel):
    """Present during an un-enrolled owner/admin's grace window — the client
    nags toward Settings → Security until they enroll."""

    required: bool
    deadline: str


class TokenResponse(BaseModel):
    access_token: str
    expires_in: int
    refresh_token: str
    user: UserOut
    organization: OrgOut
    # LOGIN-STANDARD §4 — both optional + additive (None for social logins
    # and for accounts without MFA obligations).
    mfa_enrollment: MfaEnrollmentNag | None = None
    # Returned exactly once when the user ticked "remember this device".
    device_trust_token: str | None = None


class RefreshResponse(BaseModel):
    access_token: str
    expires_in: int
    # Successor refresh token (LOGIN-STANDARD §5) — present only when the
    # client opted in with rotate=true; it MUST store it, because the token
    # it presented is now on a short grace fuse. None for legacy
    # non-rotating refreshes (their existing token keeps working).
    refresh_token: str | None = None


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

    # Resolve the account. Normally by verified email (link-by-email posture,
    # LOGIN-STANDARD §2). Apple omits email on every login after the first
    # consent, so when it's absent we fall back to the stable provider subject
    # linked on that first sign-in (user.auth_subject == "apple:<sub>"). A
    # first-ever Apple login always carries the email, so an invited user still
    # gets matched and linked on their first pass.
    if identity.email:
        user = (
            await session.execute(select(User).where(User.email == identity.email))
        ).scalar_one_or_none()
    else:
        user = (
            await session.execute(
                select(User).where(User.auth_subject == identity.subject)
            )
        ).scalar_one_or_none()
    if user is None:
        # Match the old webhook / invite_only posture: we do not auto-provision
        # strangers. An Apple returning login with no email and no linked
        # subject also lands here (nobody to resolve → reject gracefully).
        logger.info(
            "auth.exchange.unknown_identity",
            provider=provider,
            email=identity.email,
            has_subject=bool(identity.email is None),
        )
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
            first_authenticated_at=datetime.now(timezone.utc),
            user_agent=(request.headers.get("user-agent") or "")[:512] or None,
            ip=_client_ip(request),
        )
    )
    # Stamp last successful sign-in (read back by the HR provisioning status
    # endpoint as lastLoginAt).
    user.last_login_at = datetime.now(timezone.utc)
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
    request: Request,
    session: AsyncSession = Depends(get_db_session),
):
    """Mint a fresh access token; slide or rotate the refresh session.

    LOGIN-STANDARD §5: EVERY refresh slides a 7-day idle window (go quiet
    that long and the session dies), clamped to a 90-day absolute cap
    anchored at the chain's original sign-in (``first_authenticated_at``,
    carried through rotations; legacy rows fall back to ``created_at``).
    Past the cap → 401 ``session_expired``.

    Rotation is opt-in (``rotate: true``): the client gets a successor
    token and the presented one is left on a 60-second grace fuse rather
    than revoked outright (see below). Deployed legacy clients never sent
    the flag and never store successors, so for them the existing row
    slides in place — no rotation, no surprise sign-out.
    """
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

    # Absolute session cap — applies to rotating AND non-rotating refreshes:
    # the idle window slides, but the CHAIN dies session_max_days after the
    # original sign-in no matter how active.
    chain_anchor = _as_aware(sess.first_authenticated_at or sess.created_at)
    absolute_deadline = absolute_session_deadline(chain_anchor)
    if now >= absolute_deadline:
        sess.revoked_at = now
        await session.commit()
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={
                "error": "session_expired",
                "detail": "Session expired. Please sign in again.",
            },
        )

    user = (
        await session.execute(select(User).where(User.id == sess.user_id))
    ).scalar_one_or_none()
    # Re-check is_disabled here too (exchange/login already do): disabling
    # a user revokes their sessions, but refresh must not be the one path
    # that would keep minting access tokens if that revocation ever raced.
    if user is None or user.is_disabled:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found."
        )

    access, expires_in = mint_access_token(
        user_id=user.id, email=user.email, org_id=user.org_id
    )
    # now + idle days, clamped to the chain's absolute deadline.
    slid = min(refresh_expiry(), absolute_deadline)

    if not body.rotate:
        # Legacy non-rotating client (deployed mobile build, older BFFs):
        # slide THIS row's idle window in place. Minting a successor would
        # strand the client — it never stores one.
        sess.expires_at = slid
        if sess.first_authenticated_at is None:
            # Backfill the chain anchor on legacy rows so the 90-day cap
            # stays pinned to the original sign-in.
            sess.first_authenticated_at = chain_anchor
        await session.commit()
        return RefreshResponse(access_token=access, expires_in=expires_in)

    # Rotate: mint a successor carrying the chain anchor...
    new_raw_refresh = generate_refresh_token()
    session.add(
        UserSession(
            id=new_session_id(),
            user_id=user.id,
            refresh_token_hash=hash_refresh_token(new_raw_refresh),
            expires_at=slid,
            first_authenticated_at=chain_anchor,
            user_agent=(request.headers.get("user-agent") or "")[:512] or None,
            ip=_client_ip(request),
        )
    )
    # ...and SHRINK the presented token instead of revoking it outright.
    # Grace window: in the web BFF two tabs share one refresh cookie; both
    # can present the same token concurrently. The loser of that race lands
    # here within seconds — a hard revoke would 401 it into a forced logout.
    # 60s of life lets it mint its own successor; after that the old token
    # is naturally expired. min() so a nearly-dead token is never extended.
    sess.expires_at = min(_as_aware(sess.expires_at), now + timedelta(seconds=60))
    await session.commit()
    return RefreshResponse(
        access_token=access, expires_in=expires_in, refresh_token=new_raw_refresh
    )


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
    # Second factor — the texted 6-digit code. Only consulted (and only
    # required) once the account has MFA enrolled.
    mfa_code: str | None = Field(default=None, min_length=6, max_length=6)
    # "Remember this device": when true + the code verifies, the response
    # carries a device_trust_token. A live one presented here skips the code
    # next time (password still required).
    remember_device: bool = False
    device_trust_token: str | None = Field(default=None, max_length=200)


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
):
    """Email + password sign-in. Mints the exact same session as /exchange.

    Error behavior is deliberately uniform: unknown email, wrong password,
    social-only account (no password set), and disabled account all return
    the same 401 so nothing about the account leaks. Durable lockout: 5
    failures / 15 min → locked 15 min (shared with the reset flow; MFA
    failures share the counter too).

    Single-POST MFA (LOGIN-STANDARD §4): an enrolled account without
    ``mfa_code`` gets a fresh code texted and 401 ``mfa_required``;
    re-submitting without a code is the resend path. A live
    ``device_trust_token`` skips the code.
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

    # ── MFA gate (SMS text codes — LOGIN-STANDARD §4) ────────────────────
    #
    # Enrolled users get a one-time code texted to their phone. The
    # mfa_required path is only reachable AFTER a correct password (so it
    # leaks nothing to credential-stuffers) and it's what TRIGGERS the
    # text. Re-submitting email+password with no code re-sends a fresh
    # code — that's the "resend" path. Social sign-ins (/exchange) inherit
    # the provider's own MFA and skip this entirely.
    mfa_verified = False
    new_device_trust_token: str | None = None
    mfa_row = (
        await session.execute(
            select(UserMfaSecret).where(UserMfaSecret.user_id == user.id)
        )
    ).scalar_one_or_none()
    if mfa_row is not None and mfa_row.enabled_at and mfa_row.phone_e164:
        # A device the user previously chose to "remember" (and that's still
        # live) skips the texted code — the password above was still required.
        device_trusted = (
            await is_trusted_device(session, user.id, body.device_trust_token)
            if body.device_trust_token
            else False
        )
        if device_trusted:
            mfa_verified = True
        else:
            if not body.mfa_code:
                await create_and_send_challenge(
                    session, user.id, "login", mfa_row.phone_e164
                )
                masked = mask_phone(mfa_row.phone_e164)
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content={
                        "error": "mfa_required",
                        "detail": f"We texted a 6-digit code to {masked}.",
                        "phone": masked,
                    },
                )
            challenge = await verify_challenge(session, user.id, "login", body.mfa_code)
            if not challenge.ok:
                # MFA failures share the durable lockout counter with
                # password failures (LOGIN-STANDARD §5 anti-abuse).
                await record_failure(session, email)
                await write_event(
                    session,
                    action="auth.password_login_mfa_failed",
                    org_id=user.org_id,
                    user_id=user.id,
                    subject_type="user",
                    subject_id=user.id,
                    commit=False,
                )
                await session.commit()
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content={
                        "error": "invalid_mfa_code",
                        "detail": "That code didn't match. Try a fresh one.",
                    },
                )
            mfa_verified = True
            if body.remember_device:
                new_device_trust_token = await mint_trusted_device(
                    session, user.id, request.headers.get("user-agent")
                )

    # ── MFA enrollment enforcement (owner/admin, password logins only) ──
    #
    # First such login starts a 7-day grace window (the client nags); past
    # the deadline we mint a token that can ONLY drive enrollment — no
    # refresh token, no app access. Sign in again after enrolling.
    mfa_enrollment: MfaEnrollmentNag | None = None
    if mfa_row is None or not mfa_row.enabled_at:
        privileged = user.role in MFA_REQUIRED_ROLES or user.is_super_admin
        if privileged:
            now = datetime.now(timezone.utc)
            grace_start = (
                _as_aware(user.mfa_grace_started_at)
                if user.mfa_grace_started_at
                else None
            )
            if grace_start is None:
                grace_start = now
                user.mfa_grace_started_at = now
            deadline = grace_start + timedelta(days=MFA_GRACE_DAYS)
            if now > deadline:
                enrollment_token, enroll_expires_in = mint_access_token(
                    user_id=user.id,
                    email=user.email,
                    org_id=user.org_id,
                    scope="mfa_enroll",
                )
                await clear_failures(session, email)  # password was correct
                await write_event(
                    session,
                    action="auth.password_login_mfa_enrollment_required",
                    org_id=user.org_id,
                    user_id=user.id,
                    subject_type="user",
                    subject_id=user.id,
                    commit=False,
                )
                await session.commit()
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content={
                        "mfa_enrollment_required": True,
                        "enrollment_token": enrollment_token,
                        "expires_in": enroll_expires_in,
                        "user": {
                            "id": user.id,
                            "email": user.email,
                            "role": user.role,
                            "is_super_admin": user.is_super_admin,
                        },
                    },
                )
            mfa_enrollment = MfaEnrollmentNag(
                required=True, deadline=deadline.isoformat()
            )

    access, expires_in = mint_access_token(
        user_id=user.id,
        email=user.email,
        org_id=user.org_id,
        mfa_verified=mfa_verified,
    )
    raw_refresh = generate_refresh_token()
    session.add(
        UserSession(
            id=new_session_id(),
            user_id=user.id,
            refresh_token_hash=hash_refresh_token(raw_refresh),
            expires_at=refresh_expiry(),
            first_authenticated_at=datetime.now(timezone.utc),
            user_agent=(request.headers.get("user-agent") or "")[:512] or None,
            ip=_client_ip(request),
        )
    )
    await clear_failures(session, email)
    # Stamp last successful sign-in (read back by the HR provisioning status
    # endpoint as lastLoginAt).
    user.last_login_at = datetime.now(timezone.utc)
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
        mfa_enrollment=mfa_enrollment,
        device_trust_token=new_device_trust_token,
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

    # Abuse brake on a SEPARATE namespaced counter. This used to share the
    # login-lockout counter — which let an unauthenticated attacker POST
    # forgot-password 5x and lock the victim out of password sign-in.
    # Namespacing keeps the brake without weaponizing the endpoint.
    guard_key = f"forgot:{email}"[:255]
    if await is_locked(session, guard_key):
        return {"ok": True, "message": "If your email is registered, check your inbox."}
    await record_failure(session, guard_key)

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
    # ...and forget every remembered device — a reset implies "I may be
    # compromised", so the next sign-in must pass the texted code again.
    await revoke_all_trusted_devices(session, user.id)
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
