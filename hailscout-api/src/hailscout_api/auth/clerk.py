"""Clerk JWT verification and user resolution."""

from __future__ import annotations

import json
import time
from typing import Any

import httpx
import jwt
from jwt import PyJWTError

from hailscout_api.core import AuthenticationError, get_logger

logger = get_logger(__name__)


class ClerkVerifier:
    """Verify Clerk JWTs using JWKS.

    Instances cache the fetched JWKS in-process for ``jwks_cache_ttl`` seconds
    so a long-lived (shared) verifier avoids a blocking JWKS HTTP call on every
    authenticated request. Use :func:`get_clerk_verifier` to obtain the shared
    application-wide instance rather than constructing one per request.
    """

    def __init__(
        self,
        jwks_endpoint: str,
        secret_key: str,
        *,
        issuer: str = "",
        authorized_parties: list[str] | None = None,
        jwks_cache_ttl: int = 3600,
    ) -> None:
        """Initialize with JWKS endpoint and secret key."""
        self.jwks_endpoint = jwks_endpoint
        self.secret_key = secret_key
        self.issuer = issuer or ""
        self.authorized_parties = authorized_parties or []
        self.jwks_cache_ttl = jwks_cache_ttl
        self._jwks_cache: dict[str, Any] | None = None
        self._jwks_fetched_at: float = 0.0

    async def _fetch_jwks(self) -> dict[str, Any]:
        """Fetch JWKS from Clerk, reusing the cached copy until it expires."""
        now = time.monotonic()
        if (
            self._jwks_cache is not None
            and (now - self._jwks_fetched_at) < self.jwks_cache_ttl
        ):
            return self._jwks_cache

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(self.jwks_endpoint, timeout=10)
                response.raise_for_status()
                self._jwks_cache = response.json()
                self._jwks_fetched_at = now
                return self._jwks_cache
        except Exception as e:
            logger.error("Failed to fetch Clerk JWKS", error=str(e))
            raise AuthenticationError("Failed to verify JWT") from e

    def _get_key_id_from_token(self, token: str) -> str:
        """Extract 'kid' from JWT header without verification."""
        try:
            header = jwt.get_unverified_header(token)
            return header.get("kid")
        except PyJWTError as e:
            raise AuthenticationError("Invalid JWT format") from e

    async def verify_token(self, token: str) -> dict[str, Any]:
        """Verify and decode a Clerk JWT token."""
        try:
            # Get key ID from token header
            kid = self._get_key_id_from_token(token)
            if not kid:
                raise AuthenticationError("No 'kid' in JWT header")

            # Fetch JWKS and find the key
            jwks = await self._fetch_jwks()
            key_data = None
            for key in jwks.get("keys", []):
                if key.get("kid") == kid:
                    key_data = key
                    break

            if not key_data:
                raise AuthenticationError("Key not found in JWKS")

            # Construct the public key from JWK
            from jwt.algorithms import RSAAlgorithm

            public_key = RSAAlgorithm.from_jwk(json.dumps(key_data))

            # Verify and decode the token. Pin the issuer when configured so a
            # token minted by a different Clerk instance (or a look-alike) is
            # rejected (Clerk backend verification guidance).
            decode_kwargs: dict[str, Any] = {
                "algorithms": ["RS256"],
                "audience": None,  # Clerk doesn't always include aud
            }
            if self.issuer:
                decode_kwargs["issuer"] = self.issuer

            payload = jwt.decode(token, public_key, **decode_kwargs)

            # Verify the authorized party (`azp`). Clerk sets `azp` to the
            # origin that requested the token; reject tokens whose azp is not in
            # the allow-list. We only enforce when both an allow-list is
            # configured AND the token carries an azp claim, so tokens minted
            # without azp (e.g. some machine/M2M tokens) still pass.
            if self.authorized_parties:
                azp = payload.get("azp")
                if azp is not None and azp not in self.authorized_parties:
                    logger.warning("JWT azp not authorized", azp=azp)
                    raise AuthenticationError("Token authorized party not allowed")

            return payload

        except PyJWTError as e:
            logger.warning("JWT verification failed", error=str(e))
            raise AuthenticationError("Invalid JWT") from e
        except AuthenticationError:
            # Already a well-formed auth failure (e.g. azp/kid/key checks) —
            # don't re-wrap it as a generic "Authentication failed".
            raise
        except Exception as e:
            logger.error("Unexpected error during JWT verification", error=str(e))
            raise AuthenticationError("Authentication failed") from e


# ---------------------------------------------------------------------------
# Shared, process-wide verifier
# ---------------------------------------------------------------------------
#
# Each authenticated request previously constructed a fresh ``ClerkVerifier``
# whose JWKS cache started empty, forcing a blocking JWKS HTTP fetch on every
# call. We instead build the verifier once and reuse it so the JWKS cache (and
# its TTL) persists across requests.

_clerk_verifier: ClerkVerifier | None = None


def get_clerk_verifier() -> ClerkVerifier:
    """Return the shared application-wide :class:`ClerkVerifier`.

    Lazily constructed from settings on first use, then cached for the life of
    the process so the JWKS cache survives across requests.
    """
    global _clerk_verifier
    if _clerk_verifier is None:
        # Imported lazily to avoid a circular import at module load
        # (config has no dependency on auth, but keep the import local).
        from hailscout_api.config import get_settings

        settings = get_settings()
        _clerk_verifier = ClerkVerifier(
            settings.clerk_jwks_endpoint,
            settings.clerk_secret_key,
            issuer=settings.clerk_issuer,
            authorized_parties=settings.clerk_authorized_parties,
            jwks_cache_ttl=settings.clerk_jwks_cache_ttl_seconds,
        )
    return _clerk_verifier
