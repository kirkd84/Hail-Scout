"""Territory zone CRUD."""

from __future__ import annotations

import json
import secrets
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.auth.clerk import ClerkVerifier
from hailscout_api.config import get_settings
from hailscout_api.core import AuthenticationError, AuthorizationError, get_logger
from hailscout_api.db.models.org import User
from hailscout_api.db.models.territory import Territory
from hailscout_api.db.session import get_db_session
from hailscout_api.schemas.territory import (
    TerritoryCreate,
    TerritoryResponse,
    TerritoryUpdate,
)
from hailscout_api.services.audit import write_event

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


def _require_admin(user: User) -> None:
    if user.is_super_admin or user.role in {"owner", "admin"}:
        return
    raise AuthorizationError("Admin or owner required")


def _territory_id() -> str:
    return f"tz_{secrets.token_urlsafe(10)}"


def _adapt(t: Territory, email_by_id: dict[str, str]) -> TerritoryResponse:
    return TerritoryResponse(
        id=t.id,
        org_id=t.org_id,
        name=t.name,
        color=t.color,
        polygon=json.loads(t.polygon_json),
        assignee_user_id=t.assignee_user_id,
        assignee_email=email_by_id.get(t.assignee_user_id) if t.assignee_user_id else None,
        notes=t.notes,
        created_by_user_id=t.created_by_user_id,
        created_at=t.created_at,
        updated_at=t.updated_at,
    )


async def _email_map(session: AsyncSession, ids: list[str]) -> dict[str, str]:
    if not ids:
        return {}
    rows = (
        await session.execute(select(User).where(User.id.in_(ids)))
    ).scalars().all()
    return {u.id: u.email for u in rows}


@router.get("/territories", response_model=list[TerritoryResponse])
async def list_territories(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> list[TerritoryResponse]:
    user = await _resolve_user(request, session)
    rows = (
        await session.execute(
            select(Territory)
            .where(Territory.org_id == user.org_id)
            .order_by(Territory.created_at.desc()),
        )
    ).scalars().all()
    emap = await _email_map(session, list({r.assignee_user_id for r in rows if r.assignee_user_id}))
    return [_adapt(r, emap) for r in rows]


@router.post("/territories", response_model=TerritoryResponse, status_code=201)
async def create_territory(
    request: Request,
    body: TerritoryCreate,
    session: AsyncSession = Depends(get_db_session),
) -> TerritoryResponse:
    user = await _resolve_user(request, session)
    if len(body.polygon) < 3:
        raise HTTPException(status_code=422, detail="Polygon needs at least 3 vertices")

    t = Territory(
        id=_territory_id(),
        org_id=user.org_id,
        name=body.name,
        color=body.color,
        polygon_json=json.dumps(body.polygon),
        assignee_user_id=body.assignee_user_id,
        notes=body.notes,
        created_by_user_id=user.id,
    )
    session.add(t)
    await session.commit()
    await session.refresh(t)
    await write_event(
        session,
        action="territory.created",
        org_id=user.org_id,
        user_id=user.id,
        subject_type="territory",
        subject_id=t.id,
        metadata={"name": t.name, "vertices": len(body.polygon)},
    )
    emap = await _email_map(session, [t.assignee_user_id] if t.assignee_user_id else [])
    return _adapt(t, emap)


@router.patch("/territories/{territory_id}", response_model=TerritoryResponse)
async def update_territory(
    request: Request,
    territory_id: str,
    body: TerritoryUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> TerritoryResponse:
    user = await _resolve_user(request, session)
    t = (
        await session.execute(
            select(Territory).where(
                and_(Territory.id == territory_id, Territory.org_id == user.org_id),
            ),
        )
    ).scalars().first()
    if t is None:
        raise HTTPException(status_code=404, detail="Territory not found")

    if body.name is not None:        t.name = body.name
    if body.color is not None:       t.color = body.color
    if body.notes is not None:       t.notes = body.notes
    if body.assignee_user_id is not None:
        # Empty string -> unassign
        t.assignee_user_id = body.assignee_user_id or None
    if body.polygon is not None:
        if len(body.polygon) < 3:
            raise HTTPException(status_code=422, detail="Polygon needs at least 3 vertices")
        t.polygon_json = json.dumps(body.polygon)

    await session.commit()
    await session.refresh(t)
    emap = await _email_map(session, [t.assignee_user_id] if t.assignee_user_id else [])
    return _adapt(t, emap)


@router.delete("/territories/{territory_id}")
async def delete_territory(
    request: Request,
    territory_id: str,
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    user = await _resolve_user(request, session)
    _require_admin(user)
    t = (
        await session.execute(
            select(Territory).where(
                and_(Territory.id == territory_id, Territory.org_id == user.org_id),
            ),
        )
    ).scalars().first()
    if t is None:
        raise HTTPException(status_code=404, detail="Territory not found")
    await session.delete(t)
    await session.commit()
    return Response(status_code=204)
