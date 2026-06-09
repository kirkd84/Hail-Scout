"""Resolve the calling user from a bearer that may be EITHER our session
access token (JWT) OR a personal access token (PAT).

PATs are read-only — rejected on any non-GET/HEAD request. Use this in route
helpers that should accept API tokens for read queries.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import Request
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.auth.api_token import hash_token, looks_like_pat
from hailscout_api.auth.middleware import bearer_token
from hailscout_api.auth.session import verify_access_token
from hailscout_api.core import AuthenticationError, AuthorizationError
from hailscout_api.db.models.org import ApiToken, User


async def resolve_user(request: Request, session: AsyncSession) -> User:
    """Return the authenticated User from a session JWT or a read-only PAT."""
    return await resolve_user_from_token(
        bearer_token(request), request.method, session
    )


async def resolve_user_from_token(
    token: str, method: str, session: AsyncSession
) -> User:
    """Resolve a User from an already-extracted bearer token + HTTP method.

    Lets callers that read the token from a non-standard place (e.g. an
    ``?token=`` query param for SSE) still get PAT support.
    """
    if looks_like_pat(token):
        if method not in ("GET", "HEAD"):
            raise AuthorizationError("API tokens are read-only.")
        row = (
            await session.execute(
                select(ApiToken).where(
                    ApiToken.token_hash == hash_token(token),
                    ApiToken.revoked_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if row is None:
            raise AuthenticationError("Invalid or revoked API token")
        user = (
            await session.execute(select(User).where(User.id == row.user_id))
        ).scalars().first()
        if user is None or user.is_disabled:
            raise AuthenticationError("API token owner not found")
        # Best-effort last-used stamp (don't fail the request if it can't write).
        try:
            await session.execute(
                update(ApiToken)
                .where(ApiToken.id == row.id)
                .values(last_used_at=datetime.now(timezone.utc))
            )
            await session.commit()
        except Exception:
            await session.rollback()
        return user

    claims = verify_access_token(token)
    user_id = claims.get("sub")
    if not user_id:
        raise AuthenticationError("Token missing sub claim")
    user = (
        await session.execute(select(User).where(User.id == user_id))
    ).scalars().first()
    if user is None:
        raise AuthenticationError("User not found")
    return user
