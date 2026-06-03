"""Super-admin role guard.

A FastAPI dependency that 403s any caller whose ``users.is_super_admin`` is
not true. Add to any super-admin-only route via ``Depends(require_super_admin)``.
"""

from __future__ import annotations

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.auth.clerk import get_clerk_verifier
from hailscout_api.core import AuthenticationError
from hailscout_api.db.models.org import User
from hailscout_api.db.session import get_db_session


async def require_super_admin(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> User:
    """Require the authenticated user to have ``is_super_admin = true``.

    Resolves the caller directly from the Clerk JWT in the ``Authorization``
    header — the same verify-and-lookup the working routes (``markers``,
    ``me``, ``audit``) use — because no middleware populates
    ``request.state``. Raises 401 if there's no valid authenticated user, 403
    if the user is not a super-admin.
    """
    verifier = get_clerk_verifier()

    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )
    try:
        scheme, token = auth_header.split(" ", 1)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization header format.",
        ) from exc
    if scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Only Bearer tokens supported.",
        )

    try:
        claims = await verifier.verify_token(token)
    except AuthenticationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc

    clerk_user_id = claims.get("sub")
    if not clerk_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="JWT missing sub claim.",
        )

    user = (
        await session.execute(
            select(User).where(User.clerk_user_id == clerk_user_id)
        )
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
