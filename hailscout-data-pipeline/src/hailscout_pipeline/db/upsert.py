"""Idempotent upsert for storms + hail_swaths.

Two grouping rules, kept as separate entry points:

  upsert_swaths(swaths)          — legacy daily-rollup mode.
                                   One Storm row per (UTC date, source).
                                   Bbox = union of all swath bboxes
                                   (CONUS-wide on a busy day).

  upsert_cell(swaths)            — per-cell mode (Phase 16.8 follow-up).
                                   One Storm row per (UTC date, source,
                                   cell-centroid). Caller has already
                                   spatially clustered the per-pixel
                                   polygons via `extraction.clustering`
                                   so each call's `swaths` belongs to a
                                   single storm cell. Existing-storm
                                   match uses PostGIS proximity: same
                                   day + source + centroid within
                                   STORM_MERGE_RADIUS_DEG.

Both call sites still rely on the `uq_storm_category` constraint on
hail_swaths so per-storm + per-category swaths upsert idempotently.
"""
from __future__ import annotations
import secrets
from datetime import datetime, timezone

import structlog
from geoalchemy2.functions import ST_DWithin, ST_GeomFromText
from shapely.geometry import MultiPolygon, Point, Polygon, box
from shapely.ops import unary_union
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from hailscout_pipeline.db.models import HailSwath, Storm
from hailscout_pipeline.extraction.polygonize import HailSwath as HailSwathData

log = structlog.get_logger()


# Storms whose centroids fall within this radius on the same UTC day
# and same source are treated as the same Storm. ~55 km at CONUS
# latitudes — wide enough that a cell that drifts a half-degree across
# successive timestamps still upserts to its earlier row, narrow
# enough that two genuinely separate cells stay separate.
STORM_MERGE_RADIUS_DEG = 0.5


def _new_id(prefix: str) -> str:
    return f"{prefix}_{secrets.token_urlsafe(10)}"


def _wkt_with_srid(geom) -> str:
    return f"SRID=4326;{geom.wkt}"


def _day_window(ts: datetime) -> tuple[datetime, datetime]:
    day_start = ts.replace(hour=0, minute=0, second=0,
                           microsecond=0, tzinfo=timezone.utc)
    day_end = day_start.replace(hour=23, minute=59, second=59)
    return day_start, day_end


def _write_swaths(session: Session, storm_id: str,
                  swaths: list[HailSwathData]) -> None:
    """ON CONFLICT upsert of per-category swaths for one storm."""
    for s in swaths:
        stmt = (
            pg_insert(HailSwath)
            .values(
                id=_new_id("swath"),
                storm_id=storm_id,
                hail_size_category=s.hail_size_category,
                geom_multipolygon=_wkt_with_srid(s.geom_multipolygon),
            )
            .on_conflict_do_update(
                constraint="uq_storm_category",
                set_={
                    "geom_multipolygon": _wkt_with_srid(s.geom_multipolygon),
                    "updated_at": datetime.now(timezone.utc),
                },
            )
        )
        session.execute(stmt)


# ── Legacy daily-rollup upsert (still used if clustering is bypassed) ──

