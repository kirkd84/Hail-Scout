"""Public, no-auth endpoints for the marketing site.

Aggregate counts only — never per-tenant data.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.db.models.canvass import MonitoredAddress, StormAlert
from hailscout_api.db.models.org import Organization
from hailscout_api.db.session import get_db_session
from hailscout_api.data.storm_fixtures import all_fixtures

router = APIRouter()


class PublicStats(BaseModel):
    storms_tracked: int
    storms_live: int
    addresses_monitored: int
    alerts_this_week: int
    organizations: int


@router.get("/public/stats", response_model=PublicStats)
async def public_stats(
    session: AsyncSession = Depends(get_db_session),
) -> PublicStats:
    """Aggregate counts. Cached at the CDN edge so this can be polled cheaply."""

    fixtures = all_fixtures()
    storms_live = sum(1 for s in fixtures if s.is_live)
    storms_tracked = len(fixtures)

    address_count = (
        await session.execute(select(func.count(MonitoredAddress.id)))
    ).scalar_one()
    org_count = (
        await session.execute(select(func.count(Organization.id)))
    ).scalar_one()

    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    alerts_count = (
        await session.execute(
            select(func.count(StormAlert.id)).where(StormAlert.created_at >= week_ago),
        )
    ).scalar_one()

    return PublicStats(
        storms_tracked=storms_tracked,
        storms_live=storms_live,
        addresses_monitored=int(address_count or 0),
        alerts_this_week=int(alerts_count or 0),
        organizations=int(org_count or 0),
    )
