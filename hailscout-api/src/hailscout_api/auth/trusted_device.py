"""'Remember this device' trust tokens (LOGIN-STANDARD §4).

A device that passes 2FA once may skip the texted code on later sign-ins
(password still required) until the trust expires or is revoked. The raw
token lives only on the device; we store its SHA-256 hash. Wiped on
MFA-disable and password reset; "forget all devices" lives in Settings.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.db.models.mfa import TrustedDevice

TRUST_DAYS = 90


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


async def mint_trusted_device(
    session: AsyncSession, user_id: str, label: str | None
) -> str:
    """Issue a new 90-day trust token; store its hash; return the raw token.

    Added to the ORM session — the caller's commit persists it.
    """
    raw = secrets.token_urlsafe(48)
    now = datetime.now(timezone.utc)
    session.add(
        TrustedDevice(
            id=f"tdv_{secrets.token_hex(12)}",
            user_id=user_id,
            token_hash=_hash_token(raw),
            label=(label or "")[:255] or None,
            expires_at=now + timedelta(days=TRUST_DAYS),
            last_used_at=now,
        )
    )
    return raw


async def is_trusted_device(
    session: AsyncSession, user_id: str, raw_token: str
) -> bool:
    """True when the raw token is a live trust for THIS user.

    Bound by user id so one user's device token can't vouch for another.
    Bumps ``last_used_at`` (persisted by the caller's commit).
    """
    if not raw_token:
        return False
    row = (
        await session.execute(
            select(TrustedDevice).where(
                TrustedDevice.token_hash == _hash_token(raw_token),
                TrustedDevice.user_id == user_id,
                TrustedDevice.revoked_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if row is None or _aware(row.expires_at) <= datetime.now(timezone.utc):
        return False
    row.last_used_at = datetime.now(timezone.utc)
    return True


async def revoke_all_trusted_devices(session: AsyncSession, user_id: str) -> None:
    """Revoke every remembered device ("forget devices", MFA-disable, reset).

    The caller commits.
    """
    await session.execute(
        update(TrustedDevice)
        .where(
            TrustedDevice.user_id == user_id,
            TrustedDevice.revoked_at.is_(None),
        )
        .values(revoked_at=datetime.now(timezone.utc))
    )


async def count_trusted_devices(session: AsyncSession, user_id: str) -> int:
    """Currently-live remembered devices (for the settings UI)."""
    n = (
        await session.execute(
            select(func.count())
            .select_from(TrustedDevice)
            .where(
                TrustedDevice.user_id == user_id,
                TrustedDevice.revoked_at.is_(None),
                TrustedDevice.expires_at > datetime.now(timezone.utc),
            )
        )
    ).scalar_one()
    return int(n)
