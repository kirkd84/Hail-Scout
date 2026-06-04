"""Per-org integration endpoints (Slack, eventually Teams/Discord/Zapier)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.auth.session import verify_access_token
from hailscout_api.core import AuthenticationError, AuthorizationError, get_logger
from hailscout_api.db.models.org import Organization, User
from hailscout_api.db.session import get_db_session
from hailscout_api.services.email_alerts import (
    parse_recipient_list,
    send_test_email,
)
from hailscout_api.services.slack import send_test_message
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
