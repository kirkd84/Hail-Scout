"""argon2id password hashing + strength policy (LOGIN-STANDARD)."""

from __future__ import annotations

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError

_hasher = PasswordHasher()  # argon2id, library defaults (t=3, m=64MiB, p=4)

# Verified against a hash of a random string when the account doesn't exist,
# keeping login latency constant (defeats user enumeration by timing).
DUMMY_HASH = PasswordHasher().hash("hailscout-dummy-timing-pad")


def hash_password(plain: str) -> str:
    return _hasher.hash(plain)


def verify_password(stored_hash: str, candidate: str) -> bool:
    try:
        return _hasher.verify(stored_hash, candidate)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def validate_password_strength(pw: str) -> str | None:
    """Return a human-readable problem, or None when acceptable."""
    if len(pw) < 10:
        return "Password must be at least 10 characters."
    if len(pw) > 200:
        return "Password is too long."
    classes = sum(
        1
        for check in (str.isupper, str.islower, str.isdigit)
        if any(check(ch) for ch in pw)
    )
    if classes < 2:
        return "Use a mix of upper/lowercase letters and numbers."
    return None
