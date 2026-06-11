"""One-time SMS challenge lifecycle (LOGIN-STANDARD §4).

Mint → HMAC-store → text → verify. 5-minute expiry, 5-attempt cap,
single-use. Both helpers COMMIT their own writes: the login route raises
401 right after sending a challenge (and after a wrong guess), and
``get_db_session`` never commits on its own — without the explicit commits
the challenge row / attempt counter would be lost.
"""

from __future__ import annotations

import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Literal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.auth.mfa_crypto import (
    generate_sms_code,
    hash_challenge_code,
    safe_equal_hex,
)
from hailscout_api.db.models.mfa import MfaSmsChallenge
from hailscout_api.services.sms_sender import send_sms

CODE_TTL = timedelta(minutes=5)
MAX_ATTEMPTS = 5
_ISSUER = "HailScout"

ChallengePurpose = Literal["enroll", "login"]


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


@dataclass(frozen=True)
class VerifyResult:
    ok: bool
    # 'no_challenge' | 'too_many_attempts' | 'invalid_code' (when not ok)
    reason: str | None = None
    target_phone: str | None = None


async def create_and_send_challenge(
    session: AsyncSession,
    user_id: str,
    purpose: ChallengePurpose,
    target_phone: str,
) -> bool:
    """Mint a one-time code, store its HMAC + target phone, text it. Commits.

    Returns whether the gateway accepted the text (False also when SMS isn't
    configured — the code is logged in that case so the flow stays
    verifiable). The raw code never leaves this function except over SMS.
    """
    code = generate_sms_code()
    session.add(
        MfaSmsChallenge(
            id=f"mch_{secrets.token_hex(12)}",
            user_id=user_id,
            purpose=purpose,
            code_hash=hash_challenge_code(code),
            target_phone=target_phone,
            expires_at=datetime.now(timezone.utc) + CODE_TTL,
        )
    )
    await session.commit()
    body = (
        f"Your {_ISSUER} sign-in code is {code}. It expires in 5 minutes. "
        "If this wasn't you, ignore this text."
    )
    return await send_sms(target_phone, body)


async def verify_challenge(
    session: AsyncSession,
    user_id: str,
    purpose: ChallengePurpose,
    code: str,
) -> VerifyResult:
    """Verify a code against the user's most-recent live challenge. Commits.

    Wrong guesses increment the attempt counter; the 5th burns the challenge.
    A correct code consumes it (single-use).
    """
    now = datetime.now(timezone.utc)
    rows = (
        (
            await session.execute(
                select(MfaSmsChallenge)
                .where(
                    MfaSmsChallenge.user_id == user_id,
                    MfaSmsChallenge.purpose == purpose,
                    MfaSmsChallenge.consumed_at.is_(None),
                )
                .order_by(MfaSmsChallenge.created_at.desc())
                .limit(5)
            )
        )
        .scalars()
        .all()
    )
    # Expiry filtered in Python so naive timestamps from the DB can't make
    # the comparison raise (same posture as routes/auth.py `_as_aware`).
    row = next((r for r in rows if _aware(r.expires_at) > now), None)

    if row is None:
        return VerifyResult(ok=False, reason="no_challenge")

    if row.attempts >= MAX_ATTEMPTS:
        row.consumed_at = now
        await session.commit()
        return VerifyResult(ok=False, reason="too_many_attempts")

    if not safe_equal_hex(row.code_hash, hash_challenge_code(code.strip())):
        row.attempts += 1
        if row.attempts >= MAX_ATTEMPTS:
            row.consumed_at = now
        await session.commit()
        return VerifyResult(ok=False, reason="invalid_code")

    row.consumed_at = now
    await session.commit()
    return VerifyResult(ok=True, target_phone=row.target_phone)
