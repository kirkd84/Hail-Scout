"""Per-org integration endpoints (Slack, eventually Teams/Discord/Zapier)."""

from __future__ import annotations

import asyncio
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.auth.session import verify_access_token
from hailscout_api.config import get_settings
from hailscout_api.core import AuthenticationError, AuthorizationError, get_logger
from hailscout_api.db.models.canvass import PushSubscription
from hailscout_api.db.models.org import Organization, User
from hailscout_api.db.session import get_db_session
from hailscout_api.services.email_alerts import (
    parse_recipient_list,
    send_test_email,
)
from hailscout_api.services.push_alerts import push_configured, send_web_push
from hailscout_api.services.slack import send_test_message
from hailscout_api.services.sms_alerts import parse_phone_list, send_test_sms
from hailscout_api.services.audit import write_event

log = get_logger(__name__)
router = APIRouter()


class SlackConfig(BaseModel):
    webhook_url: Optional[str] = None
    enabled: bool = False


class SlackConfigResponse(SlackConfig):
    org_id: str
    # Don't return the full URL in plain text after save — return a masked variant.
    webhook_masked: Optional[str] = None


async def _resolve_user(request: Request, session: AsyncSession) -> User:
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise AuthenticationError("Missing Authorization header")
    try:
        scheme, token = auth_header.split(" ", 1)
    except ValueError as exc:
        raise AuthenticationError("Invalid Authorization header format") from exc
    if scheme.lower() != "bearer":
        raise AuthenticationError("Only Bearer tokens supported")

    claims = verify_access_token(token)
    user_id = claims.get("sub")
    if not user_id:
        raise AuthenticationError("JWT missing sub claim")

    user = (
        await session.execute(select(User).where(User.id == user_id))
    ).scalars().first()
    if not user:
        raise AuthenticationError("User not found")
    return user


def _require_admin(user: User) -> None:
    if user.is_super_admin or user.role in {"owner", "admin"}:
        return
    raise AuthorizationError("Admin or owner required")


def _mask(url: str | None) -> str | None:
    if not url:
        return None
    # Show the constant prefix + last 6 chars; rest as dots.
    if len(url) < 14:
        return "•" * len(url)
    return url[:30] + "•" * 16 + url[-6:]


