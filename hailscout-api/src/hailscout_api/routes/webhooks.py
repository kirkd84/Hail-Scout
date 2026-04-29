"""Clerk webhook handler.

Reconciles the Clerk identity with our local ``users`` table.

The seed step inserts ``users`` rows with a placeholder ``clerk_user_id``
(``pending_<label>_<rand>``) so super-admin auth works the moment the real
user signs in. This webhook flips that placeholder to Clerk's actual user
ID the first time a ``user.created`` event arrives for that email.

Events handled:

* ``user.created``  — match by email; if found, set ``clerk_user_id``;
  if not found, ignore (we don't auto-provision strangers).
* ``user.updated``  — if email changed, update; if user doesn't exist, ignore.
* ``user.deleted``  — null out clerk_user_id back to a placeholder
  (we keep the row so audit history is preserved).

Security: every request is verified against ``CLERK_WEBHOOK_SECRET`` via
Svix. Unsigned/invalid requests get 401.
"""

from __future__ import annotations

import logging
import secrets
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from svix.webhooks import Webhook, WebhookVerificationError

from hailscout_api.config import Settings, get_settings
from hailscout_api.db.models.org import User
from hailscout_api.db.session import get_db_session

log = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", include_in_schema=False)


def _placeholder_clerk_id(label: str) -> str:
    return f"pending_{label}_{secrets.token_urlsafe(6)}"


def _extract_primary_email(payload: dict[str, Any]) -> str | None:
    """Pull primary email from a Clerk user.* event payload."""
    data = payload.get("data") or {}
    primary_id = data.get("primary_email_address_id")
    for entry in data.get("email_addresses") or []:
        if entry.get("id") == primary_id:
            email = entry.get("email_address")
            return email.lower() if email else None
    # Fallback: first email in the list
    emails = data.get("email_addresses") or []
    if emails:
        first = emails[0].get("email_address")
        return first.lower() if first else None
    return None


@router.post("/clerk", status_code=200)
async def clerk_webhook(
    request: Request,
    svix_id: str = Header(..., alias="svix-id"),
    svix_timestamp: str = Header(..., alias="svix-timestamp"),
    svix_signature: str = Header(..., alias="svix-signature"),
    settings: Settings = Depends(get_settings),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, str]:
    """Handle a Clerk webhook event.

    Verifies the request signature with Svix, then dispatches by event type.
    """
    secret = settings.clerk_webhook_secret
    if not secret:
        log.error("clerk_webhook.no_secret_configured")
        raise HTTPException(status_code=503, detail="webhook_not_configured")

    body = await request.body()

    try:
        wh = Webhook(secret)
        payload = wh.verify(
            body,
            {
                "svix-id": svix_id,
                "svix-timestamp": svix_timestamp,
                "svix-signature": svix_signature,
            },
        )
    except WebhookVerificationError as exc:
        log.warning("clerk_webhook.signature_invalid: %s", exc)
        raise HTTPException(status_code=401, detail="invalid_signature") from exc

    event_type = payload.get("type", "")
    data = payload.get("data") or {}
    log.info("clerk_webhook.received", extra={"type": event_type, "id": data.get("id")})

    if event_type == "user.created" or event_type == "user.updated":
        await _reconcile_user(session, payload)
    elif event_type == "user.deleted":
        await _decouple_user(session, payload)
    else:
        log.info("clerk_webhook.ignored_type: %s", event_type)

    await session.commit()
    return {"status": "ok"}


async def _reconcile_user(session: AsyncSession, payload: dict[str, Any]) -> None:
    """Match by email, update clerk_user_id (or email if it changed)."""
    data = payload["data"]
    clerk_id: str = data["id"]
    email = _extract_primary_email(payload)
    if not email:
        log.warning("clerk_webhook.user_event_no_email", extra={"clerk_id": clerk_id})
        return

    # First try: match by clerk_user_id (already-reconciled user, email change)
    row = (
        await session.execute(select(User).where(User.clerk_user_id == clerk_id))
    ).scalar_one_or_none()
    if row is not None:
        if row.email != email:
            log.info(
                "clerk_webhook.email_updated",
                extra={"clerk_id": clerk_id, "old": row.email, "new": email},
            )
            row.email = email
        return

    # Second try: match by email (placeholder reconciliation — first sign-in)
    row = (
        await session.execute(select(User).where(User.email == email))
    ).scalar_one_or_none()
    if row is None:
        log.info(
            "clerk_webhook.user_not_in_db_skipping_autoprovision",
            extra={"clerk_id": clerk_id, "email": email},
        )
        return

    log.info(
        "clerk_webhook.reconciled_clerk_id",
        extra={
            "user_id": row.id,
            "email": email,
            "old_clerk_id": row.clerk_user_id,
            "new_clerk_id": clerk_id,
        },
    )
    row.clerk_user_id = clerk_id


async def _decouple_user(session: AsyncSession, payload: dict[str, Any]) -> None:
    """User deleted in Clerk — null out the link, keep the DB row."""
    data = payload["data"]
    clerk_id: str = data["id"]
    row = (
        await session.execute(select(User).where(User.clerk_user_id == clerk_id))
    ).scalar_one_or_none()
    if row is None:
        return
    row.clerk_user_id = _placeholder_clerk_id(f"deleted_{clerk_id[-6:]}")
    log.info("clerk_webhook.user_decoupled", extra={"user_id": row.id})
