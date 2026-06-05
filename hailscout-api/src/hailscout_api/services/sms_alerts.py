"""SMS hail alerts via the Twilio REST API.

Gated on Twilio credentials — a no-op (sends 0) when they're unset, so dev and
unconfigured prod degrade gracefully rather than erroring. Mirrors the
email_alerts.py shape.
"""

from __future__ import annotations

import httpx

from hailscout_api.config import get_settings
from hailscout_api.core import get_logger

logger = get_logger(__name__)

_TWILIO_BASE = "https://api.twilio.com/2010-04-01"


def parse_phone_list(raw: str | None) -> list[str]:
    """Parse the comma/newline-separated phone list. Caps at 8, dedupes,
    keeps a leading +, requires ≥ 10 digits."""
    if not raw:
        return []
    seen: set[str] = set()
    out: list[str] = []
    for piece in raw.replace(";", ",").replace("\n", ",").split(","):
        p = piece.strip()
        if not p:
            continue
        digits = "".join(ch for ch in p if ch.isdigit())
        if len(digits) < 10:
            continue
        norm = ("+" + digits) if p.lstrip().startswith("+") else (
            f"+1{digits}" if len(digits) == 10 else f"+{digits}"
        )
        if norm in seen:
            continue
        seen.add(norm)
        out.append(norm)
        if len(out) >= 8:
            break
    return out


def render_alert_sms(
    *,
    address: str | None,
    address_label: str | None,
    peak_size_in: float,
    storm_city: str | None,
) -> str:
    where = address_label or address or storm_city or "a monitored address"
    return (
        f"HailScout: {peak_size_in:.2f}\" hail hit {where}. "
        "Open the app to verify and pull a claim report."
    )


async def send_sms(to_numbers: list[str], body: str) -> int:
    """Send `body` to each number. Returns the count actually accepted by
    Twilio. Returns 0 (skips) when Twilio isn't configured."""
    settings = get_settings()
    sid = settings.twilio_account_sid.strip()
    tok = settings.twilio_auth_token.strip()
    frm = settings.twilio_from_number.strip()
    if not (sid and tok and frm) or not to_numbers:
        return 0

    url = f"{_TWILIO_BASE}/Accounts/{sid}/Messages.json"
    sent = 0
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            for to in to_numbers:
                resp = await client.post(
                    url, auth=(sid, tok), data={"From": frm, "To": to, "Body": body}
                )
                if 200 <= resp.status_code < 300:
                    sent += 1
                else:
                    logger.warning(
                        "sms.send_failed", status=resp.status_code, body=resp.text[:200]
                    )
    except Exception as exc:  # noqa: BLE001
        logger.error("sms.error", error=str(exc))
    return sent


async def send_test_sms(to_numbers: list[str]) -> bool:
    n = await send_sms(
        to_numbers, "HailScout test alert — SMS notifications are working. ⛈"
    )
    return n > 0
