"""Customer/contact record CRUD (CRM-lite).

Mounted under /v1 separately from the legacy /v1/contacts route which
serves Cole-sourced public records on parcels.
"""

from __future__ import annotations

import secrets

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.auth.clerk import ClerkVerifier
from hailscout_api.config import get_settings
from hailscout_api.core import AuthenticationError, get_logger
from hailscout_api.db.models.customer import HsContact
from hailscout_api.db.models.org import User
from hailscout_api.db.session import get_db_session
from hailscout_api.schemas.customer import (
    ContactCreate,
    ContactResponse,
    ContactUpdate,
    VALID_STATUSES,
)

logger = get_logger(__name__)
router = APIRouter()


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


def _new_id() -> str:
    return f"ct_{secrets.token_urlsafe(10)}"


@router.get("/customers", response_model=list[ContactResponse])
async def list_contacts(
    request: Request,
    address_id: int | None = Query(None),
    status: str | None = Query(None),
    session: AsyncSession = Depends(get_db_session),
) -> list[HsContact]:
    user = await _resolve_user(request, session)
    stmt = (
        select(HsContact)
        .where(HsContact.org_id == user.org_id)
        .order_by(HsContact.updated_at.desc())
    )
    if address_id is not None:
        stmt = stmt.where(HsContact.monitored_address_id == address_id)
    if status:
        stmt = stmt.where(HsContact.status == status)
    rows = (await session.execute(stmt)).scalars().all()
    return list(rows)


@router.post("/customers", response_model=ContactResponse, status_code=201)
async def create_contact(
    request: Request,
    body: ContactCreate,
    session: AsyncSession = Depends(get_db_session),
) -> HsContact:
    user = await _resolve_user(request, session)
    if body.status not in VALID_STATUSES:
        raise HTTPException(status_code=422, detail=f"Invalid status: {body.status}")

    c = HsContact(
        id=_new_id(),
        org_id=user.org_id,
        monitored_address_id=body.monitored_address_id,
        name=body.name,
        email=body.email,
        phone=body.phone,
        status=body.status,
        notes=body.notes,
        follow_up_at=body.follow_up_at,
        created_by_user_id=user.id,
    )
    session.add(c)
    await session.commit()
    await session.refresh(c)
    return c


@router.patch("/customers/{contact_id}", response_model=ContactResponse)
async def update_contact(
    request: Request,
    contact_id: str,
    body: ContactUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> HsContact:
    user = await _resolve_user(request, session)
    c = (
        await session.execute(
            select(HsContact).where(
                and_(HsContact.id == contact_id, HsContact.org_id == user.org_id),
            )
        )
    ).scalars().first()
    if c is None:
        raise HTTPException(status_code=404, detail="Contact not found")

    if body.status is not None and body.status not in VALID_STATUSES:
        raise HTTPException(status_code=422, detail=f"Invalid status: {body.status}")

    if body.monitored_address_id is not None: c.monitored_address_id = body.monitored_address_id
    if body.name is not None:                 c.name = body.name
    if body.email is not None:                c.email = str(body.email) if body.email else None
    if body.phone is not None:                c.phone = body.phone
    if body.status is not None:               c.status = body.status
    if body.notes is not None:                c.notes = body.notes
    if body.follow_up_at is not None:         c.follow_up_at = body.follow_up_at

    await session.commit()
    await session.refresh(c)
    return c


@router.delete("/customers/{contact_id}")
async def delete_contact(
    request: Request,
    contact_id: str,
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    user = await _resolve_user(request, session)
    c = (
        await session.execute(
            select(HsContact).where(
                and_(HsContact.id == contact_id, HsContact.org_id == user.org_id),
            )
        )
    ).scalars().first()
    if c is None:
        raise HTTPException(status_code=404, detail="Contact not found")
    await session.delete(c)
    await session.commit()
    return Response(status_code=204)
