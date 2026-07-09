"""Public account-deletion request endpoint.

Google Play (and the App Store) require a way for users to request deletion of
their account + data that is reachable WITHOUT signing in. This records the
request as an audit event the team works within 30 days. It deliberately never
reveals whether an account exists for the email (no enumeration).
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.auth.middleware import extract_auth_context
from hailscout_api.core import AuthenticationError, get_logger
from hailscout_api.db.models.org import User, UserSession
from hailscout_api.db.session import get_db_session
from hailscout_api.services.audit import write_event

logger = get_logger(__name__)
router = APIRouter()


class DeletionRequest(BaseModel):
    email: EmailStr
    reason: str | None = None


class DeletionRequestResponse(BaseModel):
    ok: bool
    message: str


_CONFIRM = (
    "We've received your request. Your HailScout account and the personal data "
    "tied to it will be permanently deleted within 30 days, and we'll email a "
    "confirmation to this address."
)


@router.post("/account/deletion-request", response_model=DeletionRequestResponse)
async def request_account_deletion(
    body: DeletionRequest,
    session: AsyncSession = Depends(get_db_session),
) -> DeletionRequestResponse:
    """Record a deletion request for the account tied to ``email``.

    Public (no auth) — deletion must be requestable without being able to sign
    in. Always returns the same confirmation regardless of whether the email
    maps to an account, so it can't be used to probe membership.
    """
    email = body.email.lower().strip()
    user = (
        await session.execute(select(User).where(User.email == email))
    ).scalar_one_or_none()
    await write_event(
        session,
        action="account.deletion_requested",
        org_id=user.org_id if user else None,
        user_id=user.id if user else None,
        subject_type="user",
        subject_id=user.id if user else None,
        metadata={
            "email": email,
            "reason": (body.reason or "")[:500],
            "matched_account": user is not None,
        },
    )
    logger.info("account.deletion_requested", matched=user is not None)
    return DeletionRequestResponse(ok=True, message=_CONFIRM)


@router.post("/account/delete", response_model=DeletionRequestResponse)
async def delete_my_account(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> DeletionRequestResponse:
    """Delete the SIGNED-IN user's own account — App Store 5.1.1(v) / Play.

    Initiated AND completed from within the app: we immediately disable the
    account and revoke every session so the user can no longer sign in, then
    record it. The remaining personal data is purged within 30 days by the
    deletion process (matches the privacy policy). We disable rather than
    hard-delete inline because a member row is referenced by org/audit
    records — the async purge handles that cascade safely, and in a B2B org
    a member removing themselves must not delete the whole organization.
    """
    auth_context = await extract_auth_context(request)
    user = (
        await session.execute(select(User).where(User.id == auth_context.user_id))
    ).scalar_one_or_none()
    if user is None:
        raise AuthenticationError("User not found")

    now = datetime.now(timezone.utc)
    user.is_disabled = True
    live_sessions = (
        await session.execute(
            select(UserSession).where(
                UserSession.user_id == user.id, UserSession.revoked_at.is_(None)
            )
        )
    ).scalars()
    for s in live_sessions:
        s.revoked_at = now
    await write_event(
        session,
        action="account.self_deleted",
        org_id=user.org_id,
        user_id=user.id,
        subject_type="user",
        subject_id=user.id,
        metadata={"email": user.email, "source": "in_app"},
        commit=False,
    )
    await session.commit()
    logger.info("account.self_deleted", user_id=user.id)
    return DeletionRequestResponse(
        ok=True,
        message=(
            "Your account has been deactivated and you've been signed out. The "
            "data tied to it will be permanently deleted within 30 days."
        ),
    )
