"""Area exposure / demographics for lead prospecting.

Phase 28. Interactive Hail Maps shows the economics of a hit area on
click — population, households, home value, income — so a contractor
can judge whether a neighborhood is worth canvassing. We match that
with free US Census data:

  1. Census Geocoder (keyless) — lat/lng → state/county/tract FIPS +
     human names. Always available.
  2. Census ACS 5-year API (free key) — tract demographics: population,
     housing units, median home value, median household income.

The ACS endpoint requires a free key (CENSUS_API_KEY; instant signup at
api.census.gov/data/key_signup.html). Without it we still return the
area NAME from the keyless geocoder so the panel renders something
useful; demographics fill in once the key is set. Results are cached
in-process keyed by rounded lat/lng (tracts don't move).
"""

from __future__ import annotations

import os
import time
from dataclasses import asdict, dataclass
from typing import Any, Optional

import httpx

from hailscout_api.core import get_logger

logger = get_logger(__name__)

_GEOCODER_URL = "https://geocoding.geo.census.gov/geocoder/geographies/coordinates"
_ACS_YEAR = "2022"
_ACS_URL = f"https://api.census.gov/data/{_ACS_YEAR}/acs/acs5"

# ACS variable codes.
_VARS = {
    "B01003_001E": "population",
    "B25001_001E": "housing_units",
    "B25077_001E": "median_home_value",
    "B19013_001E": "median_household_income",
}

_CACHE_TTL = 7 * 24 * 3600.0  # a week — demographics are near-static
_CACHE_MAX = 4096
_cache: dict[str, tuple[float, "AreaExposure"]] = {}


@dataclass
class AreaExposure:
    available: bool
    area_name: Optional[str] = None      # e.g. "Census Tract 20, Denver County, CO"
    county_name: Optional[str] = None
    state_fips: Optional[str] = None
    county_fips: Optional[str] = None
    tract_fips: Optional[str] = None
    population: Optional[int] = None
    housing_units: Optional[int] = None
    median_home_value: Optional[int] = None
    median_household_income: Optional[int] = None
    note: Optional[str] = None

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def _cache_get(key: str) -> Optional[AreaExposure]:
    now = time.monotonic()
    hit = _cache.get(key)
    if hit is None:
        return None
    ts, val = hit
    if now - ts >= _CACHE_TTL:
        _cache.pop(key, None)
        return None
    return val


def _cache_put(key: str, val: AreaExposure) -> None:
    if key not in _cache and len(_cache) >= _CACHE_MAX:
        oldest = next(iter(_cache), None)
        if oldest is not None:
            _cache.pop(oldest, None)
    _cache[key] = (time.monotonic(), val)


def _as_int(v: Any) -> Optional[int]:
    """ACS uses negative sentinels (e.g. -666666666) for null/jam values."""
    try:
        n = int(float(v))
    except (TypeError, ValueError):
        return None
    return n if n >= 0 else None


async def get_area_exposure(lat: float, lng: float) -> AreaExposure:
    """Resolve area demographics for a point. Never raises — returns an
    AreaExposure with available=False (+ a note) on any failure."""
    key = f"{round(lat, 3)},{round(lng, 3)}"
    cached = _cache_get(key)
    if cached is not None:
        return cached

    result = await _resolve(lat, lng)
    _cache_put(key, result)
    return result


async def _resolve(lat: float, lng: float) -> AreaExposure:
    # 1. Geocode (keyless) → FIPS + names.
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.get(_GEOCODER_URL, params={
                "x": lng, "y": lat,
                "benchmark": "Public_AR_Current",
                "vintage": "Current_Current",
                "format": "json",
                "layers": "Census Tracts",
            })
            r.raise_for_status()
            tracts = (
                r.json().get("result", {})
                .get("geographies", {})
                .get("Census Tracts", [])
            )
    except Exception as exc:  # pragma: no cover
        logger.warning("exposure.geocode_failed", error=str(exc))
        return AreaExposure(available=False, note="Area lookup unavailable")

    if not tracts:
        return AreaExposure(available=False, note="No US census area at this point")

    g = tracts[0]
    state = g.get("STATE")
    county = g.get("COUNTY")
    tract = g.get("TRACT")
    area_name = g.get("NAME") or g.get("BASENAME")

    base = AreaExposure(
        available=True,
        area_name=area_name,
        state_fips=state,
        county_fips=county,
        tract_fips=tract,
    )

    # 2. ACS demographics (needs free key). Degrade gracefully if absent.
    api_key = os.environ.get("CENSUS_API_KEY", "").strip()
    if not api_key:
        base.note = ("Demographics need a free CENSUS_API_KEY; showing area "
                     "name only.")
        return base
    if not (state and county and tract):
        return base

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.get(_ACS_URL, params={
                "get": "NAME," + ",".join(_VARS.keys()),
                "for": f"tract:{tract}",
                "in": f"state:{state} county:{county}",
                "key": api_key,
            })
            r.raise_for_status()
            data = r.json()
    except Exception as exc:  # pragma: no cover
        logger.warning("exposure.acs_failed", error=str(exc))
        base.note = "Demographics temporarily unavailable"
        return base

    # ACS returns [header_row, value_row]. Map by header position.
    if not isinstance(data, list) or len(data) < 2:
        return base
    header, row = data[0], data[1]
    by_name = dict(zip(header, row))
    full_name = by_name.get("NAME") or area_name
    base.area_name = full_name
    # County name = trailing part of the ACS NAME field.
    if full_name and "," in full_name:
        parts = [p.strip() for p in full_name.split(",")]
        base.county_name = ", ".join(parts[1:]) if len(parts) > 1 else None
    base.population = _as_int(by_name.get("B01003_001E"))
    base.housing_units = _as_int(by_name.get("B25001_001E"))
    base.median_home_value = _as_int(by_name.get("B25077_001E"))
    base.median_household_income = _as_int(by_name.get("B19013_001E"))
    base.note = None
    logger.info("exposure.resolved", area=base.area_name,
                pop=base.population, homes=base.housing_units)
    return base
