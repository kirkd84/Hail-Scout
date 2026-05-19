"""Idempotent upsert for storms + hail_swaths.

Four grouping rules:

  upsert_swaths(swaths)        — LEGACY daily-rollup mode.
                                  One Storm row per (UTC date, source).
                                  Kept for backwards compat; not used
                                  by the current pipeline.

  upsert_cell(swaths)          — PER-CELL mode (Phase 16.8).
                                  One Storm per (UTC date, source,
                                  cell-centroid). Caller pre-clusters
                                  per-pixel polygons into cell bundles.

  upsert_cell(..., track=True) — TRACKED CELL mode (Phase 17).
                                  Same proximity match as per-cell, but
                                  the swath geometry is UNIONED with
                                  the existing one across snapshots so
                                  cells become meandering track-shaped
                                  ribbons. Storm.bbox is the envelope of
                                  the union.

  upsert_nexrad_cell(cell)     — NEXRAD SCIT mode (Phase 18).
                                  One Storm per NEXRAD track_id; cell
                                  footprint accumulates across volume
                                  scans via ST_Union. source = "NEXRAD".

All four rely on the `uq_storm_category` constraint on hail_swaths.
"""
from __future__ import annotations
import secrets
from datetime import datetime, timezone

import structlog
from geoalchemy2.functions import ST_DWithin, ST_GeomFromText, ST_Intersects
from shapely.geometry import MultiPolygon, Point, Polygon, box
from shapely.ops import unary_union
from shapely import wkb as shapely_wkb
from sqlalchemy import func, or_, text
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
                  swaths: list[HailSwathData],
                  track: bool = False) -> None:
    """ON CONFLICT upsert of per-category swaths for one storm.

    When `track=True`, conflicts UNION the new polygon with the existing
    one (via Postgres ST_Union on EXCLUDED) so consecutive snapshots of
    the same storm cell accumulate into a track-shaped polygon. Wrapped
    with ST_Multi so the result stays a MultiPolygon.

    When `track=False` (legacy), conflicts overwrite the polygon — the
    daily-max product behavior where each snapshot replaces the prior.
    """
    for s in swaths:
        insert_stmt = pg_insert(HailSwath).values(
            id=_new_id("swath"),
            storm_id=storm_id,
            hail_size_category=s.hail_size_category,
            geom_multipolygon=_wkt_with_srid(s.geom_multipolygon),
        )
        if track:
            stmt = insert_stmt.on_conflict_do_update(
                constraint="uq_storm_category",
                set_={
                    # ST_Multi(ST_Union(existing, incoming)) — accumulates
                    # the cell's footprint over time. PostGIS handles the
                    # geometry coercion; we keep MultiPolygon as the
                    # storage type so the column constraint holds.
                    "geom_multipolygon": func.ST_Multi(
                        func.ST_Union(
                            HailSwath.geom_multipolygon,
                            insert_stmt.excluded.geom_multipolygon,
                        )
                    ),
                    "updated_at": datetime.now(timezone.utc),
                },
            )
        else:
            stmt = insert_stmt.on_conflict_do_update(
                constraint="uq_storm_category",
                set_={
                    "geom_multipolygon": _wkt_with_srid(s.geom_multipolygon),
                    "updated_at": datetime.now(timezone.utc),
                },
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

def upsert_cell(
    session: Session,
    swaths: list[HailSwathData],
    track: bool = False,
) -> dict:
    """Upsert a single storm cell's swaths.

    The caller is responsible for clustering — every swath in this
    call MUST belong to the same storm cell (e.g., it came from
    `cluster_swaths_into_cells`). Match against existing storms uses
    PostGIS `ST_DWithin` so a cell that drifts slightly across
    consecutive timestamps still hits its earlier Storm row.

    track=True (Phase 17): swath geometry is UNIONED with existing on
        conflict; storm bbox grows to enclose all snapshots. Produces
        the meandering ribbon shape for moving cells. Required for the
        instantaneous-MESH pipeline.

    track=False (legacy): swath geometry is OVERWRITTEN on conflict;
        storm bbox is replaced. Was the daily-max-product behavior.
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
        if track:
            # Grow the bbox to enclose the existing one + the new one.
            # ST_Envelope(ST_Union) keeps the column-type as POLYGON.
            existing_bbox_expr = text(
                "(SELECT bbox_geom FROM storms WHERE id = :sid)"
            ).bindparams(sid=storm.id)
            storm.bbox_geom = func.ST_Envelope(
                func.ST_Union(
                    existing_bbox_expr,
                    ST_GeomFromText(_wkt_with_srid(bbox_poly), 4326),
                )
            )
        else:
            storm.bbox_geom = _wkt_with_srid(bbox_poly)
        storm.updated_at = datetime.now(timezone.utc)
        session.flush()
        log.info("cell_updated", id=storm.id, max_in=storm.max_hail_size_in,
                 swaths=len(swaths), track=track)
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
                 swaths=len(swaths), track=track)

    _write_swaths(session, storm.id, swaths, track=track)
    session.commit()
    return {
        "storm_id": storm.id,
        "swath_count": len(swaths),
        "max_hail_size_in": float(storm.max_hail_size_in or 0.0),
    }


# ── NEXRAD-derived per-cell upsert (Phase 18) ──────────────────────────

def upsert_nexrad_cell(session: Session, cell) -> dict:  # noqa: ANN001
    """Upsert one NEXRAD-derived storm cell.

    Match logic:
      1. If `cell.track_id` matches an existing Storm.id (cells from
         the same volume-scan track), reuse that storm. The footprint
         gets UNIONED with the existing geometry across consecutive
         scans, producing the cell-track polygon.
      2. Otherwise fall back to spatial proximity within the UTC day +
         source="NEXRAD", same logic as `upsert_cell`.
      3. No match → new Storm row, id = track_id (so the next scan
         hits case 1 cleanly).

    Each cell becomes ONE Storm with source="NEXRAD" and a single
    HailSwath in the category implied by its peak dBZ.
    """
    # Imported here to keep the MRMS path free of py-ART transitive
    # dependencies. nexrad_scit is the only place that imports py-ART
    # at module load.
    from hailscout_pipeline.extraction.nexrad_scit import (
        NexradCell,
        _hail_size_to_category,
    )

    if not isinstance(cell, NexradCell):
        raise TypeError(
            f"upsert_nexrad_cell expects NexradCell, got {type(cell).__name__}"
        )

    timestamp = cell.timestamp
    source = "NEXRAD"
    day_start, day_end = _day_window(timestamp)

    footprint = cell.footprint
    centroid: Point = cell.centroid
    bbox_poly: Polygon = box(*footprint.bounds)
    hail_size = cell.estimated_hail_size_in
    category = _hail_size_to_category(hail_size)

    # 1) Track-id match (cross-volume continuity for the same cell)
    existing = None
    if cell.track_id:
        existing = session.query(Storm).filter(Storm.id == cell.track_id).first()

    # 2) Spatial-proximity fallback. Phase 20 cross-radar merge:
    #    centroid distance alone misses cells where two radars see the
    #    same storm complex from different angles — their centroids
    #    can be 50-100 km apart even though the polygon footprints
    #    overlap. We OR centroid-proximity with footprint-overlap so
    #    either signal pulls the new cell into an existing track.
    if not existing:
        centroid_geom_expr = ST_GeomFromText(_wkt_with_srid(centroid), 4326)
        footprint_geom_expr = ST_GeomFromText(_wkt_with_srid(footprint), 4326)
        existing = (
            session.query(Storm)
            .filter(
                Storm.start_time >= day_start,
                Storm.start_time <= day_end,
                Storm.source == source,
                or_(
                    ST_DWithin(Storm.centroid_geom, centroid_geom_expr,
                               STORM_MERGE_RADIUS_DEG),
                    ST_Intersects(Storm.bbox_geom, footprint_geom_expr),
                ),
            )
            .order_by(Storm.start_time.asc())
            .first()
        )

    if existing:
        storm = existing
        if timestamp > storm.end_time:
            storm.end_time = timestamp
        if hail_size > (storm.max_hail_size_in or 0.0):
            storm.max_hail_size_in = hail_size
        # Grow the bbox to enclose the track's full footprint
        existing_bbox_expr = text(
            "(SELECT bbox_geom FROM storms WHERE id = :sid)"
        ).bindparams(sid=storm.id)
        storm.bbox_geom = func.ST_Envelope(
            func.ST_Union(
                existing_bbox_expr,
                ST_GeomFromText(_wkt_with_srid(bbox_poly), 4326),
            )
        )
        storm.updated_at = datetime.now(timezone.utc)
        session.flush()
        log.info("nexrad_cell_updated", id=storm.id, peak_dbz=cell.peak_dbz,
                 hail_in=hail_size, station=cell.station)
    else:
        storm_id = cell.track_id or _new_id("storm")
        storm = Storm(
            id=storm_id,
            start_time=timestamp,
            end_time=timestamp,
            max_hail_size_in=hail_size,
            centroid_geom=_wkt_with_srid(centroid),
            bbox_geom=_wkt_with_srid(bbox_poly),
            source=source,
        )
        session.add(storm)
        session.flush()
        log.info("nexrad_cell_created", id=storm.id, peak_dbz=cell.peak_dbz,
                 hail_in=hail_size, station=cell.station)

    # One HailSwath per cell, with the cell footprint as the polygon.
    # Track=True so cross-scan upserts UNION the geometry instead of
    # overwriting — producing the meandering polygon over time.
    insert_stmt = pg_insert(HailSwath).values(
        id=_new_id("swath"),
        storm_id=storm.id,
        hail_size_category=category,
        geom_multipolygon=_wkt_with_srid(footprint),
    )
    stmt = insert_stmt.on_conflict_do_update(
        constraint="uq_storm_category",
        set_={
            "geom_multipolygon": func.ST_Multi(
                func.ST_Union(
                    HailSwath.geom_multipolygon,
                    insert_stmt.excluded.geom_multipolygon,
                )
            ),
            "updated_at": datetime.now(timezone.utc),
        },
    )
    session.execute(stmt)
    session.commit()
    return {
        "storm_id": storm.id,
        "category": category,
        "hail_in": hail_size,
        "peak_dbz": cell.peak_dbz,
    }