def upsert_swaths(session: Session, swaths: list[HailSwathData]) -> dict:
    """Upsert one CONUS-wide Storm + its HailSwaths (daily-rollup mode).

    Returns dict with counts: {"storm_id": ..., "swath_count": ...,
                               "max_hail_size_in": ...}.
    """
    if not swaths:
        log.info("upsert_skipped", reason="no swaths")
        return {"storm_id": None, "swath_count": 0, "max_hail_size_in": 0.0}

    timestamp = swaths[0].timestamp
    source = swaths[0].source
    day_start, day_end = _day_window(timestamp)

    all_geoms = unary_union([s.geom_multipolygon for s in swaths])
    centroid: Point = all_geoms.centroid
    bbox_poly: Polygon = box(*all_geoms.bounds)
    max_size = max(s.max_hail_size_in for s in swaths)

    existing = (
        session.query(Storm)
        .filter(
            Storm.start_time >= day_start,
            Storm.start_time <= day_end,
            Storm.source == source,
        )
        .first()
    )

    if existing:
        storm = existing
        if timestamp > storm.end_time:
            storm.end_time = timestamp
        if max_size > (storm.max_hail_size_in or 0.0):
            storm.max_hail_size_in = max_size
        storm.bbox_geom = _wkt_with_srid(bbox_poly)
        storm.centroid_geom = _wkt_with_srid(centroid)
        storm.updated_at = datetime.now(timezone.utc)
        session.flush()
        log.info("storm_updated", id=storm.id, max_in=storm.max_hail_size_in)
    else:
        storm = Storm(
            id=_new_id("storm"),
            start_time=timestamp,
            end_time=timestamp,
            max_hail_size_in=max_size,
            centroid_geom=_wkt_with_srid(centroid),
            bbox_geom=_wkt_with_srid(bbox_poly),
            source=source,
        )
        session.add(storm)
        session.flush()
        log.info("storm_created", id=storm.id, max_in=storm.max_hail_size_in)

    _write_swaths(session, storm.id, swaths)
    session.commit()
    log.info("upsert_complete", storm_id=storm.id, swaths=len(swaths))
    return {
        "storm_id": storm.id,
        "swath_count": len(swaths),
        "max_hail_size_in": float(storm.max_hail_size_in or 0.0),
    }


# ── Per-cell upsert (Phase 16.8: knock-socks-off mode) ─────────────────

def upsert_cell(session: Session, swaths: list[HailSwathData]) -> dict:
    """Upsert a single storm cell's swaths.

    The caller is responsible for clustering — every swath in this
    call MUST belong to the same storm cell (e.g., it came from
    `cluster_swaths_into_cells`). Match against existing storms uses
    PostGIS `ST_DWithin` so a cell that drifts slightly across
    consecutive timestamps still hits its earlier Storm row.
    """
    if not swaths:
        log.info("upsert_cell_skipped", reason="no swaths")
        return {"storm_id": None, "swath_count": 0, "max_hail_size_in": 0.0}

    timestamp = swaths[0].timestamp
    source = swaths[0].source
    day_start, day_end = _day_window(timestamp)

    cell_union = unary_union([s.geom_multipolygon for s in swaths])
    centroid: Point = cell_union.centroid
    bbox_poly: Polygon = box(*cell_union.bounds)
    max_size = max(s.max_hail_size_in for s in swaths)

    # Spatial proximity match. ST_DWithin uses planar distance for
    # geometry types — fine at the small radii we use here.
    centroid_geom_expr = ST_GeomFromText(_wkt_with_srid(centroid), 4326)
    existing = (
        session.query(Storm)
        .filter(
            Storm.start_time >= day_start,
            Storm.start_time <= day_end,
            Storm.source == source,
            ST_DWithin(Storm.centroid_geom, centroid_geom_expr,
                       STORM_MERGE_RADIUS_DEG),
        )
        .order_by(Storm.start_time.asc())
        .first()
    )

    if existing:
        storm = existing
        if timestamp > storm.end_time:
            storm.end_time = timestamp
        if max_size > (storm.max_hail_size_in or 0.0):
            storm.max_hail_size_in = max_size
        # Centroid is the union of OLD + NEW geometry's centroid would
        # require fetching the old geometry. For v1 we just keep the
        # original centroid (cells don't move much in 6h) and widen
        # the bbox.
        storm.bbox_geom = _wkt_with_srid(bbox_poly)
        storm.updated_at = datetime.now(timezone.utc)
        session.flush()
        log.info("cell_updated", id=storm.id, max_in=storm.max_hail_size_in,
                 swaths=len(swaths))
    else:
        storm = Storm(
            id=_new_id("storm"),
            start_time=timestamp,
            end_time=timestamp,
            max_hail_size_in=max_size,
            centroid_geom=_wkt_with_srid(centroid),
            bbox_geom=_wkt_with_srid(bbox_poly),
            source=source,
        )
        session.add(storm)
        session.flush()
        log.info("cell_created", id=storm.id, max_in=storm.max_hail_size_in,
                 swaths=len(swaths))

    _write_swaths(session, storm.id, swaths)
    session.commit()
    return {
        "storm_id": storm.id,
        "swath_count": len(swaths),
        "max_hail_size_in": float(storm.max_hail_size_in or 0.0),
    }
