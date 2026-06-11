"""Crypto for SMS-based 2FA (LOGIN-STANDARD §4).

The one-time texted codes are never stored raw — only an HMAC-SHA256 (keyed
by the app signing secret) lives in the short-lived challenge row. Recovery
codes are AES-256-GCM encrypted at rest with a key derived from the same
secret (scrypt). Mirrors HailSeek's ``lib/mfaCrypto.ts``.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.config import get_settings
from hailscout_api.core import AuthenticationError
from hailscout_api.db.models.mfa import UserMfaSecret

# Unambiguous base32-ish alphabet (no 0/O/1/I) for recovery codes.
_RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def _app_secret() -> bytes:
    secret = get_settings().session_jwt_secret
    if not secret:
        # Never derive keys / HMACs from an empty secret.
        raise AuthenticationError("Session signing secret is not configured")
    return secret.encode("utf-8")


def _encryption_key() -> bytes:
    """32-byte AES key derived from the app secret (scrypt, fixed salt label)."""
    return hashlib.scrypt(
        _app_secret(), salt=b"hailscout-mfa-recovery", n=16384, r=8, p=1, dklen=32
    )


def encrypt_secret(plaintext: str) -> str:
    """AES-256-GCM encrypt → base64(iv ‖ ciphertext+tag)."""
    iv = secrets.token_bytes(12)
    ct = AESGCM(_encryption_key()).encrypt(iv, plaintext.encode("utf-8"), None)
    return base64.b64encode(iv + ct).decode("ascii")


def decrypt_secret(encrypted: str) -> str:
    buf = base64.b64decode(encrypted)
    iv, ct = buf[:12], buf[12:]
    return AESGCM(_encryption_key()).decrypt(iv, ct, None).decode("utf-8")


def generate_recovery_codes() -> list[str]:
    """10 single-use codes, ``XXXXX-XXXXX`` (10 chars + dash)."""
    codes: list[str] = []
    for _ in range(10):
        raw = "".join(secrets.choice(_RECOVERY_ALPHABET) for _ in range(10))
        codes.append(f"{raw[:5]}-{raw[5:]}")
    return codes


def generate_sms_code() -> str:
    """A 6-digit numeric code, zero-padded, uniform over 000000–999999."""
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_challenge_code(code: str) -> str:
    """HMAC-SHA256(app secret, code) — what we persist instead of the raw code."""
    return hmac.new(_app_secret(), code.encode("utf-8"), hashlib.sha256).hexdigest()


def safe_equal_hex(a: str, b: str) -> bool:
    """Constant-time compare of two hex digests."""
    return hmac.compare_digest(a, b)


def _normalize_recovery(code: str) -> str:
    return "".join(ch for ch in code.upper() if ch in _RECOVERY_ALPHABET)


async def consume_recovery_code(
    session: AsyncSession, row: UserMfaSecret, raw_code: str
) -> bool:
    """Check a recovery code against the user's stored set; CONSUME on match.

    The stored list is rewritten without the matched code so each works
    exactly once. Accepts the code with or without the dash, any case.
    Mutates ``row`` on the ORM session — the caller commits.
    """
    if not row.recovery_codes_encrypted:
        return False
    normalized = _normalize_recovery(raw_code)
    if not normalized:
        return False
    try:
        codes: list[str] = json.loads(decrypt_secret(row.recovery_codes_encrypted))
    except Exception:
        return False
    match = next((c for c in codes if _normalize_recovery(c) == normalized), None)
    if match is None:
        return False
    remaining = [c for c in codes if c != match]
    row.recovery_codes_encrypted = encrypt_secret(json.dumps(remaining))
    session.add(row)
    return True
