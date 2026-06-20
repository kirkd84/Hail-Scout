"""Crypto for SMS-based 2FA (LOGIN-STANDARD §4).

The one-time texted codes are never stored raw — only an HMAC-SHA256 (keyed
by the app signing secret) lives in the short-lived challenge row.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets

from hailscout_api.config import get_settings
from hailscout_api.core import AuthenticationError


def _app_secret() -> bytes:
    secret = get_settings().session_jwt_secret
    if not secret:
        # Never derive keys / HMACs from an empty secret.
        raise AuthenticationError("Session signing secret is not configured")
    return secret.encode("utf-8")


def generate_sms_code() -> str:
    """A 6-digit numeric code, zero-padded, uniform over 000000–999999."""
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_challenge_code(code: str) -> str:
    """HMAC-SHA256(app secret, code) — what we persist instead of the raw code."""
    return hmac.new(_app_secret(), code.encode("utf-8"), hashlib.sha256).hexdigest()


def safe_equal_hex(a: str, b: str) -> bool:
    """Constant-time compare of two hex digests."""
    return hmac.compare_digest(a, b)
