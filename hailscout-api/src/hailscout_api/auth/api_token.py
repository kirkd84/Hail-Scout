"""Personal access tokens (read-only API).

Format ``hsk_<urlsafe-secret>``. The plaintext is shown once at creation; we
persist only its SHA-256 hash and a short display prefix.
"""

from __future__ import annotations

import hashlib
import secrets
import uuid

PREFIX = "hsk_"


def new_token_id() -> str:
    return uuid.uuid4().hex


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def looks_like_pat(token: str) -> bool:
    return token.startswith(PREFIX)


def generate() -> tuple[str, str, str]:
    """Return ``(plaintext, sha256_hash, display_prefix)``."""
    full = PREFIX + secrets.token_urlsafe(32)
    return full, hash_token(full), full[: len(PREFIX) + 6]
