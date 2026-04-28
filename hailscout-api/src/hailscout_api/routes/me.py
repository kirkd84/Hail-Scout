"""Current user endpoint."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.auth.middleware import AuthContext, extract_auth_context
from hailscout_api.auth.clerk import ClerkVerifier
from hailscout_api.config import get_settings
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

    Requires: Authorization: Bearer <clerk_jwt_token>
    Optional: X-Org-Id header for multi-org users
    """
    settings = get_settings()
    verifier = ClerkVerifier(settings.clerk_jwks_endpoint, settings.clerk_secret_key)

    # Extract auth context from JWT
    auth_context: AuthContext = await extract_auth_context(request, verifier)

    # Query user and organization
    user_stmt = select(User).where(User.id == auth_context.user_id)
    user_result = await session.execute(user_stmt)
    user = user_result.scalars().first()

    if not user:
        logger.warning("User not found in database", user_id=auth_context.user_id)
        raise AuthenticationError("User not found")

    org_stmt = select(Organization).where(Organization.id == auth_context.org_id)
    org_result = await session.execute(org_stmt)
    org = org_result.scalars().first()

    if not org:
        logger.warning("Organization not found", org_id=auth_context.org_id)
        raise AuthenticationError("Organization not found")

    # Query seats for this user
    seats_stmt = select(Seat).where(
        and_(Seat.user_id == auth_context.user_id, Seat.org_id == auth_context.org_id)
    )
    seats_result = await session.execute(seats_stmt)
    seats = seats_result.scalars().all()

    logger.info(
        "Fetched user profile",
        user_id=auth_context.user_id,
        org_id=auth_context.org_id,
    )

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
            {
                "id": seat.id,
                "user_id": seat.user_id,
                "assigned_at": seat.assigned_at,
            }
            for seat in seats
        ],
    )
