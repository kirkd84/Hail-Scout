"""Resolve the calling user from a bearer that may be EITHER our session
access token (JWT) OR a personal access token (PAT).

PATs are read-only — rejected on any non-GET/HEAD request. Use this in route
helpers that should accept API tokens for read queries.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import Request
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.auth.api_token import hash_token, looks_like_pat
from hailscout_api.auth.middleware import bearer_token
from hailscout_api.auth.session import verify_access_token
from hailscout_api.core import AuthenticationError, AuthorizationError, get_logger
from hailscout_api.db.models.org import ApiToken, User

logger = get_logger(__name__)

# How stale ``last_login_at`` may get before ongoing activity re-stamps it.
# The stamp exists so the HR provisioning status endpoint can tell an
# invited-but-never-signed-in account from an active one — day-granularity
# is plenty, so we only write ~twice a day per active user to keep this off
# the hot path.
_LAST_LOGIN_TOUCH_AFTER = timedelta(hours=12)


async def touch_last_login(session: AsyncSession, user: User) -> None:
    """Best-effort, throttled stamp of ``users.last_login_at`` from ongoing
    authenticated activity.

    Fresh sign-in (``/auth/exchange`` and ``/auth/login``) sets this field, but
    an established user on a long-lived session would otherwise never refresh
    it and keep showing as "Invited" in the HR Portal. Any normal authenticated
    request re-stamps it here instead.

    Contract — this MUST NOT change the behavior of the calling request:

    * Called only AFTER the user is authenticated and loaded.
    * THROTTLED: writes only when the field is null or older than
      :data:`_LAST_LOGIN_TOUCH_AFTER`, so the vast majority of requests do no
      write at all.
    * BEST-EFFORT: every failure is swallowed (with its own rollback) — a bad
      write can never surface as an error on, or roll back, the caller's
      request. A targeted UPDATE (not a flush of ``user``) keeps it from
      touching any other pending state on the session.
    """
    try:
        now = datetime.now(timezone.utc)
        last = user.last_login_at
        if last is not None:
            # Stored tz-aware; treat a legacy naive value as UTC just in case.
            if last.tzinfo is None:
                last = last.replace(tzinfo=timezone.utc)
            if now - last < _LAST_LOGIN_TOUCH_AFTER:
                return  # fresh enough — nothing to do (the common path)
        await session.execute(
            update(User).where(User.id == user.id).values(last_login_at=now)
        )
        await session.commit()
        # Keep the in-memory instance consistent so a second call in the same
        # request doesn't re-write.
        user.last_login_at = now
    except Exception:  # noqa: BLE001 — never let the stamp break the request
        try:
            await session.rollback()
        except Exception:  # noqa: BLE001
            pass
        logger.debug("auth.touch_last_login.skipped", exc_info=True)


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
    # Ongoing-activity last-login stamp (throttled + best-effort; never blocks
    # or fails this request). Lets long-lived sessions stop reading as "Invited".
    await touch_last_login(session, user)
    return user
