"""Slack webhook notifier.

Posts a formatted message to a tenant's incoming-webhook URL when new
storm alerts are generated. We don't hold a Slack API key — the
webhook URL itself is the credential the user gave us.
"""

from __future__ import annotations

import logging
from typing import Optional

import httpx

log = logging.getLogger(__name__)

REFERENCE_OBJECTS: list[tuple[float, str]] = [
    (3.0,  "softball"),
    (2.75, "baseball"),
    (2.5,  "tennis ball"),
    (2.0,  "hen egg"),
    (1.75, "golf ball"),
    (1.5,  "walnut"),
    (1.25, "half-dollar"),
    (1.0,  "quarter"),
    (0.75, "penny"),
]


def _object_name(size_in: float) -> str:
    for threshold, name in REFERENCE_OBJECTS:
        if size_in >= threshold:
            return name
    return "pea"


def format_alert_message(
    *,
    address: str,
    address_label: Optional[str],
    storm_city: Optional[str],
    peak_size_in: float,
    started_at: str,
) -> dict:
    """Slack 'blocks' payload — renders cleanly in modern Slack clients."""
    object_name = _object_name(peak_size_in)
    label = address_label or address or "monitored address"

    return {
        "text": f"Hail alert: {peak_size_in:.2f}″ at {label}",
        "blocks": [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": f"⚠ {peak_size_in:.2f}″ hail · {object_name}"},
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Address:*\n{label}"},
                    {"type": "mrkdwn", "text": f"*Storm:*\n{storm_city or 'Unspecified'}"},
                    {"type": "mrkdwn", "text": f"*Started:*\n{started_at}"},
                    {"type": "mrkdwn", "text": f"*Severity:*\n{object_name.title()}-sized hail"},
                ],
            },
            {
                "type": "context",
                "elements": [
                    {"type": "mrkdwn", "text": "Posted automatically by HailScout · open the app to manage"},
                ],
            },
        ],
    }


async def send_slack_alert(webhook_url: str, payload: dict) -> bool:
    """Best-effort POST to a Slack webhook. Returns True on 200, False otherwise."""
    if not webhook_url or not webhook_url.startswith("https://hooks.slack.com/"):
        log.warning("slack.invalid_url")
        return False
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.post(webhook_url, json=payload)
            ok = r.status_code == 200
            if not ok:
                log.warning("slack.non_200", extra={"status": r.status_code, "body": r.text[:200]})
            return ok
    except Exception as exc:  # pragma: no cover
        log.warning("slack.send_failed: %s", exc)
        return False


async def send_test_message(webhook_url: str) -> bool:
    """Send a 'hello from HailScout' test ping."""
    payload = {
        "text": "HailScout test message",
        "blocks": [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "*✓ HailScout connected*\nWe'll post here when storms touch your monitored addresses.",
                },
            },
        ],
    }
    return await send_slack_alert(webhook_url, payload)
