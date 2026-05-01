"""Canvassing marker CRUD."""

from __future__ import annotations

import logging
import secrets
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.auth.clerk import ClerkVerifier
from hailscout_api.auth.middleware import AuthContext, extract_auth_context
from hailscout_api.config import get_settings
from hailscout_api.core import AuthenticationError, get_logger
from hailscout_api.db.models.canvass import Marker, MarkerNote
from hailscout_api.db.models.org import User
from hailscout_api.db.session import get_db_session
from hailscout_api.services.audit import write_event
from hailscout_api.schemas.marker_note import MarkerNoteCreate, MarkerNoteResponse
from hailscout_api.schemas.marker import (
    MarkerBulkCreate,
    MarkerCreate,
    MarkerResponse,
    MarkerUpdate,
    VALID_STATUSES,
)

logger = get_logger(__name__)
router = APIRouter()


async def _resolve_user(request: Request, session: AsyncSession) -> User:
    """Verify Clerk JWT, return the local User row.

    Mirrors the simplified pattern from /v1/me — we look up by
    User.clerk_user_id (NOT User.id, those are different ids).
    """
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
        raise AuthenticationError("User not found — webhook may not have reconciled yet")
    return user


def _marker_id() -> str:
    return f"mk_{secrets.token_urlsafe(10)}"


@router.get("/markers", response_model=list[MarkerResponse])
async def list_markers(
    request: Request,
    storm_id: Optional[str] = None,
    session: AsyncSession = Depends(get_db_session),
) -> list[Marker]:
    """List markers for the signed-in user's org."""
    user = await _resolve_user(request, session)

    stmt = select(Marker).where(Marker.org_id == user.org_id)
    if storm_id:
        stmt = stmt.where(Marker.storm_id == storm_id)
    stmt = stmt.order_by(Marker.updated_at.desc())

    rows = (await session.execute(stmt)).scalars().all()
    return list(rows)


@router.post("/markers", response_model=MarkerResponse, status_code=201)
async def create_marker(
    request: Request,
    body: MarkerCreate,
    session: AsyncSession = Depends(get_db_session),
) -> Marker:
    """Drop a single canvassing marker."""
    if body.status not in VALID_STATUSES:
        raise HTTPException(status_code=422, detail=f"Invalid status: {body.status}")

    user = await _resolve_user(request, session)

    # Idempotent upsert via client_id
    if body.client_id:
        existing = (
            await session.execute(
                select(Marker).where(
                    and_(
                        Marker.org_id == user.org_id,
                        Marker.client_id == body.client_id,
                    )
                )
            )
        ).scalars().first()
        if existing is not None:
            return existing

    marker = Marker(
        id=_marker_id(),
        user_id=user.id,
        org_id=user.org_id,
        storm_id=body.storm_id,
        parcel_id=body.parcel_id,
        assignee_user_id=body.assignee_user_id,
        client_id=body.client_id,
        lat=body.lat,
        lng=body.lng,
        status=body.status,
        notes=body.notes,
    )
    session.add(marker)
    await session.commit()
    await session.refresh(marker)
    await write_event(
        session,
        action="marker.created",
        org_id=user.org_id,
        user_id=user.id,
        subject_type="marker",
        subject_id=marker.id,
        metadata={"status": marker.status},
    )
    return marker


@router.post("/markers/bulk", response_model=list[MarkerResponse], status_code=201)
async def bulk_create_markers(
    request: Request,
    body: MarkerBulkCreate,
    session: AsyncSession = Depends(get_db_session),
) -> list[Marker]:
    """Bulk-create markers — used for localStorage->API migration on first sign-in.
    Idempotent via client_id.
    """
    user = await _resolve_user(request, session)

    out: list[Marker] = []
    seen_client_ids: set[str] = set()

    if body.markers:
        client_ids = [m.client_id for m in body.markers if m.client_id]
        if client_ids:
            existing_rows = (
                await session.execute(
                    select(Marker).where(
                        and_(
                            Marker.org_id == user.org_id,
                            Marker.client_id.in_(client_ids),
                        )
                    )
                )
            ).scalars().all()
            for r in existing_rows:
                if r.client_id:
                    seen_client_ids.add(r.client_id)
            out.extend(existing_rows)

    for m in body.markers:
        if m.status not in VALID_STATUSES:
            continue  # silently drop bad rows in bulk path
        if m.client_id and m.client_id in seen_client_ids:
            continue
        marker = Marker(
            id=_marker_id(),
            user_id=user.id,
            org_id=user.org_id,
            storm_id=m.storm_id,
            parcel_id=m.parcel_id,
            assignee_user_id=m.assignee_user_id,
            client_id=m.client_id,
            lat=m.lat,
            lng=m.lng,
            status=m.status,
            notes=m.notes,
        )
        session.add(marker)
        out.append(marker)
        if m.client_id:
            seen_client_ids.add(m.client_id)

    await session.commit()
    for r in out:
        await session.refresh(r)
    return out


