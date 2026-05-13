"""Storm + hail swath queries against PostGIS."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from geoalchemy2.functions import (
    ST_AsGeoJSON,
    ST_Contains,
    ST_Intersects,
    ST_MakeEnvelope,
    ST_MakePoint,
    ST_Multi,
    ST_SetSRID,
    ST_SimplifyPreserveTopology,
)
from sqlalchemy import func
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.core import get_logger
from hailscout_api.db.models.storm import HailSwath, Storm

logger = get_logger(__name__)


# ---- Storm list (with serialized geometry) ----

async def query_storms_in_bbox(
    session: AsyncSession,
    min_lon: float,
    min_lat: float,
    max_lon: float,
    max_lat: float,
    from_date: datetime,
    to_date: datetime,
    limit: int = 50,
    include_swaths: bool = False,
    swath_simplify_tolerance: float = 0.05,
    source: str | None = None,
    min_hail_size_in: float | None = None,
    order: str = "recent",
) -> list[dict[str, Any]]:
    """Storms whose bbox intersects the query envelope, in date range.

    Returns a list of dicts ready for the Pydantic response — fields
    include `centroid` and `bbox` already serialized to GeoJSON.

    When include_swaths=True, each storm dict also contains a `swaths`
    list with each swath's category + GeoJSON MultiPolygon. Geometries
    are passed through ST_Simplify at the supplied tolerance (degrees)
    so the payload stays sane for CONUS-wide map renders. Tolerance
    0.05 ≈ 5km — fine for zoom 4-6 (state-level), coarse for closer
    inspection. Pass 0 for no simplification.

    Optional server-side filters:
      source           — "MRMS" | "NEXRAD" (case-sensitive match)
      min_hail_size_in — drop storms with peak < this value
    """
    envelope = ST_SetSRID(
        ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat), 4326
    )
    filters = [
        Storm.start_time >= from_date,
        Storm.start_time <= to_date,
        ST_Intersects(Storm.bbox_geom, envelope),
    ]
    if source:
        filters.append(Storm.source == source)
    if min_hail_size_in is not None and min_hail_size_in > 0:
        filters.append(Storm.max_hail_size_in >= min_hail_size_in)

    # Sort: "recent" (default) = by start_time DESC; "peak" = by
    # max_hail_size_in DESC for "biggest events" leaderboards.
    if order == "peak":
        order_clause = Storm.max_hail_size_in.desc()
    else:
        order_clause = Storm.start_time.desc()

    stmt = (
        select(
            Storm.id,
            Storm.start_time,
            Storm.end_time,
            Storm.max_hail_size_in,
            Storm.source,
            ST_AsGeoJSON(Storm.centroid_geom).label("centroid_json"),
            ST_AsGeoJSON(Storm.bbox_geom).label("bbox_json"),
        )
        .where(and_(*filters))
        .order_by(order_clause)
        .limit(limit)
    )
    rows = (await session.execute(stmt)).all()
    out: list[dict[str, Any]] = []
    storm_ids: list[str] = []
    for r in rows:
        out.append({
            "id": r.id,
            "start_time": r.start_time,
            "end_time": r.end_time,
            "max_hail_size_in": r.max_hail_size_in,
            "source": r.source,
            "centroid": json.loads(r.centroid_json) if r.centroid_json else None,
            "bbox": json.loads(r.bbox_json) if r.bbox_json else None,
        })
        storm_ids.append(r.id)

    if include_swaths and storm_ids:
        # Single batched query for every swath belonging to the matched
        # storms — N+1 would be brutal across 200 storms.
        # ST_SimplifyPreserveTopology guarantees a non-empty result even
        # when small per-cell polygons would otherwise collapse under
        # plain ST_Simplify. Wrap with ST_Multi so the output stays a
        # MultiPolygon (simplification can downgrade a single-piece
        # MultiPolygon to a plain Polygon, which fails Pydantic).
        # ST_ChaikinSmoothing(1) rounds the 1km-grid stair-steps into
        # gentler curves without homogenizing every polygon into the
        # same oval. 2 iterations was over-smoothing — small cells lost
        # their shape signature entirely.
        if swath_simplify_tolerance > 0:
            simplified = ST_SimplifyPreserveTopology(
                HailSwath.geom_multipolygon, swath_simplify_tolerance
            )
            smoothed = func.ST_ChaikinSmoothing(simplified, 1)
            geom_expr = ST_AsGeoJSON(ST_Multi(smoothed))
        else:
            geom_expr = ST_AsGeoJSON(HailSwath.geom_multipolygon)
        swath_stmt = (
            select(
                HailSwath.id,
                HailSwath.storm_id,
                HailSwath.hail_size_category,
                geom_expr.label("geom_json"),
                HailSwath.updated_at,
            )
            .where(HailSwath.storm_id.in_(storm_ids))
            .order_by(HailSwath.hail_size_category)
        )
        swath_rows = (await session.execute(swath_stmt)).all()
        by_storm: dict[str, list[dict[str, Any]]] = {sid: [] for sid in storm_ids}
        for s in swath_rows:
            by_storm.setdefault(s.storm_id, []).append({
                "id": s.id,
                "hail_size_category": s.hail_size_category,
                "geometry": json.loads(s.geom_json) if s.geom_json else None,
                "updated_at": s.updated_at,
            })
        for storm in out:
            storm["swaths"] = by_storm.get(storm["id"], [])

    logger.info("Queried storms in bbox", count=len(out),
                bbox=(min_lon, min_lat, max_lon, max_lat),
                include_swaths=include_swaths)
    return out


# ---- Storm detail with swaths ----

async def get_storm_with_swaths(
    session: AsyncSession,
    storm_id: str,
) -> dict[str, Any] | None:
    """Storm + all its hail swaths as GeoJSON. None if not found."""
    storm_stmt = (
        select(
            Storm.id,
            Storm.start_time,
            Storm.end_time,
            Storm.max_hail_size_in,
            Storm.source,
            ST_AsGeoJSON(Storm.centroid_geom).label("centroid_json"),
            ST_AsGeoJSON(Storm.bbox_geom).label("bbox_json"),
        )
        .where(Storm.id == storm_id)
    )
    row = (await session.execute(storm_stmt)).first()
    if row is None:
        return None

    swath_stmt = (
        select(
            HailSwath.id,
            HailSwath.hail_size_category,
            ST_AsGeoJSON(HailSwath.geom_multipolygon).label("geom_json"),
            HailSwath.updated_at,
        )
        .where(HailSwath.storm_id == storm_id)
        .order_by(HailSwath.hail_size_category)
    )
    swath_rows = (await session.execute(swath_stmt)).all()
    swaths = [
        {
            "id": s.id,
            "hail_size_category": s.hail_size_category,
            "geometry": json.loads(s.geom_json) if s.geom_json else None,
            "updated_at": s.updated_at,
        }
        for s in swath_rows
    ]

    return {
        "id": row.id,
        "start_time": row.start_time,
        "end_time": row.end_time,
        "max_hail_size_in": row.max_hail_size_in,
        "source": row.source,
        "centroid": json.loads(row.centroid_json) if row.centroid_json else None,
        "bbox": json.loads(row.bbox_json) if row.bbox_json else None,
        "swaths": swaths,
    }


# ---- "What hit this address?" — storms whose swaths contain the point ----

async def query_hail_at_point(
    session: AsyncSession,
    lat: float,
    lng: float,
    from_date: datetime | None = None,
    to_date: datetime | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    """For a single (lat, lng), return the storms whose hail swaths contain it.

    Each result includes the largest swath category that contains the point.
    """
    point = ST_SetSRID(ST_MakePoint(lng, lat), 4326)

    stmt = (
        select(
            Storm.id,
            Storm.start_time,
            Storm.end_time,
            Storm.max_hail_size_in,
            Storm.source,
            HailSwath.hail_size_category,
        )
        .join(HailSwath, HailSwath.storm_id == Storm.id)
        .where(ST_Contains(HailSwath.geom_multipolygon, point))
    )
    if from_date:
        stmt = stmt.where(Storm.start_time >= from_date)
    if to_date:
        stmt = stmt.where(Storm.start_time <= to_date)
    stmt = stmt.order_by(Storm.start_time.desc()).limit(limit)

    rows = (await session.execute(stmt)).all()

    # Roll up: one row per storm, keeping the *largest* category that contained the point
    by_storm: dict[str, dict[str, Any]] = {}
    for r in rows:
        existing = by_storm.get(r.id)
        cat = r.hail_size_category
        if existing is None:
            by_storm[r.id] = {
                "id": r.id,
                "start_time": r.start_time,
                "end_time": r.end_time,
                "max_hail_size_in": r.max_hail_size_in,
                "source": r.source,
                "category_at_point": cat,
            }
        else:
            # Keep the largest category — order by min_inches as float
            try:
                if _cat_min(cat) > _cat_min(existing["category_at_point"]):
                    existing["category_at_point"] = cat
            except ValueError:
                pass

    out = list(by_storm.values())
    out.sort(key=lambda d: d["start_time"], reverse=True)
    logger.info("Hail at point", lat=lat, lng=lng, hits=len(out))
    return out


def _cat_min(label: str) -> float:
    """Min hail size in inches for a category label like '1.5' or '3.0+'."""
    return float(label.rstrip("+"))
