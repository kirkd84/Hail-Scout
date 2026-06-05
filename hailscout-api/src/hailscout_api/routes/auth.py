"""First-party auth endpoints: OAuth exchange, refresh, logout.

Flow: the web tier runs the Google/Microsoft code-exchange (Arctic) and POSTs us
the provider ``id_token``. We verify it, resolve the user **by verified email**
(no auto-provisioning of unknown emails — same posture as the old Clerk
webhook), link the OAuth subject, and mint our own access + refresh tokens.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.auth.oidc import verify_oidc_id_token
from hailscout_api.auth.session import (
    generate_refresh_token,
    hash_refresh_token,
    mint_access_token,
    new_session_id,
    refresh_expiry,
)
from hailscout_api.core import AuthenticationError, get_logger
from hailscout_api.db.models.org import Organization, User, UserSession
from hailscout_api.db.session import get_db_session

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
