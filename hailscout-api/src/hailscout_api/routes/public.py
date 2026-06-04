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
from hailscout_api.db.models.storm import Storm
from hailscout_api.db.session import get_db_session
from hailscout_api.data.storm_fixtures import all_fixtures
from hailscout_api.services.calibration import compute_calibration
from hailscout_api.services.exposure import get_area_exposure

router = APIRouter()


class PublicStats(BaseModel):
    storms_tracked: int
    storms_live: int
    addresses_monitored: int
    alerts_this_week: int
    organizations: int
    # Live-data freshness for a user-facing "current as of" signal.
    live_as_of: str | None = None
    data_fresh: bool = False


class AccuracyStat(BaseModel):
    """Public credibility stat for the marketing site.

    Leads with the CONFIRMATION story — how many of our detections are
    independently corroborated by NWS ground reports — which is our
    real, defensible differentiator. (Raw size-accuracy % is mediocre
    for every radar product, so we don't headline it; `within_quarter_inch`
    is exposed for reference only.) `headline` is null until the
    confirmation count is large enough to be credible.
    """
    headline: str | None
    confirmed_events: int
    sample_size: int
    within_quarter_inch: float | None


@router.get("/public/stats", response_model=PublicStats)
async def public_stats(
    session: AsyncSession = Depends(get_db_session),
) -> PublicStats:
    """Aggregate counts. Cached at the CDN edge so this can be polled cheaply.

    Real DB counts (not fixtures) so the marketing ticker shows our
    actual coverage, plus a live-data freshness signal.
    """
    now = datetime.now(timezone.utc)
    two_hours_ago = now - timedelta(hours=2)

    # Total real storms tracked, and how many are "live" (last 2h).
    storms_tracked = int(
        (await session.execute(select(func.count(Storm.id)))).scalar_one() or 0
    )
    storms_live = int(
        (await session.execute(
            select(func.count(Storm.id)).where(Storm.start_time >= two_hours_ago)
        )).scalar_one() or 0
    )
    # Newest live (MRMS) storm → freshness signal.
    latest = (
        await session.execute(
            select(Storm.start_time)
            .where(Storm.source == "MRMS")
            .order_by(Storm.start_time.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    live_as_of: str | None = None
    data_fresh = False
    if latest is not None:
        if latest.tzinfo is None:
            latest = latest.replace(tzinfo=timezone.utc)
        live_as_of = latest.isoformat()
        data_fresh = (now - latest).total_seconds() <= 180 * 60

    # If the DB is somehow empty (fresh env), fall back to fixtures so the
    # marketing site never shows a bare zero.
    if storms_tracked == 0:
        fixtures = all_fixtures()
        storms_tracked = len(fixtures)
        storms_live = sum(1 for s in fixtures if s.is_live)

    address_count = (
        await session.execute(select(func.count(MonitoredAddress.id)))
    ).scalar_one()
    org_count = (
        await session.execute(select(func.count(Organization.id)))
    ).scalar_one()

    week_ago = now - timedelta(days=7)
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
        live_as_of=live_as_of,
        data_fresh=data_fresh,
    )


class ExposureResponse(BaseModel):
    """Area demographics for lead prospecting (Phase 28).

    Always returns the area name (keyless geocoder); population/housing/
    home-value/income require a free CENSUS_API_KEY and are null until
    it's set (see `note`).
    """
    available: bool
    area_name: str | None = None
    county_name: str | None = None
    population: int | None = None
    housing_units: int | None = None
    median_home_value: int | None = None
    median_household_income: int | None = None
    note: str | None = None


@router.get("/public/exposure", response_model=ExposureResponse)
async def public_exposure(lat: float, lng: float) -> ExposureResponse:
    """Area economics for a point — population, households, home value,
    income — so a contractor can size up a hit neighborhood. Free Census
    data, cached. No auth."""
    exp = await get_area_exposure(lat, lng)
    d = exp.as_dict()
    return ExposureResponse(
        available=d["available"],
        area_name=d.get("area_name"),
        county_name=d.get("county_name"),
        population=d.get("population"),
        housing_units=d.get("housing_units"),
        median_home_value=d.get("median_home_value"),
        median_household_income=d.get("median_household_income"),
        note=d.get("note"),
    )


# Below this many independent confirmations, we don't publish the stat —
# a small number reads worse than none.
_CONFIRM_HEADLINE_MIN = 100


@router.get("/public/accuracy", response_model=AccuracyStat)
async def public_accuracy(
    session: AsyncSession = Depends(get_db_session),
) -> AccuracyStat:
    """Public credibility stat — leads with the count of radar detections
    independently confirmed by NWS ground reports. Safe to poll /
    CDN-cache. Headline is null until the confirmation count is credible.
    """
    confirmed_events = (
        await session.execute(
            select(func.count(Storm.id)).where(
                Storm.source != "SPC-LSR",
                Storm.lsr_confirmed.is_(True),
            )
        )
    ).scalar_one() or 0

    headline = None
    if confirmed_events >= _CONFIRM_HEADLINE_MIN:
        headline = (
            f"{confirmed_events:,} hail events on HailScout are independently "
            "confirmed by National Weather Service ground reports."
        )

    # Sizing accuracy kept for reference (not headlined — radar size is
    # inherently scattered vs. spotter reports for every product).
    calib = await compute_calibration(session, min_size_in=1.0)
    return AccuracyStat(
        headline=headline,
        confirmed_events=int(confirmed_events),
        sample_size=int(calib.get("sample_size", 0)),
        within_quarter_inch=calib.get("within_0_25in"),
    )
