"""Hail impact query endpoints."""

from __future__ import annotations

import threading
import time
from collections import deque
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.config import get_settings
from hailscout_api.core import GeocoderError, get_logger
from hailscout_api.db.session import get_db_session
from hailscout_api.schemas.hail import HailAtAddressResponse
from hailscout_api.services.geocoder import get_geocoder
from hailscout_api.services.storm_query import query_hail_at_point

logger = get_logger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Abuse protection for the public, unauthenticated geocoder proxy.
#
# /v1/hail-at-address?address=... proxies an outbound Nominatim call. Nominatim
# policy is <=1 req/s per consumer and bans abusers, so an unthrottled public
# endpoint is both a way to get our IP banned and a DoS-amplification vector.
# We add two lightweight, in-process protections (single-instance scope; for a
# multi-replica deployment move these to a shared store like Redis):
#   1. A per-client-IP sliding-window rate limit on the geocoding path.
#   2. A short-lived cache of geocode results keyed by the normalized address,
#      so repeat lookups don't re-hit Nominatim at all.
# The descriptive User-Agent required by Nominatim is already sent by the
# geocoder (settings.nominatim_user_agent).
# ---------------------------------------------------------------------------

# Per-IP rate limit: at most _GEOCODE_RATE_MAX requests per _GEOCODE_RATE_WINDOW
# seconds. Conservative defaults keep us well under Nominatim's 1 req/s ceiling
# in aggregate while still allowing a human doing a few searches.
_GEOCODE_RATE_MAX = 5
_GEOCODE_RATE_WINDOW = 10.0  # seconds

# Geocode result cache TTL. Addresses don't move; an hour is plenty and bounds
# how stale a cached coordinate can be.
_GEOCODE_CACHE_TTL = 3600.0  # seconds
_GEOCODE_CACHE_MAX = 1024  # cap entries to bound memory

_geocode_lock = threading.Lock()
_geocode_hits: dict[str, deque[float]] = {}
_geocode_cache: dict[str, tuple[float, tuple[float, float, str]]] = {}


def _client_ip(request: Request) -> str:
    """Best-effort client IP for rate-limiting.

    Honors a single-hop ``X-Forwarded-For`` (first entry) when present, since
    the API runs behind a proxy in production; falls back to the socket peer.
    """
    xff = request.headers.get("X-Forwarded-For")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _check_geocode_rate_limit(ip: str) -> None:
    """Raise HTTP 429 if ``ip`` has exceeded the geocoding rate limit."""
    now = time.monotonic()
    cutoff = now - _GEOCODE_RATE_WINDOW
    with _geocode_lock:
        hits = _geocode_hits.get(ip)
        if hits is None:
            hits = deque()
            _geocode_hits[ip] = hits
        # Drop timestamps outside the window.
        while hits and hits[0] < cutoff:
            hits.popleft()
        if len(hits) >= _GEOCODE_RATE_MAX:
            raise HTTPException(
                status_code=429,
                detail="Too many address lookups; please slow down.",
            )
        hits.append(now)


def _normalize_address(address: str) -> str:
    """Normalize an address for cache keying (case/space-insensitive)."""
    return " ".join(address.lower().split())


def _geocode_cache_get(key: str) -> tuple[float, float, str] | None:
    now = time.monotonic()
    with _geocode_lock:
        entry = _geocode_cache.get(key)
        if entry is None:
            return None
        stored_at, value = entry
        if (now - stored_at) >= _GEOCODE_CACHE_TTL:
            _geocode_cache.pop(key, None)
            return None
        return value


def _geocode_cache_put(key: str, value: tuple[float, float, str]) -> None:
    now = time.monotonic()
    with _geocode_lock:
        # Bound memory: if at capacity and inserting a new key, evict the
        # oldest entry (dicts preserve insertion order).
        if key not in _geocode_cache and len(_geocode_cache) >= _GEOCODE_CACHE_MAX:
            oldest = next(iter(_geocode_cache), None)
            if oldest is not None:
                _geocode_cache.pop(oldest, None)
        _geocode_cache[key] = (now, value)


@router.get("/hail-at-address", response_model=HailAtAddressResponse)
async def hail_at_address(
    request: Request,
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
        cache_key = _normalize_address(address)
        cached = _geocode_cache_get(cache_key)
        if cached is not None:
            # Cache hit makes no outbound call, so it isn't rate-limited.
            query_lat, query_lng, formatted_address = cached
        else:
            # Only the path that actually calls Nominatim is rate-limited.
            _check_geocode_rate_limit(_client_ip(request))
            geocoder = get_geocoder(
                settings.geocoder_provider,
                nominatim_user_agent=settings.nominatim_user_agent,
                mapbox_api_key=settings.mapbox_api_key,
            )
            try:
                query_lat, query_lng, formatted_address = await geocoder.geocode(address)
            except GeocoderError as e:
                raise HTTPException(status_code=502, detail=str(e))
            _geocode_cache_put(cache_key, (query_lat, query_lng, formatted_address))
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

    # query_hail_at_point now returns rolled-up dicts (one per storm,
    # keeping the largest containing category). Map each dict to the
    # legacy HailImpactRecord shape so /v1/hail-at-address consumers don't
    # need to migrate yet.
    hail_history = []
    for hit in results:
        category = hit["category_at_point"]
        try:
            hail_size = float(category.rstrip("+"))
        except ValueError:
            hail_size = 0.0
        hail_history.append(
            {
                "storm_id": hit["id"],
                "date": hit["start_time"].isoformat(),
                "max_hail_size_in": hail_size,
                "category": f'{category}"',
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
