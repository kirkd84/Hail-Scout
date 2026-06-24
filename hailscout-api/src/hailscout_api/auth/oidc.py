"""Verify Google / Microsoft OIDC ``id_token``s.

The browser runs the OAuth code-exchange in the web tier (Arctic) and sends us
the provider-signed ``id_token``. We re-verify it here — signature against the
provider JWKS, plus issuer / audience / expiry — so a compromised web tier
still can't forge an identity (it would have to forge a Google/Microsoft
signature). This is the only thing we trust from the web during sign-in;
everything after is our own session token.
"""

from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass
from typing import Any

import httpx
import jwt
from jwt import PyJWTError
from jwt.algorithms import RSAAlgorithm

from hailscout_api.core import AuthenticationError, get_logger

logger = get_logger(__name__)

# These well-known endpoints are extremely stable; hard-coding avoids an extra
# OIDC-discovery round-trip on every sign-in.
_GOOGLE_JWKS = "https://www.googleapis.com/oauth2/v3/certs"
_GOOGLE_ISSUERS = {"https://accounts.google.com", "accounts.google.com"}
_MS_JWKS = "https://login.microsoftonline.com/common/discovery/v2.0/keys"
# Tokens from the multi-tenant ("common") endpoint carry a tenant-specific
# issuer, so we match the shape rather than a single string.
_MS_ISSUER_RE = re.compile(r"^https://login\.microsoftonline\.com/[0-9a-fA-F-]+/v2\.0$")

_SUPPORTED = ("google", "microsoft")


@dataclass(frozen=True)
class OAuthIdentity:
    """A verified identity extracted from a provider id_token."""

    subject: str  # provider 'sub' (namespaced as "<provider>:<sub>")
    email: str  # lower-cased, verified
    provider: str  # 'google' | 'microsoft'


class _JwksCache:
    """Tiny per-URL JWKS cache with a TTL (keys rotate rarely)."""

    def __init__(self, ttl_seconds: int) -> None:
        self._ttl = ttl_seconds
        self._cache: dict[str, tuple[float, dict[str, Any]]] = {}

    async def get(self, url: str) -> dict[str, Any]:
        now = time.monotonic()
        hit = self._cache.get(url)
        if hit is not None and (now - hit[0]) < self._ttl:
            return hit[1]
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(url, timeout=10)
                resp.raise_for_status()
                data = resp.json()
        except Exception as exc:  # noqa: BLE001 - normalize to auth error
            logger.error("oidc.jwks_fetch_failed", url=url, error=str(exc))
            raise AuthenticationError("Failed to fetch provider signing keys") from exc
        self._cache[url] = (now, data)
        return data


_jwks_cache: _JwksCache | None = None


def _get_jwks_cache() -> _JwksCache:
    global _jwks_cache
    if _jwks_cache is None:
        from hailscout_api.config import get_settings

        _jwks_cache = _JwksCache(get_settings().oidc_jwks_cache_ttl_seconds)
    return _jwks_cache


def _public_key_for(token: str, jwks: dict[str, Any]) -> Any:
    try:
        kid = jwt.get_unverified_header(token).get("kid")
    except PyJWTError as exc:
        raise AuthenticationError("Malformed id_token header") from exc
    if not kid:
        raise AuthenticationError("id_token missing 'kid'")
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            return RSAAlgorithm.from_jwk(json.dumps(key))
    raise AuthenticationError("Signing key not found in provider JWKS")


def _truthy(value: Any) -> bool:
    return str(value).lower() == "true"


async def _verify_google(token: str) -> OAuthIdentity:
    from hailscout_api.config import get_settings

    settings = get_settings()
    client_id = settings.google_oauth_client_id
    if not client_id:
        raise AuthenticationError("Google OAuth is not configured")

    # Accept the web client ID plus any configured mobile (iOS/Android) client
    # IDs — each platform's id_token carries its own client as `aud`.
    audiences = [client_id, *[a for a in settings.google_oauth_audiences if a]]

    jwks = await _get_jwks_cache().get(_GOOGLE_JWKS)
    key = _public_key_for(token, jwks)
    try:
        claims = jwt.decode(token, key, algorithms=["RS256"], audience=audiences)
    except PyJWTError as exc:
        raise AuthenticationError("Google id_token verification failed") from exc

    if claims.get("iss") not in _GOOGLE_ISSUERS:
        raise AuthenticationError("Unexpected Google issuer")
    email = (claims.get("email") or "").lower()
    if not email or not _truthy(claims.get("email_verified")):
        raise AuthenticationError("Google account email missing or unverified")
    sub = claims.get("sub")
    if not sub:
        raise AuthenticationError("Google id_token missing 'sub'")
    return OAuthIdentity(subject=f"google:{sub}", email=email, provider="google")


async def _verify_microsoft(token: str) -> OAuthIdentity:
    from hailscout_api.config import get_settings

    settings = get_settings()
    client_id = settings.microsoft_oauth_client_id
    if not client_id:
        raise AuthenticationError("Microsoft OAuth is not configured")

    # Accept the web client ID plus any configured mobile client IDs — each
    # platform's id_token carries its own client as `aud`.
    audiences = [client_id, *[a for a in settings.microsoft_oauth_audiences if a]]

    jwks = await _get_jwks_cache().get(_MS_JWKS)
    key = _public_key_for(token, jwks)
    try:
        claims = jwt.decode(token, key, algorithms=["RS256"], audience=audiences)
    except PyJWTError as exc:
        raise AuthenticationError("Microsoft id_token verification failed") from exc

    iss = claims.get("iss", "")
    tenant = settings.microsoft_oauth_tenant
    if tenant not in {"common", "organizations", "consumers"}:
        # A specific tenant GUID — pin the exact issuer.
        if iss != f"https://login.microsoftonline.com/{tenant}/v2.0":
            raise AuthenticationError("Unexpected Microsoft issuer")
    elif not _MS_ISSUER_RE.match(iss):
        raise AuthenticationError("Unexpected Microsoft issuer")

    # v2.0 work accounts may omit `email`; `preferred_username` is the UPN
    # (typically the email). Fall back to it.
    email = (claims.get("email") or claims.get("preferred_username") or "").lower()
    if not email or "@" not in email:
        raise AuthenticationError("Microsoft account has no usable email")
    sub = claims.get("sub")
    if not sub:
        raise AuthenticationError("Microsoft id_token missing 'sub'")
    return OAuthIdentity(subject=f"microsoft:{sub}", email=email, provider="microsoft")


async def verify_oidc_id_token(provider: str, token: str) -> OAuthIdentity:
    """Verify a provider id_token and return the verified identity.

    Raises :class:`AuthenticationError` on any failure (bad signature, wrong
    audience/issuer, expired, unverified email, unsupported provider).
    """
    if provider == "google":
        return await _verify_google(token)
    if provider == "microsoft":
        return await _verify_microsoft(token)
    raise AuthenticationError(f"Unsupported OAuth provider: {provider!r}")
