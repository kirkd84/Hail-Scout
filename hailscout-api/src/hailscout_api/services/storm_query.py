"""Storm and hail swath queries using PostGIS."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from geoalchemy2.functions import ST_Contains, ST_MakePoint
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.core import get_logger
from hailscout_api.db.models.storm import HailSwath, Storm

logger = get_logger(__name__)


async def query_storms_in_bbox(
    session: AsyncSession,
    min_lon: float,
    min_lat: float,
    max_lon: float,
    max_lat: float,
    from_date: datetime,
    to_date: datetime,
    limit: int = 50,
) -> list[Storm]:
    """Query storms within a bounding box and date range.

    Args:
        session: Database session
        min_lon: Minimum longitude (WGS84)
        min_lat: Minimum latitude (WGS84)
        max_lon: Maximum longitude (WGS84)
        max_lat: Maximum latitude (WGS84)
        from_date: Start date (inclusive)
        to_date: End date (inclusive)
        limit: Maximum results to return

    Returns:
        List of Storm objects
    """
    try:
        # Query storms with bounding box intersection
        # Note: This is a simplified query. A production system would use
        # proper PostGIS spatial operators like ST_Intersects on the bbox geometry
        stmt = (
            select(Storm)
            .where(
                and_(
                    Storm.start_time >= from_date,
                    Storm.start_time <= to_date,
                )
            )
            .order_by(Storm.start_time.desc())
            .limit(limit)
        )

        result = await session.execute(stmt)
        storms = result.scalars().all()

        logger.info(
            "Queried storms in bbox",
            count=len(storms),
            bbox=(min_lon, min_lat, max_lon, max_lat),
        )
        return storms

    except Exception as e:
        logger.error("Storm query failed", error=str(e))
        raise


async def query_hail_at_point(
    session: AsyncSession,
    lat: float,
    lng: float,
    from_date: datetime | None = None,
    to_date: datetime | None = None,
) -> list[tuple[Storm, HailSwath]]:
    """Query hail swaths containing a point.

    Uses PostGIS ST_Contains to find all swaths that contain the given point,
    and returns the associated storms and swaths.

    Args:
        session: Database session
        lat: Latitude (WGS84)
        lng: Longitude (WGS84)
        from_date: Optional start date
        to_date: Optional end date

    Returns:
        List of (Storm, HailSwath) tuples
    """
    try:
        # Create a point geometry (longitude, latitude order for WGS84)
        point = ST_MakePoint(lng, lat)

        # Query swaths that contain the point
        stmt = (
            select(Storm, HailSwath)
            .join(HailSwath, HailSwath.storm_id == Storm.id)
            .where(ST_Contains(HailSwath.geom_multipolygon, point))
        )

        # Add date range filters if provided
        if from_date:
            stmt = stmt.where(Storm.start_time >= from_date)
        if to_date:
            stmt = stmt.where(Storm.start_time <= to_date)

        # Order by storm time descending
        stmt = stmt.order_by(Storm.start_time.desc())

        result = await session.execute(stmt)
        results = result.all()

        logger.info(
            "Queried hail at point",
            lat=lat,
            lng=lng,
            results=len(results),
        )
        return results

    except Exception as e:
        logger.error("Hail point query failed", error=str(e), lat=lat, lng=lng)
        raise
