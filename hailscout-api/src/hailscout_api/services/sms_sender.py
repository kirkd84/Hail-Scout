"""Outbound SMS via RepLine's gateway (same gating pattern as password_reset_email).

POST {REPLINE_BASE_URL}/api/v1/messages with ``Authorization: Bearer
{REPLINE_API_KEY}`` and body ``{agentId, contactPhone, body}``. RepLine
enqueues and answers 202 — "accepted", not "delivered"; its background
worker does the actual texting.

When the gateway isn't configured (any of REPLINE_BASE_URL / REPLINE_API_KEY /
REPLINE_AGENT_ID unset) we LOG the message instead of texting, so the 2FA
flow stays verifiable (read the code from the logs) before the key is pasted
in. Once configured, codes are never logged.
"""

from __future__ import annotations

import os

import httpx

from hailscout_api.core import get_logger

logger = get_logger(__name__)


def _gateway() -> tuple[str, str, str] | None:
    base_url = os.environ.get("REPLINE_BASE_URL", "").strip()
    api_key = os.environ.get("REPLINE_API_KEY", "").strip()
    agent_id = os.environ.get("REPLINE_AGENT_ID", "").strip()
    if not (base_url and api_key and agent_id):
        return None
    return base_url, api_key, agent_id


def is_sms_configured() -> bool:
    return _gateway() is not None


async def send_sms(to_phone_e164: str, body: str) -> bool:
    """Text ``body`` to ``to_phone_e164``. True when RepLine accepted it."""
    gateway = _gateway()
    if gateway is None:
        # Deliberate graceful degrade — see module docstring.
        logger.info(
            "sms.skipped_logged (RepLine not configured)",
            to=to_phone_e164,
            body=body,
        )
        return False

    base_url, api_key, agent_id = gateway
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(
                f"{base_url.rstrip('/')}/api/v1/messages",
                json={
                    "agentId": agent_id,
                    "contactPhone": to_phone_e164,
                    "body": body,
                },
                headers={"Authorization": f"Bearer {api_key}"},
            )
        if r.status_code in (200, 202):
            return True
        logger.warning("sms.send_failed", to=to_phone_e164, status=r.status_code)
        return False
    except httpx.HTTPError as exc:
        logger.warning("sms.send_error", to=to_phone_e164, error=str(exc))
        return False


def mask_phone(e164: str) -> str:
    """Mask a phone for display: +15551234567 → •••-•••-4567."""
    return f"•••-•••-{e164[-4:]}"
