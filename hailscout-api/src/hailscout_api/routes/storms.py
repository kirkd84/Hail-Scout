"""Storm query endpoints."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.core import get_logger
from hailscout_api.db.session import get_db_session
from hailscout_api.schemas.storm import (
    StormDetailResponse,
    StormReplayResponse,
    StormsListResponse,
)
from hailscout_api.services.storm_query import query_storms_in_bbox

logger = get_logger(__name__)
router = APIRouter()


@router.get("/storms", response_model=StormsListResponse)
async def list_storms(
    bbox: str = Query(
        ..., description="Bounding box as minlon,minlat,maxlon,maxlat"
    ),
    from_date: str = Query(
        ..., description="Start date (ISO 8601)", example="2025-04-01"
    ),
    to_date: str = Query(
        ..., description="End date (ISO 8601)", example="2025-04-30"
    ),
    limit: int = Query(50, ge=1, le=100),
    session: AsyncSession = Depends(get_db_session),
) -> StormsListResponse:
    """List storms in a bounding box and date range.

    Example:
        GET /v1/storms?bbox=-97.5,31.5,-96.5,32.5&from=2025-04-01&to=2025-04-30
    """
    try:
        # Parse bounding box
        bbox_parts = [float(x) for x in bbox.split(",")]
        if len(bbox_parts) != 4:
            raise ValueError("bbox must have 4 values")
        min_lon, min_lat, max_lon, max_lat = bbox_parts

        # Parse dates
        from_dt = datetime.fromisoformat(from_date)
        to_dt = datetime.fromisoformat(to_date)

    except (ValueError, IndexError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid query parameters: {e}")

    # Query storms
    storms = await query_storms_in_bbox(
        session, min_lon, min_lat, max_lon, max_lat, from_dt, to_dt, limit
    )

    logger.info(
        "Listed storms",
        bbox=(min_lon, min_lat, max_lon, max_lat),
        count=len(storms),
    )

    return StormsListResponse(
        storms=[
            {
                "id": storm.id,
                "start_time": storm.start_time,
                "end_time": storm.end_time,
                "max_hail_size_in": storm.max_hail_size_in,
                "centroid": {"type": "Point", "coordinates": [0.0, 0.0]},  # TODO: extract from geometry
                "bbox": {"type": "Polygon", "coordinates": []},  # TODO: extract from geometry
                "source": storm.source,
            }
            for storm in storms
        ],
        cursor=None,
        total=len(storms),
    )


@router.get("/storms/{storm_id}")
async def get_storm_detail(
    storm_id: str,
) -> StormDetailResponse:
    """Storm detail with swaths (Month 2).

    TODO(M2): Implement full swath detail with GeoJSON polygons
    """
    return {
        "status_code": 501,
        "detail": "Storm detail endpoint not yet implemented (Month 2)",
    }


@router.get("/storms/{storm_id}/replay")
async def get_storm_replay(
    storm_id: str,
) -> StormReplayResponse:
    """NEXRAD frame list for Hail Replay (Month 4).

    TODO(M4): Implement frame replay with NEXRAD Level II tiles
    """
    return {
        "status_code": 501,
        "detail": "Hail Replay not yet implemented (Month 4)",
    }
