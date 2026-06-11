"""Authentication middleware for extracting user and org context.

Verifies HailScout's own access token (HS256) — minted by ``/v1/auth`` after
Google/Microsoft sign-in — and returns the per-request :class:`AuthContext`.
"""

from __future__ import annotations

from typing import Any

from fastapi import Request

from hailscout_api.auth.session import verify_access_token
from hailscout_api.core import AuthenticationError, get_logger

logger = get_logger(__name__)


class AuthContext:
    """Authentication context attached to request state."""

    def __init__(
        self,
        user_id: str,
        email: str,
        org_id: str,
        claims: dict[str, Any],
    ) -> None:
        """Initialize auth context."""
        self.user_id = user_id
        self.email = email
        self.org_id = org_id
        self.claims = claims

    def __repr__(self) -> str:
        return f"<AuthContext(user_id={self.user_id}, org_id={self.org_id})>"


def bearer_token(request: Request) -> str:
    """Extract the Bearer token from the Authorization header (or raise)."""
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise AuthenticationError("Missing Authorization header")
    try:
        scheme, token = auth_header.split(" ", 1)
    except ValueError as exc:
        raise AuthenticationError("Invalid Authorization header format") from exc
    if scheme.lower() != "bearer":
        raise AuthenticationError("Only Bearer token authentication is supported")
    return token


async def extract_auth_context(
    request: Request, *, allow_mfa_enroll: bool = False
) -> AuthContext:
    """Verify the access token and build the request's auth context.

    ``sub`` is our internal user id; ``org_id`` rides in the token (we mint
    it from ``user.org_id``) and comes ONLY from the signed token — a
    client-controlled header must never influence tenancy.

    Enrollment-scoped tokens (``scope: 'mfa_enroll'``, minted when an
    owner/admin's MFA grace window lapsed) are rejected here by default;
    only the MFA enrollment endpoints pass ``allow_mfa_enroll=True``.
    """
    token = bearer_token(request)
    claims = verify_access_token(token, allow_mfa_enroll=allow_mfa_enroll)

    user_id = claims.get("sub")
    email = claims.get("email") or ""
    if not user_id:
        logger.warning("auth.token_missing_sub")
        raise AuthenticationError("Token missing required fields")

    org_id = claims.get("org_id") or ""

    return AuthContext(
        user_id=user_id,
        email=email,
        org_id=org_id,
        claims=claims,
    )
