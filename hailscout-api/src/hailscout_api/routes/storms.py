"""Storm query endpoints."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.core import get_logger
from hailscout_api.db.session import get_db_session
from hailscout_api.schemas.storm import (
    HailAtPointListResponse,
    StormDetailResponse,
    StormReplayResponse,
    StormsListResponse,
    StormsStatsResponse,
)
from hailscout_api.services.storm_query import (
    get_storm_with_swaths,
    get_storms_stats,
    query_hail_at_point,
    query_storms_in_bbox,
)

logger = get_logger(__name__)
router = APIRouter()


def _parse_iso_dt(s: str, name: str) -> datetime:
    try:
        dt = datetime.fromisoformat(s)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Bad {name}: {e}")
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


@router.get("/storms", response_model=StormsListResponse)
async def list_storms(
    bbox: str = Query(
        ..., description="Bounding box as minlon,minlat,maxlon,maxlat (WGS84)"
    ),
    from_date: str = Query(..., alias="from",
                           description="ISO 8601 start", example="2026-04-01"),
    to_date: str = Query(..., alias="to",
                         description="ISO 8601 end", example="2026-05-01"),
    limit: int = Query(50, ge=1, le=200),
    include: str | None = Query(
        None,
        description="Comma-separated extras. 'swaths' to include the "
                    "simplified hail-swath GeoJSON for each storm.",
    ),
    simplify: float = Query(
        0.02,
        ge=0.0, le=1.0,
        description="ST_SimplifyPreserveTopology tolerance in degrees for "
                    "`include=swaths`. 0 = no simplification. 0.02 ≈ 2km "
                    "— preserves cell-level polygon shape while keeping "
                    "payload reasonable. Higher = smoother + lighter but "
                    "small cells degenerate.",
    ),
    source: str | None = Query(
        None,
        description="Filter by pipeline source: 'MRMS' or 'NEXRAD'. "
                    "Omit (or pass empty) to return both.",
    ),
    min_size: float | None = Query(
        None,
        ge=0.0,
        description="Drop storms with peak hail < this size (inches). "
                    "Applies at the DB layer, so it tightens the row set "
                    "before swath join.",
    ),
    order: str = Query(
        "recent",
        description="Sort order: 'recent' (start_time DESC, default) or "
                    "'peak' (max_hail_size_in DESC) for a top-events feed.",
    ),
    session: AsyncSession = Depends(get_db_session),
) -> StormsListResponse:
    """Storms whose bounding box intersects the query envelope."""
    try:
        parts = [float(x) for x in bbox.split(",")]
        if len(parts) != 4:
            raise ValueError("bbox needs 4 values")
        min_lon, min_lat, max_lon, max_lat = parts
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Bad bbox: {e}")

    from_dt = _parse_iso_dt(from_date, "from")
    to_dt = _parse_iso_dt(to_date, "to")

    includes = {part.strip() for part in (include or "").split(",") if part.strip()}
    source_filter = source.strip() if source and source.strip() else None
    storms = await query_storms_in_bbox(
        session, min_lon, min_lat, max_lon, max_lat, from_dt, to_dt, limit,
        include_swaths="swaths" in includes,
        swath_simplify_tolerance=simplify,
        source=source_filter,
        min_hail_size_in=min_size,
        order=order,
    )
    return StormsListResponse(storms=storms, cursor=None, total=len(storms))


@router.get("/storms/at-point", response_model=HailAtPointListResponse)
async def storms_at_point(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
    limit: int = Query(50, ge=1, le=200),
    session: AsyncSession = Depends(get_db_session),
) -> HailAtPointListResponse:
    """Storms whose hail swaths actually contain (lat, lng).

    Each hit reports the largest hail-size category whose polygon
    contains the point — the answer to "what size hail hit this address?"
    """
    from_dt = _parse_iso_dt(from_date, "from") if from_date else None
    to_dt = _parse_iso_dt(to_date, "to") if to_date else None
    hits = await query_hail_at_point(session, lat, lng, from_dt, to_dt, limit)
    return HailAtPointListResponse(
        lat=lat, lng=lng, hits=hits, total=len(hits)
    )


@router.get("/storms/stats", response_model=StormsStatsResponse)
async def storms_stats(
    session: AsyncSession = Depends(get_db_session),
) -> StormsStatsResponse:
    """Aggregate counts over the whole `storms` table.

    Cheap rollup — single SELECT with conditional COUNTs. Used by the
    public /stats page + dashboard widgets that want totals beyond the
    200-row /v1/storms cap. Registered BEFORE /storms/{storm_id} so the
    literal "stats" path doesn't get treated as a storm_id.
    """
    data = await get_storms_stats(session)
    return StormsStatsResponse(**data)


@router.get("/storms/{storm_id}", response_model=StormDetailResponse)
async def get_storm_detail(
    storm_id: str,
    session: AsyncSession = Depends(get_db_session),
) -> StormDetailResponse:
    """Full storm detail with all hail swaths as GeoJSON MultiPolygons."""
    data = await get_storm_with_swaths(session, storm_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Storm not found")
    return data


@router.get("/storms/{storm_id}/replay", response_model=StormReplayResponse)
async def get_storm_replay(
    storm_id: str,
) -> StormReplayResponse:
    """NEXRAD frame list for Hail Replay (M4 stub)."""
    return StormReplayResponse(storm_id=storm_id, frames=[])
