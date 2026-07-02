"""Alert-zone CRUD (Phase 33 — storm alarms).

Zones are per-user ("MY alarm areas") but org-scoped: list returns the
signed-in user's zones; the generator matches every enabled zone in the
org and fans alerts out to that zone's owner.
"""

from __future__ import annotations

import json
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.auth.session import verify_access_token
from hailscout_api.core import AuthenticationError, get_logger
from hailscout_api.db.models.canvass import AlertZone
from hailscout_api.db.models.org import User
from hailscout_api.db.session import get_db_session
from hailscout_api.schemas.alert_zone import (
    VALID_STATES,
    AlertZoneCreate,
    AlertZoneResponse,
    AlertZoneUpdate,
)

logger = get_logger(__name__)
router = APIRouter()


async def _resolve_user(request: Request, session: AsyncSession) -> User:
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise AuthenticationError("Missing Authorization header")
    try:
        scheme, token = auth_header.split(" ", 1)
    except ValueError as exc:
        raise AuthenticationError("Invalid Authorization header format") from exc
    if scheme.lower() != "bearer":
        raise AuthenticationError("Only Bearer tokens supported")
    claims = verify_access_token(token)
    user_id = claims.get("sub")
    if not user_id:
        raise AuthenticationError("JWT missing sub claim")
    user = (
        await session.execute(select(User).where(User.id == user_id))
    ).scalars().first()
    if not user:
        raise AuthenticationError("User not found")
    return user


def _zone_id() -> str:
    return f"zone_{secrets.token_urlsafe(10)}"


def _validate(body: AlertZoneCreate | AlertZoneUpdate, *, kind: str) -> None:
    """Cross-field rules the pydantic per-field bounds can't express."""
    if kind == "radius":
        lat = body.center_lat
        lng = body.center_lng
        r = body.radius_mi
        if lat is None or lng is None or r is None:
            raise HTTPException(
                status_code=422,
                detail="Radius zones need center_lat, center_lng and radius_mi",
            )
    elif kind == "states":
        states = body.states or []
        if not states:
            raise HTTPException(
                status_code=422, detail="State zones need at least one state"
            )
        bad = [s for s in states if s.upper() not in VALID_STATES]
        if bad:
            raise HTTPException(
                status_code=422, detail=f"Unknown state code(s): {', '.join(bad)}"
            )
    if body.min_hail_in is None and body.min_wind_mph is None:
        raise HTTPException(
            status_code=422,
            detail="Set a hail size, a wind speed, or both — otherwise the "
                   "zone would never alert.",
        )


def _adapt(z: AlertZone) -> AlertZoneResponse:
    return AlertZoneResponse(
        id=z.id,
        org_id=z.org_id,
        user_id=z.user_id,
        name=z.name,
        kind=z.kind,  # type: ignore[arg-type]
        center_lat=z.center_lat,
        center_lng=z.center_lng,
        radius_mi=z.radius_mi,
        states=json.loads(z.states) if z.states else None,
        min_hail_in=z.min_hail_in,
        min_wind_mph=z.min_wind_mph,
        enabled=z.enabled,
        created_at=z.created_at,
        updated_at=z.updated_at,
    )


@router.get("/alert-zones", response_model=list[AlertZoneResponse])
async def list_zones(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> list[AlertZoneResponse]:
    user = await _resolve_user(request, session)
    rows = (
        await session.execute(
            select(AlertZone)
            .where(
                and_(
                    AlertZone.org_id == user.org_id,
                    AlertZone.user_id == user.id,
                )
            )
            .order_by(AlertZone.created_at.asc()),
        )
    ).scalars().all()
    return [_adapt(z) for z in rows]


@router.post("/alert-zones", response_model=AlertZoneResponse, status_code=201)
async def create_zone(
    request: Request,
    body: AlertZoneCreate,
    session: AsyncSession = Depends(get_db_session),
) -> AlertZoneResponse:
    user = await _resolve_user(request, session)
    _validate(body, kind=body.kind)
    z = AlertZone(
        id=_zone_id(),
        org_id=user.org_id,
        user_id=user.id,
        name=body.name,
        kind=body.kind,
        center_lat=body.center_lat,
        center_lng=body.center_lng,
        radius_mi=body.radius_mi,
        states=(
            json.dumps([s.upper() for s in body.states]) if body.states else None
        ),
        min_hail_in=body.min_hail_in,
        min_wind_mph=body.min_wind_mph,
        enabled=body.enabled,
    )
    session.add(z)
    await session.commit()
    await session.refresh(z)
    logger.info("alert_zone.created", extra={"zone_id": z.id, "kind": z.kind})
    return _adapt(z)


@router.patch("/alert-zones/{zone_id}", response_model=AlertZoneResponse)
async def update_zone(
    request: Request,
    zone_id: str,
    body: AlertZoneUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> AlertZoneResponse:
    user = await _resolve_user(request, session)
    z = (
        await session.execute(
            select(AlertZone).where(
                and_(
                    AlertZone.id == zone_id,
                    AlertZone.org_id == user.org_id,
                    AlertZone.user_id == user.id,
                )
            ),
        )
    ).scalars().first()
    if z is None:
        raise HTTPException(status_code=404, detail="Zone not found")

    if body.name is not None:
        z.name = body.name
    if body.kind is not None:
        z.kind = body.kind
    if body.center_lat is not None:
        z.center_lat = body.center_lat
    if body.center_lng is not None:
        z.center_lng = body.center_lng
    if body.radius_mi is not None:
        z.radius_mi = body.radius_mi
    if body.states is not None:
        z.states = json.dumps([s.upper() for s in body.states]) if body.states else None
    if body.min_hail_in is not None:
        z.min_hail_in = body.min_hail_in
    if body.min_wind_mph is not None:
        z.min_wind_mph = body.min_wind_mph
    if body.enabled is not None:
        z.enabled = body.enabled

    # Re-validate the RESULTING zone (patch may have changed kind or
    # cleared a requirement).
    merged = AlertZoneUpdate(
        center_lat=z.center_lat,
        center_lng=z.center_lng,
        radius_mi=z.radius_mi,
        states=json.loads(z.states) if z.states else None,
        min_hail_in=z.min_hail_in,
        min_wind_mph=z.min_wind_mph,
    )
    _validate(merged, kind=z.kind)

    await session.commit()
    await session.refresh(z)
    return _adapt(z)


@router.delete("/alert-zones/{zone_id}")
async def delete_zone(
    request: Request,
    zone_id: str,
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    user = await _resolve_user(request, session)
    z = (
        await session.execute(
            select(AlertZone).where(
                and_(
                    AlertZone.id == zone_id,
                    AlertZone.org_id == user.org_id,
                    AlertZone.user_id == user.id,
                )
            ),
        )
    ).scalars().first()
    if z is None:
        raise HTTPException(status_code=404, detail="Zone not found")
    await session.delete(z)
    await session.commit()
    return Response(status_code=204)