@router.patch("/markers/{marker_id}", response_model=MarkerResponse)
async def update_marker(
    request: Request,
    marker_id: str,
    body: MarkerUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> Marker:
    """Update marker status or notes. Org-scoped."""
    user = await _resolve_user(request, session)

    if body.status is not None and body.status not in VALID_STATUSES:
        raise HTTPException(status_code=422, detail=f"Invalid status: {body.status}")

    marker = (
        await session.execute(
            select(Marker).where(
                and_(Marker.id == marker_id, Marker.org_id == user.org_id),
            )
        )
    ).scalars().first()
    if marker is None:
        raise HTTPException(status_code=404, detail="Marker not found")

    if body.status is not None:
        marker.status = body.status
    if body.notes is not None:
        marker.notes = body.notes
    if body.assignee_user_id is not None:
        # Empty string == clear assignment
        marker.assignee_user_id = body.assignee_user_id or None

    await session.commit()
    await session.refresh(marker)
    return marker


@router.delete("/markers/{marker_id}")
async def delete_marker(
    request: Request,
    marker_id: str,
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    user = await _resolve_user(request, session)

    marker = (
        await session.execute(
            select(Marker).where(
                and_(Marker.id == marker_id, Marker.org_id == user.org_id),
            )
        )
    ).scalars().first()
    if marker is None:
        raise HTTPException(status_code=404, detail="Marker not found")

    await session.delete(marker)
    await session.commit()
    return Response(status_code=204)



# ────────────────────────────────────────────────────────────────────
# Marker notes (Phase 12.2)
# ────────────────────────────────────────────────────────────────────


@router.get("/markers/{marker_id}/notes", response_model=list[MarkerNoteResponse])
async def list_marker_notes(
    request: Request,
    marker_id: str,
    session: AsyncSession = Depends(get_db_session),
) -> list[MarkerNoteResponse]:
    user = await _resolve_user(request, session)

    # Verify the marker is in the org
    marker = (
        await session.execute(
            select(Marker).where(
                and_(Marker.id == marker_id, Marker.org_id == user.org_id),
            )
        )
    ).scalars().first()
    if marker is None:
        raise HTTPException(status_code=404, detail="Marker not found")

    rows = (
        await session.execute(
            select(MarkerNote)
            .where(MarkerNote.marker_id == marker_id)
            .order_by(MarkerNote.created_at.asc()),
        )
    ).scalars().all()

    # Resolve user emails in one batch
    user_ids = list({r.user_id for r in rows})
    email_map: dict[str, str] = {}
    if user_ids:
        users = (
            await session.execute(
                select(User).where(User.id.in_(user_ids)),
            )
        ).scalars().all()
        email_map = {u.id: u.email for u in users}

    return [
        MarkerNoteResponse(
            id=r.id,
            marker_id=r.marker_id,
            user_id=r.user_id,
            user_email=email_map.get(r.user_id),
            body=r.body,
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.post("/markers/{marker_id}/notes", response_model=MarkerNoteResponse, status_code=201)
async def create_marker_note(
    request: Request,
    marker_id: str,
    body: MarkerNoteCreate,
    session: AsyncSession = Depends(get_db_session),
) -> MarkerNoteResponse:
    user = await _resolve_user(request, session)

    marker = (
        await session.execute(
            select(Marker).where(
                and_(Marker.id == marker_id, Marker.org_id == user.org_id),
            )
        )
    ).scalars().first()
    if marker is None:
        raise HTTPException(status_code=404, detail="Marker not found")

    note = MarkerNote(
        marker_id=marker_id,
        org_id=user.org_id,
        user_id=user.id,
        body=body.body,
    )
    session.add(note)
    await session.commit()
    await session.refresh(note)

    return MarkerNoteResponse(
        id=note.id,
        marker_id=note.marker_id,
        user_id=note.user_id,
        user_email=user.email,
        body=note.body,
        created_at=note.created_at,
    )
