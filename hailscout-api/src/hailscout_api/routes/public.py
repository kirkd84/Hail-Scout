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
from hailscout_api.services.calibration import compute_calibration, marketing_headline

router = APIRouter()


class PublicStats(BaseModel):
    storms_tracked: int
    storms_live: int
    addresses_monitored: int
    alerts_this_week: int
    organizations: int


class AccuracyStat(BaseModel):
    """Public, aggregate accuracy stat for the marketing site.

    Exposes ONLY the headline + sample size + the ±0.25" hit rate —
    no per-storm data, no internal error metrics. `headline` is null
    until the verified-pair sample is large enough to be credible
    (≥100), so we never publish a flimsy number.
    """
    headline: str | None
    sample_size: int
    within_quarter_inch: float | None


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


@router.get("/public/accuracy", response_model=AccuracyStat)
async def public_accuracy(
    session: AsyncSession = Depends(get_db_session),
) -> AccuracyStat:
    """Measured accuracy vs. ground truth — the credibility stat.

    Restricts to claim-relevant sizes (≥1.0") and returns only the
    publishable headline. Safe to poll / CDN-cache. Returns a null
    headline (which the UI hides) until the sample is credible.
    """
    calib = await compute_calibration(session, min_size_in=1.0)
    return AccuracyStat(
        headline=marketing_headline(calib),
        sample_size=int(calib.get("sample_size", 0)),
        within_quarter_inch=calib.get("within_0_25in"),
    )
