"""Public account-deletion request endpoint.

Google Play (and the App Store) require a way for users to request deletion of
their account + data that is reachable WITHOUT signing in. This records the
request as an audit event the team works within 30 days. It deliberately never
reveals whether an account exists for the email (no enumeration).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.core import get_logger
from hailscout_api.db.models.org import User
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
