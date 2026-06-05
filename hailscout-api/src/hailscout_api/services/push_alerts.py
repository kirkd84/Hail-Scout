"""Web-push hail alerts (VAPID).

Lazy-imports ``pywebpush`` so a missing dependency or unset VAPID keys is a
graceful no-op rather than a boot failure. ``send_web_push`` is synchronous
(pywebpush uses ``requests``); call it via ``asyncio.to_thread`` from async
code so it doesn't block the event loop.
"""

from __future__ import annotations

import json
from typing import Any

from hailscout_api.config import get_settings
from hailscout_api.core import get_logger

logger = get_logger(__name__)


def push_configured() -> bool:
    """True only if VAPID keys are set AND pywebpush is importable."""
    s = get_settings()
    if not (s.vapid_public_key.strip() and s.vapid_private_key.strip()):
        return False
    try:
        import pywebpush  # noqa: F401
    except Exception:
        logger.warning("push.pywebpush_not_installed")
        return False
    return True


def send_web_push(
    *, endpoint: str, p256dh: str, auth: str, payload: dict[str, Any]
) -> str:
    """Send one push. Returns 'ok', 'gone' (expired → caller should delete the
    subscription), or 'error'."""
    s = get_settings()
    try:
        from pywebpush import WebPushException, webpush
    except Exception:
        return "error"
    try:
        webpush(
            subscription_info={
                "endpoint": endpoint,
                "keys": {"p256dh": p256dh, "auth": auth},
            },
            data=json.dumps(payload),
            vapid_private_key=s.vapid_private_key.strip(),
            vapid_claims={"sub": s.vapid_subject},
        )
        return "ok"
    except WebPushException as exc:
        status = getattr(getattr(exc, "response", None), "status_code", None)
        if status in (404, 410):
            return "gone"
        logger.warning("push.send_failed", status=status, error=str(exc))
        return "error"
    except Exception as exc:  # noqa: BLE001
        logger.error("push.error", error=str(exc))
        return "error"
