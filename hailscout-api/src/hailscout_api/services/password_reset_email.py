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
DEFAULT_FROM = "HailScout <alerts@notifications.hailscout.net>"


async def send_password_reset(email: str, reset_url: str) -> bool:
    api_key = os.environ.get("RESEND_API_KEY", "").strip()
    if not api_key:
        # Deliberate graceful degrade — see module docstring.
        logger.info("auth.password_reset.email_skipped", email=email, reset_url=reset_url)
        return False

    from_addr = os.environ.get("RESEND_FROM_ADDRESS", "").strip() or DEFAULT_FROM
    html = (
        '<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;'
        'max-width:480px;margin:0 auto;padding:8px 24px 24px;color:#0f172a;">'
        '<h2 style="font-size:20px;font-weight:600;margin:24px 0 8px;">'
        "Set your HailScout password</h2>"
        '<p style="font-size:15px;line-height:1.6;color:#334155;margin:0 0 20px;">'
        "Use the button below to set your password and get into HailScout. "
        "This link expires in 1 hour.</p>"
        f'<a href="{reset_url}" '
        'style="display:inline-block;background:#0891B2;color:#ffffff;'
        "text-decoration:none;padding:13px 26px;border-radius:8px;"
        'font-size:15px;font-weight:600;">Set your password</a>'
        '<p style="font-size:12px;line-height:1.6;color:#94a3b8;margin:24px 0 4px;">'
        "If the button doesn't work, paste this link into your browser:</p>"
        f'<p style="font-size:12px;line-height:1.5;color:#64748b;margin:0 0 20px;'
        f'word-break:break-all;"><a href="{reset_url}" '
        f'style="color:#0891B2;">{reset_url}</a></p>'
        '<p style="font-size:12px;color:#94a3b8;margin:0;">'
        "If you didn't request this, you can ignore this email — your password "
        "won't change.</p></div>"
    )
    payload = {
        "from": from_addr,
        "to": [email],
        "subject": "Set your HailScout password",
        "html": html,
        "text": (
            "Set your HailScout password.\n\n"
            f"Use this link to set your password (expires in 1 hour):\n{reset_url}\n\n"
            "If you didn't request this, ignore this email — your password won't change."
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
