"""Current user endpoint.

GET /v1/me returns the signed-in user's profile, their org, and any seats.

Implementation notes:
* Auth: validates the Clerk JWT via ``ClerkVerifier``. The JWT's ``sub`` claim
  is Clerk's user ID — we look up our DB row via ``User.clerk_user_id``.
* Org context: derived from the user row (``user.org_id``). We do NOT require
  ``org_id`` in the JWT claims — Clerk's default dev JWTs don't include it
  unless a custom JWT template is configured.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.auth.clerk import ClerkVerifier
from hailscout_api.auth.middleware import AuthContext, extract_auth_context
from hailscout_api.config import get_settings
from hailscout_api.core import AuthenticationError, get_logger
from hailscout_api.db.models.org import Organization, Seat, User
from hailscout_api.db.session import get_db_session
from hailscout_api.schemas.me import MeResponse

logger = get_logger(__name__)
router = APIRouter()


async def _extract_for_me(request: Request) -> AuthContext:
    """``extract_auth_context``-lite for /v1/me — does not require org_id."""
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
        raise AuthenticationError("Only Bearer token authentication is supported")

    claims = await verifier.verify_token(token)
    user_id = claims.get("sub")
    email = claims.get("email") or ""
    if not user_id:
        raise AuthenticationError("JWT missing sub claim")

    return AuthContext(user_id=user_id, email=email, org_id="", claims=claims)


@router.get("/me", response_model=MeResponse)
async def get_current_user(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> MeResponse:
    """Get current user, organization, and seats.

    Requires: ``Authorization: Bearer <clerk_jwt>``.
    """
    auth_context = await _extract_for_me(request)

    # Look up by clerk_user_id (NOT internal id — they're different)
    user = (
        await session.execute(
            select(User).where(User.clerk_user_id == auth_context.user_id)
        )
    ).scalars().first()

    if not user:
        logger.warning(
            "me.user_not_found_for_clerk_id", clerk_user_id=auth_context.user_id
        )
        raise AuthenticationError("User not found — webhook may not have reconciled yet")

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
