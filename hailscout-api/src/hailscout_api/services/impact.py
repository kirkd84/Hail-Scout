"""Storm Impact Score — the rep's triage number.

Phase 31. Both IHM ("overall impact") and HailStrike ("Impact Score 1-5")
lead each storm with a single severity number so a contractor can decide
which storm to work first. We were missing it. Ours combines the three
things that actually drive opportunity size, and — unlike HailStrike's
"patented" black box — the formula is transparent:

  * Peak hail size — bigger stones = more roof damage = more demand.
  * Footprint extent — a wider swath = more affected rooftops.
  * Ground-truth confirmation — a confirmed storm is a surer bet, so it
    nudges the score up (and an unverified/suspect one nudges it down).

Output is a 1-5 score (matching the competitors' scale) plus a label.
"""

from __future__ import annotations

import math
from typing import Any, Optional

# Normalization anchors.
_SIZE_MIN = 0.75   # below this = no meaningful hail
_SIZE_MAX = 3.0    # softball+ saturates the size component
_AREA_SAT_KM2 = 4000.0  # a swath this big saturates the area component

_LABELS = {
    1: "Minimal",
    2: "Minor",
    3: "Moderate",
    4: "Significant",
    5: "Severe",
}


def bbox_area_km2(bbox_geojson: Optional[dict[str, Any]]) -> float:
    """Approximate area (km²) of a GeoJSON bbox polygon, latitude-corrected."""
    if not bbox_geojson or not bbox_geojson.get("coordinates"):
        return 0.0
    try:
        ring = bbox_geojson["coordinates"][0]
        lngs = [p[0] for p in ring]
        lats = [p[1] for p in ring]
        dlng = max(lngs) - min(lngs)
        dlat = max(lats) - min(lats)
        mid = (max(lats) + min(lats)) / 2.0
        km_per_deg_lat = 111.0
        km_per_deg_lng = 111.0 * math.cos(math.radians(mid))
        return abs(dlng * km_per_deg_lng) * abs(dlat * km_per_deg_lat)
    except (TypeError, ValueError, IndexError):
        return 0.0


def storm_impact(
    max_size_in: Optional[float],
    area_km2: float,
    *,
    lsr_confirmed: bool = False,
    suspect: bool = False,
) -> dict[str, Any]:
    """Return {"score": 1-5, "label": str, "factors": {...}}.

    Weighted blend of size (60%) and footprint (40%), then a small
    confirmation adjustment. Transparent + deterministic.
    """
    size = max_size_in or 0.0
    size_norm = max(0.0, min(1.0, (size - _SIZE_MIN) / (_SIZE_MAX - _SIZE_MIN)))
    # sqrt so a modest swath already counts; huge swaths don't dwarf size.
    area_norm = max(0.0, min(1.0, math.sqrt(max(0.0, area_km2) / _AREA_SAT_KM2)))

    raw = 0.6 * size_norm + 0.4 * area_norm  # 0..1

    # Confirmation nudge: a ground-truth-confirmed storm is a surer
    # opportunity (+0.08); a screener-flagged suspect one is discounted.
    if lsr_confirmed:
        raw = min(1.0, raw + 0.08)
    if suspect:
        raw = max(0.0, raw - 0.15)

    score = max(1, min(5, 1 + round(raw * 4)))
    return {
        "score": score,
        "label": _LABELS[score],
        "factors": {
            "size_in": round(size, 2),
            "area_km2": round(area_km2, 1),
            "lsr_confirmed": lsr_confirmed,
        },
    }
