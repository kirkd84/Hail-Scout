"""Super-admin role guard.

A FastAPI dependency that 403s any caller whose ``users.is_super_admin`` is
not true. Add to any super-admin-only route via ``Depends(require_super_admin)``.
"""

from __future__ import annotations

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.auth.middleware import bearer_token
from hailscout_api.auth.session import verify_access_token
from hailscout_api.core import AuthenticationError
from hailscout_api.db.models.org import User
from hailscout_api.db.session import get_db_session


async def require_super_admin(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> User:
    """Require the authenticated user to have ``is_super_admin = true``.

    Resolves the caller from HailScout's own access token in the
    ``Authorization`` header — the same verify-and-lookup the working routes
    use. Raises 401 if there's no valid authenticated user, 403 if the user is
    not a super-admin.
    """
    try:
        token = bearer_token(request)
        claims = verify_access_token(token)
    except AuthenticationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc

    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing sub claim.",
        )

    user = (
        await session.execute(select(User).where(User.id == user_id))
    ).scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found in database.",
        )

    if not user.is_super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super-admin role required for this operation.",
        )

    return user
