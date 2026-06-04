"""Current user endpoint.

GET /v1/me returns the signed-in user's profile, their org, and any seats.

Implementation notes:
* Auth: validates HailScout's own access token. The ``sub`` claim is our
  internal user id (we mint the token), so we look up by ``User.id``.
* Org context: the token carries ``org_id`` (minted from ``user.org_id``),
  but /me derives it from the user row regardless.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.auth.middleware import extract_auth_context
from hailscout_api.core import AuthenticationError, get_logger
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
