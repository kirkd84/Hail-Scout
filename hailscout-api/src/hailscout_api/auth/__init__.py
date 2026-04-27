"""Authentication package."""

from __future__ import annotations

from hailscout_api.auth.clerk import ClerkVerifier
from hailscout_api.auth.middleware import AuthContext, extract_auth_context

__all__ = ["ClerkVerifier", "AuthContext", "extract_auth_context"]
