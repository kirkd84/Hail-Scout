"""Monitored address CRUD."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.auth.clerk import ClerkVerifier
from hailscout_api.config import get_settings
from hailscout_api.core import AuthenticationError, get_logger
from hailscout_api.db.models.canvass import MonitoredAddress
from hailscout_api.db.models.org import User
from hailscout_api.db.session import get_db_session
from hailscout_api.schemas.monitored_address import (
    MonitoredAddressBulkCreate,
    MonitoredAddressCreate,
    MonitoredAddressResponse,
    MonitoredAddressUpdate,
)
from hailscout_api.schemas.alert import StormAlertList, StormAlertResponse
from hailscout_api.db.models.canvass import StormAlert
from hailscout_api.data.storm_fixtures import all_fixtures, storm_at
from datetime import datetime, timezone

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
        raise AuthenticationError("User not found — webhook may not have reconciled yet")
    return user


def _near(a: MonitoredAddress, lat: float, lng: float, tol: float = 0.0005) -> bool:
    if a.lat is None or a.lng is None:
        return False
    return abs(a.lat - lat) < tol and abs(a.lng - lng) < tol


@router.get("/monitored-addresses", response_model=list[MonitoredAddressResponse])
async def list_monitored_addresses(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> list[MonitoredAddress]:
    """List monitored addresses for the signed-in user's org."""
    user = await _resolve_user(request, session)
    rows = (
        await session.execute(
            select(MonitoredAddress)
            .where(MonitoredAddress.org_id == user.org_id)
            .order_by(MonitoredAddress.updated_at.desc()),
        )
    ).scalars().all()
    return list(rows)


@router.post("/monitored-addresses", response_model=MonitoredAddressResponse, status_code=201)
async def create_monitored_address(
    request: Request,
    body: MonitoredAddressCreate,
    session: AsyncSession = Depends(get_db_session),
) -> MonitoredAddress:
    """Add an address to the watchlist. Dedups by lat/lng (~50m)."""
    user = await _resolve_user(request, session)

    # Dedup
    existing_rows = (
        await session.execute(
            select(MonitoredAddress).where(MonitoredAddress.org_id == user.org_id),
        )
    ).scalars().all()
    for ex in existing_rows:
        if _near(ex, body.lat, body.lng):
            # Refresh the cached storm meta on the existing entry
            ex.address = body.address
            if body.label is not None:
                ex.label = body.label
            if body.alert_threshold_in is not None:
                ex.alert_threshold_in = body.alert_threshold_in
            ex.last_storm_at = body.last_storm_at
            ex.last_storm_size_in = body.last_storm_size_in
            await session.commit()
            await session.refresh(ex)
            return ex

    addr = MonitoredAddress(
        org_id=user.org_id,
        user_id=user.id,
        address=body.address,
        label=body.label,
        lat=body.lat,
        lng=body.lng,
        alert_threshold_in=body.alert_threshold_in or 0.75,
        last_storm_at=body.last_storm_at,
        last_storm_size_in=body.last_storm_size_in,
    )
    session.add(addr)
    await session.commit()
    await session.refresh(addr)
    return addr


@router.post("/monitored-addresses/bulk", response_model=list[MonitoredAddressResponse], status_code=201)
async def bulk_create_monitored_addresses(
    request: Request,
    body: MonitoredAddressBulkCreate,
    session: AsyncSession = Depends(get_db_session),
) -> list[MonitoredAddress]:
    """Bulk-create — used for localStorage->API migration. Dedups by lat/lng."""
    user = await _resolve_user(request, session)

    existing_rows = (
        await session.execute(
            select(MonitoredAddress).where(MonitoredAddress.org_id == user.org_id),
        )
    ).scalars().all()

    out: list[MonitoredAddress] = list(existing_rows)
    out_keys = {(round(a.lat or 0, 4), round(a.lng or 0, 4)) for a in existing_rows}

    for a in body.addresses:
        key = (round(a.lat, 4), round(a.lng, 4))
        if key in out_keys:
            continue
        addr = MonitoredAddress(
            org_id=user.org_id,
            user_id=user.id,
            address=a.address,
            label=a.label,
            lat=a.lat,
            lng=a.lng,
            alert_threshold_in=a.alert_threshold_in or 0.75,
            last_storm_at=a.last_storm_at,
            last_storm_size_in=a.last_storm_size_in,
        )
        session.add(addr)
        out.append(addr)
        out_keys.add(key)

    await session.commit()
    for r in out:
        if r in session:
            await session.refresh(r)
    return out


