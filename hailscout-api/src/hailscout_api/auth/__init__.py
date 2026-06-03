"""Authentication package."""

from __future__ import annotations

from hailscout_api.auth.clerk import ClerkVerifier, get_clerk_verifier
from hailscout_api.auth.middleware import AuthContext, extract_auth_context

__all__ = [
    "ClerkVerifier",
    "get_clerk_verifier",
    "AuthContext",
    "extract_auth_context",
]
