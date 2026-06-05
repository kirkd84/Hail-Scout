"""Parcel lead-list endpoints (draw-area prospecting).

`POST /v1/parcels/in-polygon` takes a drawn GeoJSON polygon (+ optional land-use
filter) and returns the property records inside it, sourced from the shared
Parcel-Service. Signed-in users only — it's a paid prospecting feature.
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, Field

from hailscout_api.auth.middleware import extract_auth_context
from hailscout_api.core import get_logger
from hailscout_api.services.parcels import (
    ParcelServiceError,
    ParcelServiceNotConfigured,
    parcels_in_polygon,
)

logger = get_logger(__name__)
router = APIRouter(prefix="/parcels", tags=["parcels"])


class GeoPolygon(BaseModel):
    type: Literal["Polygon"]
    coordinates: list[list[list[float]]]


class InPolygonRequest(BaseModel):
    polygon: GeoPolygon
    # all | residential | commercial | land | other
    property_type: str | None = None
    limit: int = Field(default=2000, ge=1, le=5000)


class ParcelOut(BaseModel):
    id: str | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    zip: str | None = None
    full_address: str | None = None
    owner_name: str | None = None
    owner_mailing_address: str | None = None
    property_type: str
    property_type_raw: str | None = None
    year_built: int | None = None
    building_sqft: int | None = None
    assessed_value: float | None = None
    market_value: float | None = None
    last_sold_at: str | None = None
    lat: float | None = None
    lng: float | None = None


class InPolygonResponse(BaseModel):
    parcels: list[ParcelOut]
    count: int
    property_type: str


@router.post("/in-polygon", response_model=InPolygonResponse)
async def in_polygon(body: InPolygonRequest, request: Request) -> InPolygonResponse:
    """Return property records whose centroid falls inside the drawn polygon."""
    await extract_auth_context(request)  # signed-in only

    try:
        rows = await parcels_in_polygon(
            body.polygon.model_dump(),
            property_type=body.property_type,
            limit=body.limit,
        )
    except ParcelServiceNotConfigured as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Property data isn't connected yet. Set PARCEL_SERVICE_URL and PARCEL_SERVICE_TOKEN on the API.",
        ) from exc
    except ParcelServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Property lookup is temporarily unavailable. Try again shortly.",
        ) from exc

    return InPolygonResponse(
        parcels=rows,  # type: ignore[arg-type]
        count=len(rows),
        property_type=(body.property_type or "all").lower(),
    )
