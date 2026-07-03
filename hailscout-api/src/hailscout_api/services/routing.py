"""Driving-route service — turn-by-turn directions for navigate-to-lead.

Server-side proxy so the routing provider's key never ships in the mobile app,
and so the provider can be swapped (OpenRouteService now; a self-hosted OSRM /
Valhalla on Railway later) without an app release. Returns a normalized route
the app renders and runs its own guidance on.
"""

from __future__ import annotations

from typing import Any

import httpx

from hailscout_api.config import get_settings
from hailscout_api.core import get_logger

logger = get_logger(__name__)

_ORS_URL = "https://api.openrouteservice.org/v2/directions/driving-car/geojson"


class RoutingError(Exception):
    """A route couldn't be computed (provider error / no route)."""


class RoutingNotConfigured(RoutingError):
    """No routing provider key is set — the feature is off."""


async def get_route(
    start_lng: float,
    start_lat: float,
    end_lng: float,
    end_lat: float,
) -> dict[str, Any]:
    """Compute a driving route between two points.

    Returns a normalized dict:
        {
          "geometry": [[lng, lat], ...],   # full route polyline
          "distance_m": float,
          "duration_s": float,
          "steps": [
            {"instruction": str, "distance_m": float, "duration_s": float,
             "type": int, "name": str, "location": [lng, lat]},
            ...
          ],
        }
    """
    settings = get_settings()
    if settings.routing_provider == "openrouteservice":
        return await _ors_route(start_lng, start_lat, end_lng, end_lat, settings.ors_api_key)
    raise RoutingNotConfigured(f"unknown routing provider: {settings.routing_provider}")


async def _ors_route(
    start_lng: float,
    start_lat: float,
    end_lng: float,
    end_lat: float,
    key: str,
) -> dict[str, Any]:
    key = (key or "").strip()
    if not key:
        raise RoutingNotConfigured("routing not configured")

    body = {
        "coordinates": [[start_lng, start_lat], [end_lng, end_lat]],
        "instructions": True,
        "units": "m",
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                _ORS_URL,
                json=body,
                headers={"Authorization": key, "Content-Type": "application/json"},
            )
    except httpx.HTTPError as exc:
        raise RoutingError(f"routing request failed: {exc}") from exc

    if resp.status_code != 200:
        logger.warning("routing.ors_error", status=resp.status_code, body=resp.text[:300])
        raise RoutingError(f"routing provider returned {resp.status_code}")

    data = resp.json()
    features = data.get("features") or []
    if not features:
        raise RoutingError("no route found")

    feat = features[0]
    coords = (feat.get("geometry") or {}).get("coordinates") or []
    props = feat.get("properties") or {}
    segments = props.get("segments") or []
    summary = props.get("summary") or {}

    total_dist = float(
        summary.get("distance")
        if summary.get("distance") is not None
        else sum(float(s.get("distance") or 0) for s in segments)
    )
    total_dur = float(
        summary.get("duration")
        if summary.get("duration") is not None
        else sum(float(s.get("duration") or 0) for s in segments)
    )

    steps_out: list[dict[str, Any]] = []
    for seg in segments:
        for st in seg.get("steps") or []:
            # way_points = [start_index, end_index] into the route geometry.
            # The maneuver happens at the START of the step.
            wp = st.get("way_points") or [0, 0]
            idx = int(wp[0]) if wp else 0
            if 0 <= idx < len(coords):
                loc = coords[idx]
            else:
                loc = coords[0] if coords else [start_lng, start_lat]
            steps_out.append(
                {
                    "instruction": st.get("instruction") or "",
                    "distance_m": float(st.get("distance") or 0),
                    "duration_s": float(st.get("duration") or 0),
                    "type": int(st.get("type")) if st.get("type") is not None else -1,
                    "name": st.get("name") or "",
                    "location": [float(loc[0]), float(loc[1])],
                }
            )

    return {
        "geometry": [[float(c[0]), float(c[1])] for c in coords],
        "distance_m": total_dist,
        "duration_s": total_dur,
        "steps": steps_out,
    }
