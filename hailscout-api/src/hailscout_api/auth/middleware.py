"""Authentication middleware for extracting user and org context."""

from __future__ import annotations

from typing import Any

from fastapi import Request

from hailscout_api.auth.clerk import ClerkVerifier
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


async def extract_auth_context(
    request: Request, verifier: ClerkVerifier
) -> AuthContext:
    """Extract and verify authentication from request."""
    # Get token from Authorization header
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise AuthenticationError("Missing Authorization header")

    try:
        scheme, token = auth_header.split(" ", 1)
    except ValueError:
        raise AuthenticationError("Invalid Authorization header format")

    if scheme.lower() != "bearer":
        raise AuthenticationError("Only Bearer token authentication is supported")

    # Verify token and get claims
    claims = await verifier.verify_token(token)

    # Extract user info from JWT claims
    user_id = claims.get("sub")
    email = claims.get("email")

    if not user_id or not email:
        logger.warning("JWT missing required fields", claims=claims)
        raise AuthenticationError("JWT missing required fields")

    # Get org_id from claims or X-Org-Id header (for multi-org users)
    org_id = claims.get("org_id")
    if not org_id:
        # Check X-Org-Id header for explicit org selection
        org_id = request.headers.get("X-Org-Id")

    if not org_id:
        logger.warning("No org_id found in claims or headers", user_id=user_id)
        raise AuthenticationError("No organization context found")

    return AuthContext(
        user_id=user_id,
        email=email,
        org_id=org_id,
        claims=claims,
    )
