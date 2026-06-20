"""SMS-based 2FA endpoints (LOGIN-STANDARD §4 — text codes only, no apps).

    GET  /v1/auth/mfa/status                  enrolled? + masked phone
    POST /v1/auth/mfa/sms/start    {phone}    text a code to verify the phone
    POST /v1/auth/mfa/sms/verify   {code}     confirm enrollment → done
    POST /v1/auth/mfa/sms/send                text a code to the enrolled phone
    POST /v1/auth/mfa/disable      {code}     texted code → turn off
    POST /v1/auth/mfa/trusted-devices/forget  revoke every remembered device

The login challenge itself lives in routes/auth.py (login texts a code when
an enrolled user signs in). status / sms/start / sms/verify also accept the
restricted enrollment-scoped token so a past-grace owner/admin can enroll;
everything else needs a full session.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.auth.mfa_challenge import create_and_send_challenge, verify_challenge
from hailscout_api.auth.middleware import AuthContext, extract_auth_context
from hailscout_api.auth.trusted_device import (
    count_trusted_devices,
    revoke_all_trusted_devices,
)
from hailscout_api.core import get_logger
from hailscout_api.db.models.mfa import UserMfaSecret
from hailscout_api.db.session import get_db_session
from hailscout_api.services.audit import write_event
from hailscout_api.services.sms_sender import is_sms_configured, mask_phone

logger = get_logger(__name__)
router = APIRouter(prefix="/auth/mfa", tags=["mfa"])

_E164 = re.compile(r"^\+[1-9]\d{7,14}$")


# ── Schemas ──────────────────────────────────────────────────────────────────


class StartRequest(BaseModel):
    phone: str = Field(min_length=8, max_length=20)


class CodeRequest(BaseModel):
    code: str = Field(min_length=6, max_length=6)


class StatusResponse(BaseModel):
    enrolled: bool
    enrolled_at: datetime | None
    phone: str | None
    sms_configured: bool
    trusted_devices: int


class SendResponse(BaseModel):
    sent: bool
    phone: str


class VerifyResponse(BaseModel):
    ok: bool
    relogin_required: bool


# ── Helpers ──────────────────────────────────────────────────────────────────


async def _mfa_row(session: AsyncSession, user_id: str) -> UserMfaSecret | None:
    return (
        await session.execute(
            select(UserMfaSecret).where(UserMfaSecret.user_id == user_id)
        )
    ).scalar_one_or_none()


# ── Endpoints ────────────────────────────────────────────────────────────────


@router.get("/status", response_model=StatusResponse)
async def mfa_status(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> StatusResponse:
    auth: AuthContext = await extract_auth_context(request, allow_mfa_enroll=True)
    row = await _mfa_row(session, auth.user_id)
    enrolled = bool(row and row.enabled_at)
    return StatusResponse(
        enrolled=enrolled,
        enrolled_at=row.enabled_at if row else None,
        phone=mask_phone(row.phone_e164) if (enrolled and row and row.phone_e164) else None,
        sms_configured=is_sms_configured(),
        trusted_devices=(
            await count_trusted_devices(session, auth.user_id) if enrolled else 0
        ),
    )


@router.post("/sms/start", response_model=SendResponse)
async def mfa_sms_start(
    body: StartRequest,
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> SendResponse:
    """Begin enrollment: validate the phone, text a code to prove possession."""
    auth = await extract_auth_context(request, allow_mfa_enroll=True)
    phone = body.phone.strip().replace(" ", "")
    if not _E164.match(phone):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Enter a phone number in international format, e.g. +15551234567.",
        )
    row = await _mfa_row(session, auth.user_id)
    if row and row.enabled_at:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Two-factor is already on. Turn it off first to change your number.",
        )
    sent = await create_and_send_challenge(session, auth.user_id, "enroll", phone)
    return SendResponse(sent=sent, phone=mask_phone(phone))


@router.post("/sms/verify", response_model=VerifyResponse)
async def mfa_sms_verify(
    body: CodeRequest,
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> VerifyResponse:
    """Confirm enrollment with the texted code → two-factor is on."""
    auth = await extract_auth_context(request, allow_mfa_enroll=True)
    result = await verify_challenge(session, auth.user_id, "enroll", body.code)
    if not result.ok or not result.target_phone:
        msg = (
            "Too many tries. Start again to get a new code."
            if result.reason == "too_many_attempts"
            else "That code didn't match. Check the text and try again."
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)

    now = datetime.now(timezone.utc)
    row = await _mfa_row(session, auth.user_id)
    if row is None:
        row = UserMfaSecret(user_id=auth.user_id)
        session.add(row)
    row.phone_e164 = result.target_phone
    # Recovery codes were retired (LOGIN-STANDARD §4): SMS 2FA is bound to a
    # phone number, which survives device loss via carrier SIM reissue. The
    # recovery_codes_encrypted column is left dormant — never read or written.
    row.recovery_codes_encrypted = None
    row.enabled_at = now
    await write_event(
        session,
        action="auth.mfa_enrolled",
        org_id=auth.org_id or None,
        user_id=auth.user_id,
        subject_type="user",
        subject_id=auth.user_id,
        commit=False,
    )
    await session.commit()
    logger.info("auth.mfa.enrolled", user_id=auth.user_id)

    return VerifyResponse(
        ok=True,
        relogin_required=auth.claims.get("scope") == "mfa_enroll",
    )


@router.post("/sms/send", response_model=SendResponse)
async def mfa_sms_send(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> SendResponse:
    """Text a fresh code to the enrolled phone (settings: disable)."""
    auth = await extract_auth_context(request)
    row = await _mfa_row(session, auth.user_id)
    if row is None or not row.enabled_at or not row.phone_e164:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Two-factor is not on for this account.",
        )
    sent = await create_and_send_challenge(session, auth.user_id, "login", row.phone_e164)
    return SendResponse(sent=sent, phone=mask_phone(row.phone_e164))


@router.post("/disable")
async def mfa_disable(
    body: CodeRequest,
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, bool]:
    """Turn 2FA off (requires a fresh texted code)."""
    auth = await extract_auth_context(request)
    row = await _mfa_row(session, auth.user_id)
    if row is None or not row.enabled_at:
        return {"ok": True, "already_disabled": True}
    challenge = await verify_challenge(session, auth.user_id, "login", body.code)
    if not challenge.ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="That code didn't match.",
        )
    await session.delete(row)
    # Trust tokens are only meaningful while 2FA is on — wipe them so
    # re-enabling later starts from a clean slate (LOGIN-STANDARD §4).
    await revoke_all_trusted_devices(session, auth.user_id)
    await write_event(
        session,
        action="auth.mfa_disabled",
        org_id=auth.org_id or None,
        user_id=auth.user_id,
        subject_type="user",
        subject_id=auth.user_id,
        commit=False,
    )
    await session.commit()
    logger.info("auth.mfa.disabled", user_id=auth.user_id)
    return {"ok": True}


@router.post("/trusted-devices/forget")
async def mfa_forget_trusted_devices(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, bool]:
    """Revoke every remembered device — the next sign-in texts a code again."""
    auth = await extract_auth_context(request)
    await revoke_all_trusted_devices(session, auth.user_id)
    await write_event(
        session,
        action="auth.mfa_trusted_devices_forgotten",
        org_id=auth.org_id or None,
        user_id=auth.user_id,
        subject_type="user",
        subject_id=auth.user_id,
        commit=False,
    )
    await session.commit()
    return {"ok": True}
