"""Super-admin audit log viewer endpoints."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.auth.clerk import ClerkVerifier
from hailscout_api.config import get_settings
from hailscout_api.core import AuthenticationError, AuthorizationError, get_logger
from hailscout_api.db.models.audit import AuditEvent
from hailscout_api.db.models.org import User
from hailscout_api.db.session import get_db_session

log = get_logger(__name__)
router = APIRouter()


class AuditEventResponse(BaseModel):
    id: int
    ts: datetime
    org_id: Optional[str] = None
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    action: str
    subject_type: Optional[str] = None
    subject_id: Optional[str] = None
    metadata: Optional[dict] = None


async def _resolve_user(request: Request, session: AsyncSession) -> User:
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
        raise AuthenticationError("Only Bearer tokens supported")
    claims = await verifier.verify_token(token)
    clerk_user_id = claims.get("sub")
    if not clerk_user_id:
        raise AuthenticationError("JWT missing sub claim")
    user = (
        await session.execute(select(User).where(User.clerk_user_id == clerk_user_id))
    ).scalars().first()
    if not user:
        raise AuthenticationError("User not found")
    return user


@router.get("/admin/audit", response_model=list[AuditEventResponse])
async def list_audit(
    request: Request,
    org_id: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    session: AsyncSession = Depends(get_db_session),
) -> list[AuditEventResponse]:
    user = await _resolve_user(request, session)
    if not user.is_super_admin:
        raise AuthorizationError("Super-admin only")

    stmt = select(AuditEvent).order_by(AuditEvent.ts.desc()).limit(limit)
    if org_id:
        stmt = stmt.where(AuditEvent.org_id == org_id)
    if action:
        stmt = stmt.where(AuditEvent.action == action)

    rows = (await session.execute(stmt)).scalars().all()

    # Look up user emails in one batch
    user_ids = list({r.user_id for r in rows if r.user_id})
    email_by_id: dict[str, str] = {}
    if user_ids:
        actors = (
            await session.execute(select(User).where(User.id.in_(user_ids)))
        ).scalars().all()
        email_by_id = {u.id: u.email for u in actors}

    out: list[AuditEventResponse] = []
    for r in rows:
        meta = None
        if r.metadata_json:
            try:
                meta = json.loads(r.metadata_json)
            except Exception:
                meta = None
        out.append(
            AuditEventResponse(
                id=r.id,
                ts=r.ts,
                org_id=r.org_id,
                user_id=r.user_id,
                user_email=email_by_id.get(r.user_id) if r.user_id else None,
                action=r.action,
                subject_type=r.subject_type,
                subject_id=r.subject_id,
                metadata=meta,
            )
        )
    return out
