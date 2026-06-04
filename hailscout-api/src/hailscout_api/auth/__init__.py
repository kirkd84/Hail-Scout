"""Authentication package.

HailScout is its own identity authority: Google/Microsoft OAuth runs in the web
tier, we verify the provider ``id_token`` (:mod:`auth.oidc`), then mint and
verify our own session tokens (:mod:`auth.session`).
"""

from __future__ import annotations

from hailscout_api.auth.middleware import (
    AuthContext,
    bearer_token,
    extract_auth_context,
)
from hailscout_api.auth.oidc import OAuthIdentity, verify_oidc_id_token
from hailscout_api.auth.session import (
    generate_refresh_token,
    hash_refresh_token,
    mint_access_token,
    verify_access_token,
)

__all__ = [
    "AuthContext",
    "bearer_token",
    "extract_auth_context",
    "OAuthIdentity",
    "verify_oidc_id_token",
    "generate_refresh_token",
    "hash_refresh_token",
    "mint_access_token",
    "verify_access_token",
]
