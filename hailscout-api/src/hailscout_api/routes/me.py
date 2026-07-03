"""Current user endpoint.

GET /v1/me returns the signed-in user's profile, their org, and any seats.

Implementation notes:
* Auth: validates HailScout's own access token. The ``sub`` claim is our
  internal user id (we mint the token), so we look up by ``User.id``.
* Org context: the token carries ``org_id`` (minted from ``user.org_id``),
  but /me derives it from the user row regardless.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel
from sqlalchemy import and_, delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.auth.middleware import extract_auth_context
from hailscout_api.auth.principal import touch_last_login
from hailscout_api.core import AuthenticationError, get_logger
from hailscout_api.db.models.canvass import MobilePushToken
from hailscout_api.db.models.org import Organization, Seat, User
from hailscout_api.db.session import get_db_session
from hailscout_api.schemas.me import MeResponse

logger = get_logger(__name__)
router = APIRouter()


@router.get("/me", response_model=MeResponse)
async def get_current_user(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> MeResponse:
    """Get current user, organization, and seats.

    Requires: ``Authorization: Bearer <access_token>``.
    """
    auth_context = await extract_auth_context(request)

    # `sub` is our internal user id.
    user = (
        await session.execute(
            select(User).where(User.id == auth_context.user_id)
        )
    ).scalars().first()

    if not user:
        logger.warning("me.user_not_found", user_id=auth_context.user_id)
        raise AuthenticationError("User not found")

    # Ongoing-activity last-login stamp (throttled + best-effort; never blocks
    # or fails this request). /me is the endpoint clients that authenticate via
    # extract_auth_context — notably the mobile app on relaunch — hit, so this
    # covers users who never pass through the PAT/JWT resolver in principal.py.
    await touch_last_login(session, user)

    org = (
        await session.execute(select(Organization).where(Organization.id == user.org_id))
    ).scalars().first()

    if not org:
        logger.error("me.org_missing_for_user", user_id=user.id, org_id=user.org_id)
        raise AuthenticationError("User's organization not found")

    seats = (
        await session.execute(
            select(Seat).where(and_(Seat.user_id == user.id, Seat.org_id == user.org_id))
        )
    ).scalars().all()

    logger.info("me.fetched", user_id=user.id, org_id=user.org_id)

    return MeResponse(
        user={
            "id": user.id,
            "email": user.email,
            "role": user.role,
            "is_super_admin": user.is_super_admin,
            "created_at": user.created_at,
        },
        organization={
            "id": org.id,
            "name": org.name,
            "plan_tier": org.plan_tier,
            "created_at": org.created_at,
        },
        seats=[
            {"id": seat.id, "user_id": seat.user_id, "assigned_at": seat.assigned_at}
            for seat in seats
        ],
    )


class PushTokenBody(BaseModel):
    token: str
    platform: str | None = None  # "ios" | "android"


@router.post("/me/push-token", status_code=204)
async def register_push_token(
    request: Request,
    body: PushTokenBody,
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    """Register (or refresh) this device's Expo push token for the signed-in
    user. Idempotent on the token — re-registering just re-points it at the
    current user/org (e.g. after a different user signs in on the device)."""
    auth_context = await extract_auth_context(request)
    user = (
        await session.execute(select(User).where(User.id == auth_context.user_id))
    ).scalars().first()
    if not user:
        raise AuthenticationError("User not found")

    token = body.token.strip()
    if not token:
        return Response(status_code=204)

    existing = (
        await session.execute(
            select(MobilePushToken).where(MobilePushToken.token == token)
        )
    ).scalars().first()
    if existing is not None:
        existing.user_id = user.id
        existing.org_id = user.org_id
        if body.platform:
            existing.platform = body.platform
    else:
        session.add(
            MobilePushToken(
                token=token,
                user_id=user.id,
                org_id=user.org_id,
                platform=body.platform,
            )
        )
    await session.commit()
    logger.info("me.push_token_registered", user_id=user.id)
    return Response(status_code=204)


@router.delete("/me/push-token", status_code=204)
async def unregister_push_token(
    request: Request,
    body: PushTokenBody,
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    """Drop a device token (called on sign-out)."""
    await extract_auth_context(request)  # require auth
    token = body.token.strip()
    if token:
        await session.execute(
            delete(MobilePushToken).where(MobilePushToken.token == token)
        )
        await session.commit()
    return Response(status_code=204)
