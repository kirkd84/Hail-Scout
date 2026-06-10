"""Password-reset email via Resend (same gating pattern as email_alerts).

Without ``RESEND_API_KEY`` the reset link is logged instead of sent, so the
flow stays testable (grab the link from Railway logs) before the sending
domain is verified in Resend.
"""

from __future__ import annotations

import os

import httpx

from hailscout_api.core import get_logger

logger = get_logger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"
DEFAULT_FROM = "HailScout <alerts@notifications.hailscout.app>"


async def send_password_reset(email: str, reset_url: str) -> bool:
    api_key = os.environ.get("RESEND_API_KEY", "").strip()
    if not api_key:
        # Deliberate graceful degrade — see module docstring.
        logger.info("auth.password_reset.email_skipped", email=email, reset_url=reset_url)
        return False

    from_addr = os.environ.get("RESEND_FROM_ADDRESS", "").strip() or DEFAULT_FROM
    payload = {
        "from": from_addr,
        "to": [email],
        "subject": "Reset your HailScout password",
        "text": (
            "Someone requested a password reset for this HailScout account.\n\n"
            f"Set a new password (link expires in 1 hour):\n{reset_url}\n\n"
            "If this wasn't you, ignore this email — your password is unchanged."
        ),
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(
                RESEND_API_URL,
                json=payload,
                headers={"Authorization": f"Bearer {api_key}"},
            )
        ok = r.status_code in (200, 201)
        logger.info("auth.password_reset.email_sent", email=email, ok=ok, status=r.status_code)
        return ok
    except httpx.HTTPError as exc:
        logger.warning("auth.password_reset.email_error", email=email, error=str(exc))
        return False
