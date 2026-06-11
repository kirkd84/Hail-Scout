"""HailScout's own session tokens — we are the issuer.

Two-token model:

* **access token** — a short-lived HS256 JWT (claims: ``sub`` = our internal
  user id, ``email``, ``org_id``). The browser attaches it as a Bearer to API
  calls; routes verify it statelessly with :func:`verify_access_token`.
* **refresh token** — an opaque random string returned to the browser once
  (httpOnly cookie) and stored only as a SHA-256 hash in ``user_sessions``.
  It's exchanged for fresh access tokens and can be revoked, so sign-out and
  rotation actually invalidate access.

The signing secret lives only in the API env (``SESSION_JWT_SECRET``); it never
reaches the browser or the web tier.
"""

from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from jwt import PyJWTError

from hailscout_api.config import get_settings
from hailscout_api.core import AuthenticationError

_ALGO = "HS256"


def _secret() -> str:
    secret = get_settings().session_jwt_secret
    if not secret:
        # Never sign/verify with an empty key.
        raise AuthenticationError("Session signing secret is not configured")
    return secret


# ── Access tokens (stateless JWT) ────────────────────────────────────────────


def mint_access_token(
    *,
    user_id: str,
    email: str,
    org_id: str,
    scope: str | None = None,
    mfa_verified: bool | None = None,
) -> tuple[str, int]:
    """Mint a short-lived access JWT. Returns ``(token, expires_in_seconds)``.

    ``scope='mfa_enroll'`` mints the restricted enrollment-only token
    (LOGIN-STANDARD §4): rejected everywhere except the MFA enrollment
    endpoints. ``mfa_verified`` marks a session that passed app-level 2FA at
    sign-in (dropped on refresh — absence means "unverified", not "failed").
    """
    settings = get_settings()
    ttl = settings.session_access_ttl_seconds
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": user_id,
        "email": email,
        "org_id": org_id,
        "iss": settings.session_jwt_issuer,
        "typ": "access",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=ttl)).timestamp()),
    }
    if scope:
        payload["scope"] = scope
    if mfa_verified:
        payload["mfa_verified"] = True
    return jwt.encode(payload, _secret(), algorithm=_ALGO), ttl


def verify_access_token(token: str, *, allow_mfa_enroll: bool = False) -> dict[str, Any]:
    """Verify + decode our access token. Raises ``AuthenticationError``.

    Scoped tokens (``scope: 'mfa_enroll'``) are rejected unless the caller
    explicitly allows them — only the MFA enrollment endpoints do.
    """
    settings = get_settings()
    try:
        claims: dict[str, Any] = jwt.decode(
            token,
            _secret(),
            algorithms=[_ALGO],
            issuer=settings.session_jwt_issuer,
            options={"require": ["exp", "iat", "sub"]},
        )
    except PyJWTError as exc:
        raise AuthenticationError("Invalid or expired session token") from exc
    if claims.get("typ") != "access":
        raise AuthenticationError("Not an access token")
    scope = claims.get("scope")
    if scope is not None and not (allow_mfa_enroll and scope == "mfa_enroll"):
        raise AuthenticationError(
            "This token is restricted to two-factor enrollment"
        )
    return claims


# ── Refresh tokens (opaque, stored hashed, revocable) ────────────────────────


def new_session_id() -> str:
    return uuid.uuid4().hex


def generate_refresh_token() -> str:
    """A high-entropy opaque token. Shown to the client exactly once."""
    return secrets.token_urlsafe(48)


def hash_refresh_token(raw: str) -> str:
    """SHA-256 hex of the raw refresh token (what we persist)."""
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def refresh_expiry() -> datetime:
    """Idle-window expiry for a NEW session row (LOGIN-STANDARD §5).

    Refresh rotation slides this window; the chain also dies unconditionally
    ``session_max_days`` after the original sign-in (see
    :func:`absolute_session_deadline`).
    """
    days = get_settings().session_idle_days
    return datetime.now(timezone.utc) + timedelta(days=days)


def absolute_session_deadline(first_authenticated_at: datetime) -> datetime:
    """The hard end of a session chain: anchor + ``session_max_days`` (90)."""
    return first_authenticated_at + timedelta(days=get_settings().session_max_days)
