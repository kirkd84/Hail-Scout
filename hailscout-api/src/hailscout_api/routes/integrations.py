"""Per-org integration endpoints (Slack, eventually Teams/Discord/Zapier)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.auth.clerk import ClerkVerifier
from hailscout_api.config import get_settings
from hailscout_api.core import AuthenticationError, AuthorizationError, get_logger
from hailscout_api.db.models.org import Organization, User
from hailscout_api.db.session import get_db_session
from hailscout_api.services.slack import send_test_message

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
    settings = get_settings()
    verifier = ClerkVerifier(settings.clerk_jwks_endpoint, settings.clerk_secret_key)

    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise AuthenticationError("Missing Authorization header")
    try:
        scheme, token = auth_header.split(" ", 1)
    except ValueError as exc:
        raise AuthenticationError("Invalid Authorization header format") from exc
    if scheme.lower() != "bearer":
        raise AuthenticationError("Only Bearer tokens supported")

    claims = await verifier.verify_token(token)
    clerk_user_id = claims.get("sub")
    if not clerk_user_id:
        raise AuthenticationError("JWT missing sub claim")

    user = (
        await session.execute(select(User).where(User.clerk_user_id == clerk_user_id))
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
