"""Health check endpoint."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.core import get_logger
from hailscout_api.db.models.storm import Storm
from hailscout_api.db.session import get_db_session

logger = get_logger(__name__)
router = APIRouter()

# Live MRMS ingestion runs on a ~5-min loop. If the newest live-source
# storm is older than this, ingestion has likely stalled — surface it so
# uptime monitors (and we) catch it before a contractor notices a storm
# that never showed up.
_FRESH_MAX_MINUTES = 180


@router.get("/health")
async def health_check(session: AsyncSession = Depends(get_db_session)) -> dict[str, Any]:
    """Health check with DB connectivity + live-data freshness.

    `data_fresh` is the launch-critical signal: it goes false when the
    most recent live (MRMS) storm is stale, i.e. ingestion stopped. It
    reflects ingestion liveness, not whether hail is currently falling —
    a quiet-weather gap is normal — so it's a soft signal: `status`
    stays "ok"; only `data_fresh` flips.
    """
    db_status = "ok"
    latest_iso: str | None = None
    minutes_since: float | None = None
    try:
        await session.execute(text("SELECT 1"))
        latest = (
            await session.execute(
                select(Storm.start_time)
                .where(Storm.source == "MRMS")
                .order_by(Storm.start_time.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if latest is not None:
            if latest.tzinfo is None:
                latest = latest.replace(tzinfo=timezone.utc)
            latest_iso = latest.isoformat()
            minutes_since = round(
                (datetime.now(timezone.utc) - latest).total_seconds() / 60.0, 1
            )
    except Exception as e:
        logger.error("Database health check failed", error=str(e))
        db_status = "error"

    data_fresh = (
        minutes_since is not None and minutes_since <= _FRESH_MAX_MINUTES
    )

    return {
        "status": "ok" if db_status == "ok" else "degraded",
        "db": db_status,
        "data_fresh": data_fresh,
        "latest_live_storm_at": latest_iso,
        "minutes_since_live_storm": minutes_since,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
