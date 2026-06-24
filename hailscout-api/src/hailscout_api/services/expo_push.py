"""Expo push notifications for the native mobile app.

Sends via Expo's Push API (https://exp.host/--/api/v2/push/send). Expo relays
to FCM (Android) / APNs (iOS), so NO FCM/APNs server key lives here — Android
delivery only requires the project's FCM credentials to be configured in Expo
(EAS), which is a one-time console step, not code. With no device tokens
registered this is simply a no-op.
"""

from __future__ import annotations

from typing import Any

import httpx

from hailscout_api.core import get_logger

logger = get_logger(__name__)

_EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


def looks_like_expo_token(token: str) -> bool:
    return token.startswith("ExponentPushToken[") or token.startswith("ExpoPushToken[")


async def send_expo_push(
    *,
    tokens: list[str],
    title: str,
    body: str,
    data: dict[str, Any] | None = None,
) -> set[str]:
    """Send one notification to many device tokens in a single request.

    Returns the set of tokens that are dead (``DeviceNotRegistered``) and
    should be deleted by the caller. A transport/HTTP error returns an empty
    set — we'd rather retry on the next alert pass than drop live tokens on a
    transient blip.
    """
    valid = [t for t in tokens if looks_like_expo_token(t)]
    if not valid:
        return set()

    messages = [
        {"to": t, "title": title, "body": body, "sound": "default", "data": data or {}}
        for t in valid
    ]
    dead: set[str] = set()
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(_EXPO_PUSH_URL, json=messages)
        resp.raise_for_status()
        receipts = resp.json().get("data", [])
        for msg, receipt in zip(messages, receipts):
            if (
                isinstance(receipt, dict)
                and receipt.get("status") == "error"
                and (receipt.get("details") or {}).get("error") == "DeviceNotRegistered"
            ):
                dead.add(msg["to"])
    except Exception as exc:  # noqa: BLE001
        logger.warning("expo_push.send_failed", error=str(exc))

    return dead
