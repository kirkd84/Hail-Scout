"""Client for the shared Parcel-Service (county parcel data).

Powers draw-area lead lists + business-type prospecting. We POST a drawn
GeoJSON polygon to Parcel-Service's ``/v1/parcels/in-polygon`` and normalize the
result into a flat, HailScout-shaped lead row (address, owner, lat/lng, a coarse
land-use bucket). Configuration is server-side only (PARCEL_SERVICE_URL/TOKEN);
when unset the caller surfaces a 503.
"""

from __future__ import annotations

from typing import Any

import httpx

from hailscout_api.config import get_settings
from hailscout_api.core import get_logger

logger = get_logger(__name__)


class ParcelServiceNotConfigured(Exception):
    """PARCEL_SERVICE_URL / PARCEL_SERVICE_TOKEN are not set."""


class ParcelServiceError(Exception):
    """The upstream Parcel-Service call failed."""


# Coarse land-use buckets. County feeds put wildly different strings in
# `propertyType` (words, abbreviations, sometimes class codes), so we match on
# substrings and keep the raw value for display.
_COMMERCIAL = (
    "commercial", "comm", "retail", "office", "industrial", "warehouse",
    "business", "store", "shop", "hotel", "motel", "restaurant",
)
_RESIDENTIAL = (
    "residential", "resid", "single", "family", "sfr", "condo", "townhome",
    "townhouse", "duplex", "triplex", "apartment", "multi", "mobile", "dwelling",
    "home", "house",
)
_LAND = ("vacant", "land", "agric", "farm", "lot", "acre")

VALID_BUCKETS = ("residential", "commercial", "land", "other")


def land_use_bucket(raw: str | None) -> str:
    """Map a provider propertyType string to residential/commercial/land/other."""
    if not raw:
        return "other"
    p = raw.strip().lower()
    if any(k in p for k in _COMMERCIAL):
        return "commercial"
    if any(k in p for k in _RESIDENTIAL):
        return "residential"
    if any(k in p for k in _LAND):
        return "land"
    return "other"


def _cents_to_dollars(value: Any) -> float | None:
    try:
        return round(float(value) / 100.0, 2) if value is not None else None
    except (TypeError, ValueError):
        return None


def _normalize(p: dict[str, Any]) -> dict[str, Any]:
    raw_type = p.get("propertyType")
    street = p.get("street")
    city = p.get("city")
    state = p.get("state")
    zip_ = p.get("zip")
    full = ", ".join(x for x in [street, city, f"{state or ''} {zip_ or ''}".strip()] if x)

    centroid = p.get("centroid") or {}
    coords = centroid.get("coordinates") if isinstance(centroid, dict) else None
    lng, lat = (None, None)
    if isinstance(coords, list) and len(coords) >= 2:
        lng, lat = coords[0], coords[1]

    return {
        "id": p.get("id"),
        "address": street,
        "city": city,
        "state": state,
        "zip": zip_,
        "full_address": full or None,
        "owner_name": p.get("ownerName"),
        "owner_mailing_address": p.get("ownerMailingAddress"),
        "property_type": land_use_bucket(raw_type),
        "property_type_raw": raw_type,
        "year_built": p.get("yearBuilt"),
        "building_sqft": p.get("buildingSqft"),
        "assessed_value": _cents_to_dollars(p.get("assessedValueCents")),
        "market_value": _cents_to_dollars(p.get("marketValueCents")),
        "last_sold_at": p.get("lastSoldAt"),
        "lat": lat,
        "lng": lng,
    }


async def parcels_in_polygon(
    polygon: dict[str, Any],
    *,
    property_type: str | None = None,
    limit: int = 2000,
) -> list[dict[str, Any]]:
    """Fetch parcels whose centroid falls inside ``polygon`` (a GeoJSON Polygon).

    ``property_type`` filters by coarse bucket ("residential"/"commercial"/
    "land"/"other"); "all"/None returns everything. Raises
    :class:`ParcelServiceNotConfigured` or :class:`ParcelServiceError`.
    """
    settings = get_settings()
    base = settings.parcel_service_url.strip()
    token = settings.parcel_service_token.strip()
    if not base or not token:
        raise ParcelServiceNotConfigured("Parcel-Service is not configured")

    url = base.rstrip("/") + "/v1/parcels/in-polygon"
    headers = {
        "Authorization": f"Service {token}",
        "Content-Type": "application/json",
    }
    # Parcel-Service caps at 5000; ask for a bit of headroom over our limit so
    # post-filtering by land use still has enough to return `limit` rows.
    body = {"geojson": polygon, "limit": min(5000, max(limit * 2, limit))}

    try:
        async with httpx.AsyncClient(timeout=settings.parcel_service_timeout_s) as client:
            resp = await client.post(url, headers=headers, json=body)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPStatusError as exc:
        logger.error(
            "parcels.upstream_status",
            status=exc.response.status_code,
            body=exc.response.text[:300],
        )
        raise ParcelServiceError(
            f"Parcel-Service returned {exc.response.status_code}"
        ) from exc
    except httpx.HTTPError as exc:
        logger.error("parcels.upstream_error", error=str(exc))
        raise ParcelServiceError("Parcel lookup failed") from exc

    raw_parcels = data.get("parcels", []) if isinstance(data, dict) else []
    want = (property_type or "all").lower()
    out: list[dict[str, Any]] = []
    for p in raw_parcels:
        row = _normalize(p)
        if want != "all" and row["property_type"] != want:
            continue
        out.append(row)
        if len(out) >= limit:
            break
    return out
