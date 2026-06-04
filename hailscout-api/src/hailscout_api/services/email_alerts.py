"""Email alert delivery via Resend.

Phase 23. Sibling to `services/slack.py` — same shape, different
transport. The email body is plain-text-with-fallback (text/html)
rendered server-side so we don't need a templating engine just for
this one surface.

Gating: actual sends are conditional on `RESEND_API_KEY` being
present. If not, we log "email.send_skipped_no_key" and return False
so the caller can still record a delivery_status=skipped. This lets
the rest of the pipeline ship without a live email vendor configured.

Sender address is `alerts@notifications.hailscout.app` by default
(override via `RESEND_FROM_ADDRESS`). The domain needs to be verified
in Resend for production use; until then the no-key path is the
honest default.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime
from typing import Iterable, Optional

import httpx

log = logging.getLogger(__name__)


RESEND_API_URL = "https://api.resend.com/emails"
DEFAULT_FROM = "HailScout Alerts <alerts@notifications.hailscout.app>"


# Mirror the Slack module's reference scale so the two surfaces speak
# the same vocabulary about what "1.75-inch hail" actually looks like.
_REFERENCE_OBJECTS: list[tuple[float, str]] = [
    (3.00, "softball"),
    (2.75, "baseball"),
    (2.50, "tennis ball"),
    (2.00, "hen egg"),
    (1.75, "golf ball"),
    (1.50, "walnut"),
    (1.25, "half-dollar"),
    (1.00, "quarter"),
    (0.75, "penny"),
]


def _object_name(size_in: float) -> str:
    for threshold, name in _REFERENCE_OBJECTS:
        if size_in >= threshold:
            return name
    return "pea"


def _human_ts(ts: datetime) -> str:
    # Storm timestamps are tz-aware UTC. Render in a way that's
    # unambiguous to a US-Central reader without pulling in a tz lib.
    return ts.strftime("%b %d %Y · %H:%M UTC")


def render_alert_email(
    *,
    address: str,
    address_label: Optional[str],
    storm_city: Optional[str],
    peak_size_in: float,
    started_at: datetime,
    lsr_confirmed: bool = False,
    app_url: str = "https://hailscout.net",
) -> tuple[str, str, str]:
    """Return (subject, text_body, html_body).

    Voice: cartographer/atlas — calm, precise, no exclamation marks
    or vendor-bro energy. The whole pitch is "we noticed; here's the
    map link."
    """
    object_name = _object_name(peak_size_in)
    label = address_label or address or "your monitored address"
    confirmed_tag = " · confirmed by ground report" if lsr_confirmed else ""

    subject = (
        f"{peak_size_in:.2f}″ hail near {label}"
        if address_label or storm_city else
        f"{peak_size_in:.2f}″ hail reported"
    )

    location_line = (
        f"{label}"
        + (f"   ·  storm centered on {storm_city}" if storm_city else "")
    )

    text_body = "\n".join([
        f"{peak_size_in:.2f}″ hail — {object_name}-sized{confirmed_tag}",
        f"{location_line}",
        f"Observed {_human_ts(started_at)}",
        "",
        "Open the map to inspect the swath, confirm coverage, and "
        "queue door-knocks before the canvass window closes:",
        f"  {app_url}/live",
        "",
        "— HailScout",
        "",
        "You're receiving this because your organization has hail "
        "alerts enabled. Manage recipients in Settings → Integrations.",
    ])

    # Inline HTML — purposely simple so it renders well in dark-mode
    # inboxes without surprising bg colors. No CTA button graphics;
    # links are plain anchors.
    html_body = f"""\
<!doctype html>
<html>
<body style="margin:0;padding:24px;background:#0b1220;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e6ecf3">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="max-width:540px;width:100%">
<tr><td>
  <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#8a9bb8;margin-bottom:6px">HailScout alert</div>
  <div style="font-size:28px;font-weight:600;line-height:1.2">
    {peak_size_in:.2f}″ hail
    <span style="color:#8a9bb8;font-weight:400"> · {object_name}-sized</span>
  </div>
  {"<div style='color:#7adfa3;font-size:13px;margin-top:4px'>✓ confirmed by ground-truth storm report</div>" if lsr_confirmed else ""}

  <div style="margin-top:20px;padding:16px;border:1px solid #1f2a3a;border-radius:8px;background:#111a2c">
    <div style="color:#8a9bb8;font-size:12px;text-transform:uppercase;letter-spacing:.06em">Address</div>
    <div style="font-size:15px;margin-top:2px">{label}</div>
    {f'<div style="color:#8a9bb8;font-size:13px;margin-top:8px">Storm centered on {storm_city}</div>' if storm_city else ""}
    <div style="color:#8a9bb8;font-size:13px;margin-top:8px">Observed {_human_ts(started_at)}</div>
  </div>

  <div style="margin-top:20px">
    <a href="{app_url}/live"
       style="display:inline-block;padding:10px 18px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:6px;font-size:14px">
      Open the map
    </a>
  </div>

  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #1f2a3a;color:#8a9bb8;font-size:12px;line-height:1.5">
    You're receiving this because your organization has hail alerts enabled.
    Manage recipients in <a href="{app_url}/settings/integrations" style="color:#8aa7d6">Settings → Integrations</a>.
  </div>
