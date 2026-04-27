"""Vector tile endpoints (served via CloudFront, not API)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

router = APIRouter()


@router.get("/tiles/swaths/{z}/{x}/{y}.pbf")
async def get_swath_tiles(z: int, x: int, y: int) -> dict:
    """Current swath vector tiles (CloudFront).

    This endpoint stub is here for API documentation.
    In production, tiles are served directly from CloudFront.

    TODO: Configure CloudFront to serve from S3://hailscout-tiles/
    """
    raise HTTPException(
        status_code=404,
        detail="Tiles are served via CloudFront, not this API",
    )


@router.get("/tiles/historical/{date}/{z}/{x}/{y}.pbf")
async def get_historical_tiles(date: str, z: int, x: int, y: int) -> dict:
    """Historical swath tiles by date (Month 2, CloudFront).

    TODO(M2): Implement historical tile generation and archival
    """
    raise HTTPException(status_code=501, detail="Not implemented (Month 2)")
