"""Provider-agnostic transactional email delivery.

Two backends, chosen by env so we're never locked to one vendor:

1. **Resend** (``RESEND_API_KEY``) — HTTP API.
2. **SMTP** (``SMTP_HOST``) — works with anything that speaks SMTP: Google
   Workspace, Microsoft 365, SendGrid, Postmark, Mailgun, SES… Useful when
   the domain's mail is already hosted somewhere with SPF/DKIM in place,
   since that's the part that actually decides whether mail reaches inboxes.

With neither configured, delivery is skipped and logged (callers log the
link so flows stay testable). Nothing here raises — a mail hiccup must never
roll back the operation that triggered it.

SMTP env:
    SMTP_HOST         smtp.gmail.com | smtp.office365.com | …
    SMTP_PORT         default 587
    SMTP_USER         mailbox / API user
    SMTP_PASSWORD     app password or API key
    SMTP_STARTTLS     "0" to disable STARTTLS (default on)
    SMTP_SSL          "1" for implicit TLS (port 465); overrides STARTTLS

From address (first one set wins):
    EMAIL_FROM | RESEND_FROM_ADDRESS | SMTP_FROM | DEFAULT_FROM
"""

from __future__ import annotations

import asyncio
import os
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import parseaddr
from typing import Iterable

import httpx

from hailscout_api.core import get_logger

log = get_logger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"
DEFAULT_FROM = "Hail GPS <alerts@notifications.hailscout.net>"


def resolve_from() -> str:
    for key in ("EMAIL_FROM", "RESEND_FROM_ADDRESS", "SMTP_FROM"):
        v = os.environ.get(key, "").strip()
        if v:
            return v
    return DEFAULT_FROM


def email_configured() -> bool:
    """True when some backend can actually send."""
    return bool(
        os.environ.get("RESEND_API_KEY", "").strip()
        or os.environ.get("SMTP_HOST", "").strip()
    )


def _send_smtp_blocking(
    from_addr: str, to_list: list[str], subject: str, html: str, text: str
) -> bool:
    host = os.environ.get("SMTP_HOST", "").strip()
    port = int(os.environ.get("SMTP_PORT", "587") or 587)
    user = os.environ.get("SMTP_USER", "").strip()
    password = os.environ.get("SMTP_PASSWORD", "")
    use_ssl = os.environ.get("SMTP_SSL", "").strip() == "1"
    use_starttls = os.environ.get("SMTP_STARTTLS", "1").strip() != "0"

    msg = EmailMessage()
    msg["From"] = from_addr
    msg["To"] = ", ".join(to_list)
    msg["Subject"] = subject
    msg.set_content(text or " ")
    msg.add_alternative(html, subtype="html")

    # Many providers (Workspace/M365) require the envelope sender to match the
    # authenticated mailbox; fall back to it when the display From differs.
    envelope_from = parseaddr(from_addr)[1] or user

    ctx = ssl.create_default_context()
    if use_ssl:
        with smtplib.SMTP_SSL(host, port, context=ctx, timeout=15) as s:
            if user:
                s.login(user, password)
            s.send_message(msg, from_addr=envelope_from, to_addrs=to_list)
    else:
        with smtplib.SMTP(host, port, timeout=15) as s:
            s.ehlo()
            if use_starttls:
                s.starttls(context=ctx)
                s.ehlo()
            if user:
                s.login(user, password)
            s.send_message(msg, from_addr=envelope_from, to_addrs=to_list)
    return True


async def deliver(
    to_addresses: Iterable[str],
    subject: str,
    html: str,
    text: str,
    from_addr: str | None = None,
) -> bool:
    """Send one message to one or more recipients. Never raises."""
    to_list = [a for a in (str(a).strip() for a in to_addresses) if a]
    if not to_list:
        log.warning("email.no_recipients")
        return False
    sender = from_addr or resolve_from()

    api_key = os.environ.get("RESEND_API_KEY", "").strip()
    if api_key:
        payload = {
            "from": sender,
            "to": to_list,
            "subject": subject,
            "html": html,
            "text": text,
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.post(
                    RESEND_API_URL,
                    json=payload,
                    headers={"Authorization": f"Bearer {api_key}"},
                )
            ok = 200 <= r.status_code < 300
            if not ok:
                log.warning(
                    "email.resend_failed",
                    extra={"status": r.status_code, "body": r.text[:300]},
                )
            return ok
        except Exception as exc:  # pragma: no cover — network
            log.warning("email.resend_exception: %s", exc)
            return False

    if os.environ.get("SMTP_HOST", "").strip():
        try:
            # stdlib smtplib is blocking — run it off the event loop.
            return await asyncio.to_thread(
                _send_smtp_blocking, sender, to_list, subject, html, text
            )
        except Exception as exc:  # pragma: no cover — network/auth
            log.warning("email.smtp_exception: %s", exc)
            return False

    log.info("email.send_skipped_no_provider", extra={"to_count": len(to_list)})
    return False