</td></tr>
</table>
</body>
</html>
"""

    return subject, text_body, html_body


async def send_alert_email(
    *,
    to_addresses: Iterable[str],
    subject: str,
    text_body: str,
    html_body: str,
) -> bool:
    """Send a single alert email to one or more recipients.

    Resend supports multi-recipient `to` arrays. We fan out in one
    request rather than N — that keeps the per-org throttle at one
    API call instead of one-per-recipient, and downstream bounces are
    isolated to the offending address.

    Returns True on a 2xx response, False otherwise (including the
    no-key skip case).
    """
    api_key = os.environ.get("RESEND_API_KEY", "").strip()
    if not api_key:
        log.info("email.send_skipped_no_key",
                 extra={"to_count": len(list(to_addresses))})
        return False

    from_addr = os.environ.get("RESEND_FROM_ADDRESS", "").strip() or DEFAULT_FROM
    to_list = [a for a in (a.strip() for a in to_addresses) if a]
    if not to_list:
        log.warning("email.no_recipients")
        return False

    payload = {
        "from": from_addr,
        "to": to_list,
        "subject": subject,
        "text": text_body,
        "html": html_body,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.post(RESEND_API_URL, json=payload, headers=headers)
            ok = 200 <= r.status_code < 300
            if not ok:
                log.warning("email.send_failed",
                            extra={"status": r.status_code,
                                   "body": r.text[:300]})
            return ok
    except Exception as exc:  # pragma: no cover
        log.warning("email.send_exception: %s", exc)
        return False


async def send_test_email(
    to_addresses: Iterable[str],
    app_url: str = "https://hailscout.net",
) -> bool:
    """Send a 'hello from HailScout' ping. Used by the Settings UI to
    verify a fresh recipient list."""
    subject = "HailScout test alert"
    text = (
        "This is a test from HailScout.\n\n"
        "If you can read this, your organization's hail-alert email "
        "delivery is wired up correctly. The next real notification "
        "will arrive when a monitored address takes a hit.\n\n"
        f"— HailScout\n  {app_url}"
    )
    html = f"""\
<!doctype html>
<html>
<body style="margin:0;padding:24px;background:#0b1220;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e6ecf3">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="max-width:540px;width:100%">
<tr><td>
  <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#8a9bb8;margin-bottom:6px">HailScout</div>
  <div style="font-size:22px;font-weight:600">Test alert delivered</div>
  <p style="color:#cdd6e3;font-size:14px;line-height:1.55;margin-top:14px">
    Your organization's hail-alert email delivery is wired up. The
    next real notification will arrive when a monitored address takes
    a hit — typically within minutes of the radar scan that detected
    it.
  </p>
  <p style="color:#8a9bb8;font-size:12px;margin-top:24px">
    — HailScout · <a href="{app_url}" style="color:#8aa7d6">{app_url}</a>
  </p>
</td></tr>
</table>
</body>
</html>
"""
    return await send_alert_email(
        to_addresses=to_addresses,
        subject=subject,
        text_body=text,
        html_body=html,
    )


def parse_recipient_list(raw: str | None) -> list[str]:
    """Parse the comma-separated `alert_email_recipients` column.

    Caps at 8 addresses, drops dupes (case-insensitive), strips
    whitespace, and skips obviously invalid entries (no `@`).
    """
    if not raw:
        return []
    seen: set[str] = set()
    out: list[str] = []
    for piece in raw.replace(";", ",").replace("\n", ",").split(","):
        addr = piece.strip()
        if not addr or "@" not in addr:
            continue
        key = addr.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(addr)
        if len(out) >= 8:
            break
    return out