@router.get("/integrations/slack", response_model=SlackConfigResponse)
async def get_slack(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> SlackConfigResponse:
    user = await _resolve_user(request, session)
    org = (
        await session.execute(
            select(Organization).where(Organization.id == user.org_id),
        )
    ).scalars().first()
    if org is None:
        raise HTTPException(status_code=404, detail="Org not found")
    return SlackConfigResponse(
        org_id=org.id,
        webhook_url=None,  # never echo plaintext
        enabled=bool(org.slack_enabled),
        webhook_masked=_mask(org.slack_webhook_url),
    )


@router.patch("/integrations/slack", response_model=SlackConfigResponse)
async def update_slack(
    request: Request,
    body: SlackConfig,
    session: AsyncSession = Depends(get_db_session),
) -> SlackConfigResponse:
    user = await _resolve_user(request, session)
    _require_admin(user)
    org = (
        await session.execute(
            select(Organization).where(Organization.id == user.org_id),
        )
    ).scalars().first()
    if org is None:
        raise HTTPException(status_code=404, detail="Org not found")

    if body.webhook_url is not None:
        clean = body.webhook_url.strip()
        if clean and not clean.startswith("https://hooks.slack.com/"):
            raise HTTPException(status_code=422, detail="Webhook URL must be a Slack incoming-webhook URL")
        org.slack_webhook_url = clean or None
    if body.enabled is not None:
        # Auto-disable if no URL set
        org.slack_enabled = bool(body.enabled) and bool(org.slack_webhook_url)

    await session.commit()
    await session.refresh(org)
    await write_event(
        session,
        action="integration.slack.updated",
        org_id=org.id,
        user_id=user.id,
        subject_type="org",
        subject_id=org.id,
        metadata={"enabled": bool(org.slack_enabled)},
    )
    return SlackConfigResponse(
        org_id=org.id,
        webhook_url=None,
        enabled=bool(org.slack_enabled),
        webhook_masked=_mask(org.slack_webhook_url),
    )


@router.post("/integrations/slack/test")
async def test_slack(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    user = await _resolve_user(request, session)
    _require_admin(user)
    org = (
        await session.execute(
            select(Organization).where(Organization.id == user.org_id),
        )
    ).scalars().first()
    if org is None or not org.slack_webhook_url:
        raise HTTPException(status_code=409, detail="Slack webhook not configured")

    ok = await send_test_message(org.slack_webhook_url)
    return {"ok": ok}


# ── Email recipients (Phase 23) ────────────────────────────────────

class EmailAlertsConfig(BaseModel):
    """Per-org email alert configuration.

    `recipients` is the canonical list shape (≤ 8 addresses). For
    backward-compat with existing UIs we also accept a comma-separated
    string via `recipients_raw`.
    """
    enabled: Optional[bool] = None
    recipients: Optional[list[str]] = None
    recipients_raw: Optional[str] = None
    min_size_in: Optional[float] = None


class EmailAlertsResponse(BaseModel):
    org_id: str
    enabled: bool
    recipients: list[str]
    min_size_in: float


def _serialize_email_config(org: Organization) -> EmailAlertsResponse:
    return EmailAlertsResponse(
        org_id=org.id,
        enabled=bool(org.alert_emails_enabled),
        recipients=parse_recipient_list(org.alert_email_recipients),
        min_size_in=float(org.alert_min_size_in or 0.75),
    )


@router.get("/integrations/email-alerts", response_model=EmailAlertsResponse)
async def get_email_alerts(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> EmailAlertsResponse:
    user = await _resolve_user(request, session)
    org = (
        await session.execute(
            select(Organization).where(Organization.id == user.org_id),
        )
    ).scalars().first()
    if org is None:
        raise HTTPException(status_code=404, detail="Org not found")
    return _serialize_email_config(org)


@router.patch("/integrations/email-alerts", response_model=EmailAlertsResponse)
async def update_email_alerts(
    request: Request,
    body: EmailAlertsConfig,
    session: AsyncSession = Depends(get_db_session),
) -> EmailAlertsResponse:
    user = await _resolve_user(request, session)
    _require_admin(user)
    org = (
        await session.execute(
            select(Organization).where(Organization.id == user.org_id),
        )
    ).scalars().first()
    if org is None:
        raise HTTPException(status_code=404, detail="Org not found")

    # Recipients can be supplied as a list OR a comma-separated string;
    # either way we round-trip through parse_recipient_list to enforce
    # the 8-cap, dedupe, and basic shape check.
    if body.recipients is not None:
        joined = ",".join(body.recipients)
        cleaned = parse_recipient_list(joined)
        org.alert_email_recipients = ",".join(cleaned) or None
    elif body.recipients_raw is not None:
        cleaned = parse_recipient_list(body.recipients_raw)
        org.alert_email_recipients = ",".join(cleaned) or None

    if body.enabled is not None:
        # Auto-disable if we have zero recipients — saves the user an
        # easy footgun where the toggle is on but nothing would send.
        has_recipients = bool(parse_recipient_list(org.alert_email_recipients))
        org.alert_emails_enabled = bool(body.enabled) and has_recipients

    if body.min_size_in is not None:
        if body.min_size_in < 0 or body.min_size_in > 6.0:
            raise HTTPException(
                status_code=422,
                detail="min_size_in must be between 0 and 6.0 inches",
            )
        org.alert_min_size_in = float(body.min_size_in)

    await session.commit()
    await session.refresh(org)
    await write_event(
        session,
        action="integration.email_alerts.updated",
        org_id=org.id,
        user_id=user.id,
        subject_type="org",
        subject_id=org.id,
        metadata={
            "enabled": bool(org.alert_emails_enabled),
            "recipient_count": len(parse_recipient_list(
                org.alert_email_recipients,
            )),
            "min_size_in": float(org.alert_min_size_in or 0.75),
        },
    )
    return _serialize_email_config(org)


@router.post("/integrations/email-alerts/test")
async def test_email_alerts(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    user = await _resolve_user(request, session)
    _require_admin(user)
    org = (
        await session.execute(
            select(Organization).where(Organization.id == user.org_id),
        )
    ).scalars().first()
    if org is None:
        raise HTTPException(status_code=404, detail="Org not found")
    recipients = parse_recipient_list(org.alert_email_recipients)
    if not recipients:
        raise HTTPException(
            status_code=409,
            detail="No email recipients configured for this org",
        )
    ok = await send_test_email(recipients)
    return {
        "ok": ok,
        "recipient_count": len(recipients),
        "note": (
            None if ok
            else "Send was skipped — RESEND_API_KEY is not configured "
                 "on the API server."
        ),
    }


# ── SMS recipients (Phase 37) ───────────────────────────────────────

class SmsAlertsConfig(BaseModel):
    enabled: Optional[bool] = None
    recipients: Optional[list[str]] = None
    recipients_raw: Optional[str] = None


class SmsAlertsResponse(BaseModel):
    org_id: str
    enabled: bool
    recipients: list[str]
    # Whether Twilio is configured server-side (controls UI messaging).
    configured: bool


def _serialize_sms(org: Organization) -> SmsAlertsResponse:
    s = get_settings()
    return SmsAlertsResponse(
        org_id=org.id,
        enabled=bool(org.sms_enabled),
        recipients=parse_phone_list(org.sms_recipients),
        configured=bool(
            s.twilio_account_sid and s.twilio_auth_token and s.twilio_from_number
        ),
    )


async def _org_for(request: Request, session: AsyncSession) -> tuple[User, Organization]:
    user = await _resolve_user(request, session)
    org = (
        await session.execute(select(Organization).where(Organization.id == user.org_id))
    ).scalars().first()
    if org is None:
        raise HTTPException(status_code=404, detail="Org not found")
    return user, org


@router.get("/integrations/sms-alerts", response_model=SmsAlertsResponse)
async def get_sms_alerts(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> SmsAlertsResponse:
    _, org = await _org_for(request, session)
    return _serialize_sms(org)


@router.patch("/integrations/sms-alerts", response_model=SmsAlertsResponse)
async def update_sms_alerts(
    request: Request,
    body: SmsAlertsConfig,
    session: AsyncSession = Depends(get_db_session),
) -> SmsAlertsResponse:
    user, org = await _org_for(request, session)
    _require_admin(user)

    if body.recipients is not None:
        cleaned = parse_phone_list(",".join(body.recipients))
        org.sms_recipients = ",".join(cleaned) or None
    elif body.recipients_raw is not None:
        cleaned = parse_phone_list(body.recipients_raw)
        org.sms_recipients = ",".join(cleaned) or None

    if body.enabled is not None:
        has_recipients = bool(parse_phone_list(org.sms_recipients))
        org.sms_enabled = bool(body.enabled) and has_recipients

    await session.commit()
    await session.refresh(org)
    await write_event(
        session,
        action="integration.sms_alerts.updated",
        org_id=org.id,
        user_id=user.id,
        subject_type="org",
        subject_id=org.id,
        metadata={
            "enabled": bool(org.sms_enabled),
            "recipient_count": len(parse_phone_list(org.sms_recipients)),
        },
    )
    return _serialize_sms(org)


@router.post("/integrations/sms-alerts/test")
async def test_sms_alerts(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    user, org = await _org_for(request, session)
    _require_admin(user)
    recipients = parse_phone_list(org.sms_recipients)
    if not recipients:
        raise HTTPException(status_code=409, detail="No SMS recipients configured")
    ok = await send_test_sms(recipients)
    return {
        "ok": ok,
        "recipient_count": len(recipients),
        "note": (
            None if ok
            else "Send was skipped — Twilio is not configured on the API server."
        ),
    }


# ── Web push (Phase 37) ─────────────────────────────────────────────

class PushConfigResponse(BaseModel):
    org_id: str
    enabled: bool
    configured: bool
    vapid_public_key: Optional[str] = None


class PushEnable(BaseModel):
    enabled: bool


class PushSubscriptionIn(BaseModel):
    endpoint: str
    p256dh: str
    auth: str


def _serialize_push(org: Organization) -> PushConfigResponse:
    s = get_settings()
    configured = bool(s.vapid_public_key and s.vapid_private_key)
    return PushConfigResponse(
        org_id=org.id,
        enabled=bool(org.push_enabled),
        configured=configured,
        vapid_public_key=s.vapid_public_key.strip() if configured else None,
    )


@router.get("/integrations/push", response_model=PushConfigResponse)
async def get_push(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> PushConfigResponse:
    _, org = await _org_for(request, session)
    return _serialize_push(org)


@router.patch("/integrations/push", response_model=PushConfigResponse)
async def update_push(
    request: Request,
    body: PushEnable,
    session: AsyncSession = Depends(get_db_session),
) -> PushConfigResponse:
    user, org = await _org_for(request, session)
    _require_admin(user)
    org.push_enabled = bool(body.enabled)
    await session.commit()
    await session.refresh(org)
    return _serialize_push(org)


@router.post("/integrations/push/subscribe")
async def subscribe_push(
    request: Request,
    body: PushSubscriptionIn,
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Register (or refresh) this device's push subscription. Any signed-in
    user; the org-level toggle controls whether anything is actually sent."""
    user = await _resolve_user(request, session)
    existing = (
        await session.execute(
            select(PushSubscription).where(PushSubscription.endpoint == body.endpoint)
        )
    ).scalars().first()
    ua = (request.headers.get("user-agent") or "")[:512] or None
    if existing is not None:
        existing.p256dh = body.p256dh
        existing.auth = body.auth
        existing.user_id = user.id
        existing.org_id = user.org_id
        existing.user_agent = ua
    else:
        session.add(
            PushSubscription(
                id=uuid.uuid4().hex,
                org_id=user.org_id,
                user_id=user.id,
                endpoint=body.endpoint,
                p256dh=body.p256dh,
                auth=body.auth,
                user_agent=ua,
            )
        )
    await session.commit()
    return {"ok": True}


@router.post("/integrations/push/unsubscribe")
async def unsubscribe_push(
    request: Request,
    body: dict,
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    user = await _resolve_user(request, session)
    endpoint = (body or {}).get("endpoint")
    if endpoint:
        from sqlalchemy import delete as _delete

        await session.execute(
            _delete(PushSubscription).where(
                PushSubscription.endpoint == endpoint,
                PushSubscription.user_id == user.id,
            )
        )
        await session.commit()
    return Response(status_code=204)


@router.post("/integrations/push/test")
async def test_push(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    user = await _resolve_user(request, session)
    if not push_configured():
        raise HTTPException(
            status_code=409,
            detail="Web push is not configured on the API server (VAPID keys).",
        )
    subs = (
        await session.execute(
            select(PushSubscription).where(PushSubscription.user_id == user.id)
        )
    ).scalars().all()
    if not subs:
        raise HTTPException(status_code=409, detail="No push subscription on this device yet")
    payload = {
        "title": "HailScout test alert",
        "body": "Push notifications are working. ⛈",
        "url": "/app/alerts",
    }
    sent = 0
    for sub in subs:
        res = await asyncio.to_thread(
            send_web_push,
            endpoint=sub.endpoint,
            p256dh=sub.p256dh,
            auth=sub.auth,
            payload=payload,
        )
        if res == "ok":
            sent += 1
    return {"ok": sent > 0, "sent": sent}
