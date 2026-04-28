"""Super-admin role guard.

A FastAPI dependency that 403s any caller whose ``users.is_super_admin`` is
not true. Add to any super-admin-only route via ``Depends(require_super_admin)``.
"""

from __future__ import annotations

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.db.models.org import User
from hailscout_api.db.session import get_db_session


async def require_super_admin(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> User:
    """Require the authenticated user to have ``is_super_admin = true``.

    The Clerk middleware is expected to attach ``request.state.user_email``
    (or ``request.state.clerk_user_id``) earlier in the request lifecycle.
    Raises 401 if there's no authenticated user, 403 if not super-admin.
    """
    clerk_user_id = getattr(request.state, "clerk_user_id", None)
    user_email = getattr(request.state, "user_email", None)

    if not clerk_user_id and not user_email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )

    stmt = select(User)
    if clerk_user_id:
        stmt = stmt.where(User.clerk_user_id == clerk_user_id)
    else:
        stmt = stmt.where(User.email == user_email)

    result = await session.execute(stmt)
    user = result.scalar_one_or_none()

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