@router.patch("/monitored-addresses/{address_id}", response_model=MonitoredAddressResponse)
async def update_monitored_address(
    request: Request,
    address_id: int,
    body: MonitoredAddressUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> MonitoredAddress:
    user = await _resolve_user(request, session)

    addr = (
        await session.execute(
            select(MonitoredAddress).where(
                and_(
                    MonitoredAddress.id == address_id,
                    MonitoredAddress.org_id == user.org_id,
                ),
            )
        )
    ).scalars().first()
    if addr is None:
        raise HTTPException(status_code=404, detail="Address not found")

    if body.label is not None:
        addr.label = body.label
    if body.alert_threshold_in is not None:
        addr.alert_threshold_in = body.alert_threshold_in
    if body.last_storm_at is not None:
        addr.last_storm_at = body.last_storm_at
    if body.last_storm_size_in is not None:
        addr.last_storm_size_in = body.last_storm_size_in

    await session.commit()
    await session.refresh(addr)
    return addr


@router.delete("/monitored-addresses/{address_id}", status_code=204, response_class=Response)
async def delete_monitored_address(
    request: Request,
    address_id: int,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    user = await _resolve_user(request, session)

    addr = (
        await session.execute(
            select(MonitoredAddress).where(
                and_(
                    MonitoredAddress.id == address_id,
                    MonitoredAddress.org_id == user.org_id,
                ),
            )
        )
    ).scalars().first()
    if addr is None:
        raise HTTPException(status_code=404, detail="Address not found")

    await session.delete(addr)
    await session.commit()


# ──────────────────────────────────────────────────────────────────
# Storm alerts (Phase 6.1 — lazy generation)
# ──────────────────────────────────────────────────────────────────


@router.get("/alerts", response_model=StormAlertList)
async def list_alerts(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> StormAlertList:
    """Lazy-generated storm alerts.

    On each fetch we:
      1. Pull every monitored address for the user's org
      2. For each address × every fixture storm, check bbox containment
      3. If peak_size_in >= alert_threshold_in (default 0.75), persist an
         alert (idempotent via (org_id, address_id, storm_id) unique index)
      4. Return all non-dismissed alerts joined with the address record

    Once the real MRMS pipeline ships, this becomes a background job — but
    the API contract stays exactly the same.
    """
    user = await _resolve_user(request, session)

    # 1. Load monitored addresses for the org
    addresses = (
        await session.execute(
            select(MonitoredAddress).where(MonitoredAddress.org_id == user.org_id),
        )
    ).scalars().all()

    address_by_id = {a.id: a for a in addresses}

    # 2. Compute new matches
    fixtures = all_fixtures()
    new_matches: list[dict] = []
    for addr in addresses:
        if addr.lat is None or addr.lng is None:
            continue
        threshold = addr.alert_threshold_in or 0.75
        for storm in fixtures:
            if storm.peak_size_in < threshold:
                continue
            if not storm_at(addr.lat, addr.lng, storm):
                continue
            new_matches.append({
                "monitored_address_id": addr.id,
                "storm_id": storm.id,
                "storm_city": storm.city,
                "peak_size_in": storm.peak_size_in,
                "storm_started_at": storm.start_time,
            })

    # 3. Persist new alerts (best-effort; UNIQUE index makes this idempotent)
    new_count = 0
    for m in new_matches:
        # Check existence first (cheaper than catching IntegrityError per row)
        exists = (
            await session.execute(
                select(StormAlert).where(
                    and_(
                        StormAlert.org_id == user.org_id,
                        StormAlert.monitored_address_id == m["monitored_address_id"],
                        StormAlert.storm_id == m["storm_id"],
                    ),
                ),
            )
        ).scalars().first()
        if exists is not None:
            continue
        alert = StormAlert(
            org_id=user.org_id,
            monitored_address_id=m["monitored_address_id"],
            storm_id=m["storm_id"],
            storm_city=m["storm_city"],
            peak_size_in=m["peak_size_in"],
            storm_started_at=m["storm_started_at"],
        )
        session.add(alert)
        new_count += 1

    if new_count:
        await session.commit()

    # 4. Return the live list
    rows = (
        await session.execute(
            select(StormAlert)
            .where(
                and_(
                    StormAlert.org_id == user.org_id,
                    StormAlert.dismissed_at.is_(None),
                ),
            )
            .order_by(StormAlert.created_at.desc()),
        )
    ).scalars().all()

    out: list[StormAlertResponse] = []
    unread = 0
    for r in rows:
        addr = address_by_id.get(r.monitored_address_id)
        out.append(
            StormAlertResponse(
                id=r.id,
                org_id=r.org_id,
                monitored_address_id=r.monitored_address_id,
                storm_id=r.storm_id,
                storm_city=r.storm_city,
                peak_size_in=r.peak_size_in,
                storm_started_at=r.storm_started_at,
                read_at=r.read_at,
                dismissed_at=r.dismissed_at,
                created_at=r.created_at,
                address=addr.address if addr else None,
                address_label=addr.label if addr else None,
            )
        )
        if r.read_at is None:
            unread += 1

    return StormAlertList(alerts=out, unread_count=unread, new_in_this_fetch=new_count)


@router.post("/alerts/{alert_id}/read", response_model=StormAlertResponse)
async def mark_alert_read(
    request: Request,
    alert_id: int,
    session: AsyncSession = Depends(get_db_session),
) -> StormAlert:
    user = await _resolve_user(request, session)
    alert = (
        await session.execute(
            select(StormAlert).where(
                and_(StormAlert.id == alert_id, StormAlert.org_id == user.org_id),
            ),
        )
    ).scalars().first()
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.read_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(alert)
    return alert


@router.post("/alerts/read-all", status_code=204, response_class=Response)
async def mark_all_alerts_read(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    user = await _resolve_user(request, session)
    rows = (
        await session.execute(
            select(StormAlert).where(
                and_(
                    StormAlert.org_id == user.org_id,
                    StormAlert.read_at.is_(None),
                    StormAlert.dismissed_at.is_(None),
                ),
            ),
        )
    ).scalars().all()
    now = datetime.now(timezone.utc)
    for r in rows:
        r.read_at = now
    if rows:
        await session.commit()


@router.delete("/alerts/{alert_id}", status_code=204, response_class=Response)
async def dismiss_alert(
    request: Request,
    alert_id: int,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    user = await _resolve_user(request, session)
    alert = (
        await session.execute(
            select(StormAlert).where(
                and_(StormAlert.id == alert_id, StormAlert.org_id == user.org_id),
            ),
        )
    ).scalars().first()
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.dismissed_at = datetime.now(timezone.utc)
    await session.commit()
