"""Clerk JWT verification and user resolution."""

from __future__ import annotations

import json
from typing import Any

import httpx
import jwt
from jwt import PyJWTError

from hailscout_api.core import AuthenticationError, get_logger

logger = get_logger(__name__)


class ClerkVerifier:
    """Verify Clerk JWTs using JWKS."""

    def __init__(self, jwks_endpoint: str, secret_key: str) -> None:
        """Initialize with JWKS endpoint and secret key."""
        self.jwks_endpoint = jwks_endpoint
        self.secret_key = secret_key
        self._jwks_cache: dict[str, Any] | None = None

    async def _fetch_jwks(self) -> dict[str, Any]:
        """Fetch JWKS from Clerk."""
        if self._jwks_cache is not None:
            return self._jwks_cache

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(self.jwks_endpoint, timeout=10)
                response.raise_for_status()
                self._jwks_cache = response.json()
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

            # Verify and decode the token
            payload = jwt.decode(
                token,
                public_key,
                algorithms=["RS256"],
                audience=None,  # Clerk doesn't always include aud
            )
            return payload

        except PyJWTError as e:
            logger.warning("JWT verification failed", error=str(e))
            raise AuthenticationError("Invalid JWT") from e
        except Exception as e:
            logger.error("Unexpected error during JWT verification", error=str(e))
            raise AuthenticationError("Authentication failed") from e
