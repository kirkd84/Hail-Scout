"""Shared onboarding helper: email a newly provisioned user a set-password link.

A HailScout account can be created three ways (team invite, external HR
provisioning, super-admin org creation). Each pre-stages a ``users`` row with NO
password, on the assumption everyone signs in with Google/Microsoft SSO — which
left password-first invitees with no on-ramp (``/v1/auth/login`` rejects a
password-less account, and the only way to set a first password was to discover
"Forgot password?" unaided).

:func:`issue_and_send_set_password_invite` closes that gap by reusing the SAME
machinery the self-service reset flow uses (``routes/auth.py`` ``forgot_password``):
it mints a single-use ``password_reset``-purpose token — the reset endpoint
already doubles as SET-initial-password (see ``routes/auth.py`` ``reset_password``)
— then sends it through the existing dual-purpose
:func:`~hailscout_api.services.password_reset_email.send_password_reset`
template (one "Set your password" email, no duplicate). Additive: SSO onboarding
is unchanged; this just gives password-first users a working link.

The link is built from ``WEB_BASE_URL`` (the exact env the reset link reads).
Sending is gated + graceful inside ``send_password_reset``: without
``RESEND_API_KEY`` the link is logged, and any error is swallowed to False —
this helper never raises, so a mail hiccup can't roll back account creation.
"""

from __future__ import annotations

import os
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.auth.session import hash_refresh_token
from hailscout_api.db.models.org import User
from hailscout_api.db.models.password_auth import UserToken
from hailscout_api.services.password_reset_email import send_password_reset

# How long the set-password link stays valid. Longer than the 1-hour
# self-service reset window because an invite may sit unread in an inbox for a
# day or two before the new rep gets to it — they can always request a fresh
# one via "Forgot password?" if it lapses.
INVITE_TOKEN_TTL = timedelta(days=7)


async def issue_and_send_set_password_invite(
    session: AsyncSession, user: User
) -> bool:
    """Mint a single-use set-password token for ``user`` and email the link.

    Mirrors the token block in ``routes/auth.py`` ``forgot_password`` so every
    account-creation path issues an identical ``password_reset``-purpose token,
    then reuses the improved dual-purpose ``send_password_reset`` template. The
    caller owns the surrounding transaction; we ``flush`` so the token row is
    committed together with the new account. Returns whatever
    ``send_password_reset`` returns (False on the no-key skip); never raises.
    """
    raw = secrets.token_urlsafe(32)
    session.add(
        UserToken(
            id=f"utk_{secrets.token_hex(12)}",
            user_id=user.id,
            purpose="password_reset",
            token_hash=hash_refresh_token(raw),
            expires_at=datetime.now(timezone.utc) + INVITE_TOKEN_TTL,
            created_at=datetime.now(timezone.utc),
        )
    )
    await session.flush()
    web_base = os.environ.get("WEB_BASE_URL", "https://hailscout.net").rstrip("/")
    return await send_password_reset(
        user.email, f"{web_base}/reset-password?token={raw}"
    )
