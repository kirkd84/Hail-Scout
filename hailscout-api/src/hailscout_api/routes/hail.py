"""Hail impact query endpoints."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.config import get_settings
from hailscout_api.core import GeocoderError, get_logger
from hailscout_api.db.session import get_db_session
from hailscout_api.schemas.hail import HailAtAddressResponse
from hailscout_api.services.geocoder import get_geocoder
from hailscout_api.services.storm_query import query_hail_at_point

logger = get_logger(__name__)
router = APIRouter()


@router.get("/hail-at-address", response_model=HailAtAddressResponse)
async def hail_at_address(
    address: str | None = Query(None, description="Address string (e.g., 'Plano, TX')"),
    lat: float | None = Query(None, description="Latitude (WGS84)"),
    lng: float | None = Query(None, description="Longitude (WGS84)"),
    from_date: str | None = Query(None, description="Start date (ISO 8601, default: 2011-01-01)"),
    to_date: str | None = Query(None, description="End date (ISO 8601, default: today)"),
    session: AsyncSession = Depends(get_db_session),
) -> HailAtAddressResponse:
    """Query historical hail impacts at an address.

    Accepts either an address string OR lat/lng coordinates.

    Examples:
        GET /v1/hail-at-address?address=Plano,TX
        GET /v1/hail-at-address?lat=33.2093&lng=-96.8083
    """
    settings = get_settings()

    # Validate inputs
    if address is None and (lat is None or lng is None):
        raise HTTPException(
            status_code=400,
            detail="Provide either 'address' or both 'lat' and 'lng'",
        )

    if address is not None and (lat is not None or lng is not None):
        raise HTTPException(
            status_code=400,
            detail="Provide either 'address' OR 'lat'/'lng', not both",
        )

    # Geocode address if provided
    if address:
        geocoder = get_geocoder(
            settings.geocoder_provider,
            nominatim_user_agent=settings.nominatim_user_agent,
            mapbox_api_key=settings.mapbox_api_key,
        )
        try:
            query_lat, query_lng, formatted_address = await geocoder.geocode(address)
        except GeocoderError as e:
            raise HTTPException(status_code=502, detail=str(e))
    else:
        query_lat = lat
        query_lng = lng
        formatted_address = f"{lat}, {lng}"

    # Parse date range
    try:
        from_dt = (
            datetime.fromisoformat(from_date)
            if from_date
            else datetime(2011, 1, 1, tzinfo=timezone.utc)
        )
        to_dt = (
            datetime.fromisoformat(to_date)
            if to_date
            else datetime.now(timezone.utc)
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {e}")

    # Query hail swaths at this point
    try:
        results = await query_hail_at_point(
            session, query_lat, query_lng, from_dt, to_dt
        )
    except Exception as e:
        logger.error("Hail query failed", error=str(e), lat=query_lat, lng=query_lng)
        raise HTTPException(status_code=500, detail="Query failed")

    # Convert results to response format
    hail_history = []
    for storm, swath in results:
        # Extract hail size from category (e.g., "1.5" -> 1.5)
        try:
            hail_size = float(swath.hail_size_category.rstrip("+"))
        except ValueError:
            hail_size = 0.0

        hail_history.append(
            {
                "storm_id": storm.id,
                "date": storm.start_time.isoformat(),
                "max_hail_size_in": hail_size,
                "category": f'{swath.hail_size_category}"',
                "distance_miles": 0.0,  # TODO: calculate actual distance
                "impact_probability": 0.95,  # TODO: compute from swath containment
            }
        )

    logger.info(
        "Queried hail at address",
        address=address or f"{query_lat},{query_lng}",
        results=len(hail_history),
    )

    return HailAtAddressResponse(
        address={
            "query": address or f"{query_lat},{query_lng}",
            "formatted": formatted_address,
            "lat": query_lat,
            "lng": query_lng,
        },
        hail_history=hail_history,
    )
