"""Turn-by-turn routing endpoint — powers navigate-to-lead in the app.

`GET /v1/route?start=lng,lat&end=lng,lat` — bearer-authed (so our routing quota
isn't open to the world) and provider-agnostic: it proxies services/routing,
keeping the key server-side. 503 when routing isn't configured.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request

from hailscout_api.auth.session import verify_access_token
from hailscout_api.core import AuthenticationError, get_logger
from hailscout_api.services.routing import (
    RoutingError,
    RoutingNotConfigured,
    get_route,
)
from pydantic import BaseModel

logger = get_logger(__name__)
router = APIRouter()


class RouteStep(BaseModel):
    instruction: str
    distance_m: float
    duration_s: float
    type: int
    name: str
    location: list[float]


class RouteResponse(BaseModel):
    geometry: list[list[float]]
    distance_m: float
    duration_s: float
    steps: list[RouteStep]


def _require_auth(request: Request) -> None:
    auth = request.headers.get("Authorization")
    if not auth:
        raise AuthenticationError("Missing Authorization header")
    try:
        scheme, token = auth.split(" ", 1)
    except ValueError as exc:
        raise AuthenticationError("Invalid Authorization header format") from exc
    if scheme.lower() != "bearer":
        raise AuthenticationError("Only Bearer tokens supported")
    verify_access_token(token)  # raises on invalid/expired


def _parse_lnglat(value: str, name: str) -> tuple[float, float]:
    try:
        lng_s, lat_s = value.split(",")
        return float(lng_s), float(lat_s)
    except (ValueError, AttributeError) as exc:
        raise HTTPException(
            status_code=422, detail=f"{name} must be 'lng,lat'"
        ) from exc


@router.get("/route", response_model=RouteResponse)
async def route(
    request: Request,
    start: str = Query(..., description="Origin as 'lng,lat'"),
    end: str = Query(..., description="Destination as 'lng,lat'"),
) -> RouteResponse:
    """Driving route + turn-by-turn steps between two points."""
    _require_auth(request)
    s_lng, s_lat = _parse_lnglat(start, "start")
    e_lng, e_lat = _parse_lnglat(end, "end")
    try:
        result = await get_route(s_lng, s_lat, e_lng, e_lat)
    except RoutingNotConfigured as exc:
        raise HTTPException(
            status_code=503, detail="Navigation isn't set up yet."
        ) from exc
    except RoutingError as exc:
        logger.warning("route.failed", error=str(exc))
        raise HTTPException(
            status_code=502, detail="Couldn't find a driving route to there."
        ) from exc
    return RouteResponse(**result)
