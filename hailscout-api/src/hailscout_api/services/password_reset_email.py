"""Password-reset / set-password email.

Delivery goes through :mod:`email_sender`, which sends via Resend or plain
SMTP depending on what's configured. With NO provider configured the reset
link is logged instead of sent, so the flow stays testable (grab the link
from the Railway logs) before mail is wired up.
"""

from __future__ import annotations

from hailscout_api.core import get_logger
from hailscout_api.services.email_sender import deliver, email_configured

logger = get_logger(__name__)


async def send_password_reset(email: str, reset_url: str) -> bool:
    if not email_configured():
        # Deliberate graceful degrade — see module docstring.
        logger.info("auth.password_reset.email_skipped", email=email, reset_url=reset_url)
        return False

    html = (
        '<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;'
        'max-width:480px;margin:0 auto;padding:8px 24px 24px;color:#0f172a;">'
        '<h2 style="font-size:20px;font-weight:600;margin:24px 0 8px;">'
        "Set your Hail GPS password</h2>"
        '<p style="font-size:15px;line-height:1.6;color:#334155;margin:0 0 20px;">'
        "Use the button below to set your password and get into Hail GPS. "
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
    text = (
        "Set your Hail GPS password.\n\n"
        f"Use this link to set your password (expires in 1 hour):\n{reset_url}\n\n"
        "If you didn't request this, ignore this email — your password won't change."
    )
    ok = await deliver([email], "Set your Hail GPS password", html, text)
    logger.info("auth.password_reset.email_sent", email=email, ok=ok)
    return ok
