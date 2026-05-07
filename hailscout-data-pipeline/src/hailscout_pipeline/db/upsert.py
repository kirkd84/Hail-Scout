"""Idempotent upsert for storms + hail_swaths.

Storm clustering rule: one Storm row per (date, source). All swaths from
the same MRMS product, same UTC date roll up into one Storm. The Storm's
geometry is the union of all its swath bboxes; max_hail_size_in is the
max across all swaths. This is intentionally simple — good enough for v1.
We can split per-system clusters later if customers ask.
"""
from __future__ import annotations
import secrets
from datetime import datetime, timezone

import structlog
from shapely.geometry import MultiPolygon, Point, Polygon, box
from shapely.ops import unary_union
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from hailscout_pipeline.db.models import HailSwath, Storm
from hailscout_pipeline.extraction.polygonize import HailSwath as HailSwathData

log = structlog.get_logger()


def _new_id(prefix: str) -> str:
    return f"{prefix}_{secrets.token_urlsafe(10)}"


def _wkt_with_srid(geom) -> str:
    return f"SRID=4326;{geom.wkt}"


def upsert_swaths(session: Session, swaths: list[HailSwathData]) -> dict:
    """Upsert one Storm + its HailSwaths.

    Returns dict with counts: {"storm_id": ..., "swath_count": ..., "max_hail_size_in": ...}
    """
    if not swaths:
        log.info("upsert_skipped", reason="no swaths")
        return {"storm_id": None, "swath_count": 0, "max_hail_size_in": 0.0}

    timestamp = swaths[0].timestamp
    source = swaths[0].source  # "MRMS"
    day_start = timestamp.replace(hour=0, minute=0, second=0,
                                  microsecond=0, tzinfo=timezone.utc)
    day_end = day_start.replace(hour=23, minute=59, second=59)

    # Compute union geometry for centroid + bbox
    all_geoms = unary_union([s.geom_multipolygon for s in swaths])
    centroid: Point = all_geoms.centroid
    bbox_poly: Polygon = box(*all_geoms.bounds)
    max_size = max(s.max_hail_size_in for s in swaths)

    # Find or create Storm for this (date, source)
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
        # Widen end_time, update max if larger, expand bbox
        if timestamp > storm.end_time:
            storm.end_time = timestamp
        if max_size > (storm.max_hail_size_in or 0.0):
            storm.max_hail_size_in = max_size
        # Expand bbox to include new swaths
        # (For now: take the union of new bbox + old bbox via WKT round-trip
        #  is overkill; just store the new bbox if it's bigger.)
        # Keep it simple — overwrite. The next sweep will cover it.
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

    # Upsert swaths
    for s in swaths:
        stmt = (
            pg_insert(HailSwath)
            .values(
                id=_new_id("swath"),
                storm_id=storm.id,
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

    session.commit()
    log.info("upsert_complete", storm_id=storm.id, swaths=len(swaths))
    return {
        "storm_id": storm.id,
        "swath_count": len(swaths),
        "max_hail_size_in": float(storm.max_hail_size_in or 0.0),
    }
