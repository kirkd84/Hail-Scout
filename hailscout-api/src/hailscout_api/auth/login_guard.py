"""Durable per-account login lockout (LOGIN-STANDARD).

DB-backed so restarts don't reset an attacker's budget: 5 failures inside
15 minutes locks the email for 15 minutes. Password and (future) MFA
failures share the counter; success or a completed password reset clears it.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.db.models.password_auth import LoginAttempt

MAX_FAILURES = 5
WINDOW = timedelta(minutes=15)
LOCKOUT = timedelta(minutes=15)


def _aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


async def is_locked(session: AsyncSession, email: str) -> bool:
    row = (
        await session.execute(select(LoginAttempt).where(LoginAttempt.email == email))
    ).scalar_one_or_none()
    locked_until = _aware(row.locked_until) if row else None
    return bool(locked_until and locked_until > datetime.now(timezone.utc))


async def record_failure(session: AsyncSession, email: str) -> None:
    now = datetime.now(timezone.utc)
    row = (
        await session.execute(select(LoginAttempt).where(LoginAttempt.email == email))
    ).scalar_one_or_none()
    if row is None:
        row = LoginAttempt(email=email, failed_count=0)
        session.add(row)
    last = _aware(row.last_failed_at)
    stale = last is None or (now - last) > WINDOW
    row.failed_count = 1 if stale else row.failed_count + 1
    row.last_failed_at = now
    if row.failed_count >= MAX_FAILURES:
        row.locked_until = now + LOCKOUT
    await session.commit()


async def clear_failures(session: AsyncSession, email: str) -> None:
    row = (
        await session.execute(select(LoginAttempt).where(LoginAttempt.email == email))
    ).scalar_one_or_none()
    if row is not None:
        await session.delete(row)
        await session.commit()
