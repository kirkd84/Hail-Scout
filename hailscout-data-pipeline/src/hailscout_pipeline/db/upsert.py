"""
Idempotent upsert logic for storms and hail_swaths.

Groups new swaths into storms by spatial and temporal proximity,
then upserts with conflict resolution.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import structlog
from shapely.geometry import MultiPolygon, Polygon
from shapely.wkt import loads as wkt_loads
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from hailscout_pipeline.db.models import HailSwath, Storm
from hailscout_pipeline.extraction.polygonize import HailSwath as HailSwathData

log = structlog.get_logger()


def upsert_swaths(session: Session, swaths: list[HailSwathData]) -> None:
    """
    Upsert new swaths into database with idempotent storm grouping.

    Algorithm:
    1. Group swaths by spatial+temporal proximity into "events"
    2. For each event, create or update a Storm row
    3. For each swath, upsert (or skip if exists)

    Storm grouping heuristic (MVP):
    - Same calendar day (UTC)
    - Bounding boxes within ~50 km of each other
    - Contiguous (overlapping or adjacent)

    TODO: This is a scaffold. Improvements for future:
    - ML clustering on swath centroids
    - Integration with NWS Storm Reports (SPC) for ground truth
    - Temporal decay: "close" storms 4+ hours after last swath
    - Merge nearby storms that appear to be same system

    Args:
        session: SQLAlchemy session
        swaths: List of HailSwathData objects to upsert
    """
    if not swaths:
        log.info("upsert_skipped", reason="no swaths")
        return

    log.info("upsert_swaths_start", count=len(swaths))

    try:
        # Group swaths into storms (MVP: one storm per ingestion cycle)
        # Real implementation would merge with existing storms
        storms_dict = _group_swaths_into_storms(session, swaths)

        # Upsert storms
        for storm_key, storm_data in storms_dict.items():
            storm = _upsert_storm(session, storm_data)
            log.info("storm_upserted", storm_id=storm.id, num_swaths=len(storm_data["swaths"]))

            # Upsert swaths within this storm
            for swath_data in storm_data["swaths"]:
                _upsert_swath(session, storm.id, swath_data)

        session.commit()
        log.info("upsert_swaths_complete", storms=len(storms_dict))

    except Exception as e:
        session.rollback()
        log.exception("upsert_swaths_failed", error=str(e))
        raise


def _group_swaths_into_storms(
    session: Session, swaths: list[HailSwathData]
) -> dict[str, dict]:
    """
    Group swaths into storms by spatial and temporal proximity.

    MVP heuristic: one storm per day per geographic region.
    A "region" is defined by overlapping/near bounding boxes.

    Args:
        session: SQLAlchemy session
        swaths: List of swaths

    Returns:
        Dict mapping storm key to storm data including swaths
    """
    # TODO: Implement real clustering
    # For MVP, create one synthetic storm per ingestion
    # Real version would:
    # 1. Compute bbox for all swaths
    # 2. Query existing storms from today
    # 3. Check spatial overlap with existing storms
    # 4. Merge into existing or create new

    # Placeholder: single storm per run
    if not swaths:
        return {}

    # Compute aggregate geometry
    timestamp = swaths[0].timestamp
    centroid_lat, centroid_lon = 35.0, -100.0  # TODO: compute from swath centroids
    bbox_coords = [
        (centroid_lon - 1, centroid_lat - 1),
        (centroid_lon + 1, centroid_lat + 1),
    ]
    bbox_poly = Polygon(
        [
            bbox_coords[0],
            (bbox_coords[1][0], bbox_coords[0][1]),
            bbox_coords[1],
            (bbox_coords[0][0], bbox_coords[1][1]),
            bbox_coords[0],
        ]
    )

    storm_key = f"mrms-{timestamp.date()}-synthetic"
    return {
        storm_key: {
            "timestamp": timestamp,
            "centroid": f"POINT({centroid_lon} {centroid_lat})",
            "bbox": bbox_poly,
            "swaths": swaths,
        }
    }


def _upsert_storm(session: Session, storm_data: dict) -> Storm:
    """
    Upsert a Storm row.

    Args:
        session: SQLAlchemy session
        storm_data: Dict with timestamp, centroid, bbox, swaths

    Returns:
        Updated or created Storm object
    """
    timestamp = storm_data["timestamp"]
    today = timestamp.replace(hour=0, minute=0, second=0, microsecond=0)

    # Query for existing storm from same day
    existing = (
        session.query(Storm)
        .filter(
            Storm.start_time >= today,
            Storm.start_time < today + timedelta(days=1),
        )
        .first()
    )

    if existing:
        # Update end_time and other fields
        existing.end_time = timestamp
        existing.updated_at = datetime.now(timezone.utc)
        session.add(existing)
        return existing
    else:
        # Create new storm
        storm = Storm(
            start_time=timestamp,
            end_time=timestamp,
            max_hail_size_in=None,  # Will be set by hail swath categories
            centroid_geom=storm_data["centroid"],
            bbox_geom=storm_data["bbox"],
            source="MRMS",
        )
        session.add(storm)
        session.flush()  # Ensure ID is assigned
        return storm


def _upsert_swath(session: Session, storm_id: str, swath_data: HailSwathData) -> None:
    """
    Upsert a HailSwath row using ON CONFLICT for idempotency.

    Args:
        session: SQLAlchemy session
        storm_id: ID of parent Storm
        swath_data: HailSwathData object
    """
    stmt = (
        pg_insert(HailSwath)
        .values(
            storm_id=storm_id,
            hail_size_category=swath_data.hail_size_category,
            geom_multipolygon=f"SRID=4326;{swath_data.geom_multipolygon.wkt}",
        )
        .on_conflict_do_update(
            index_elements=["storm_id", "hail_size_category"],
            set_={
                "geom_multipolygon": f"SRID=4326;{swath_data.geom_multipolygon.wkt}",
                "updated_at": datetime.now(timezone.utc),
            },
        )
    )
    session.execute(stmt)
