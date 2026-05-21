"""Storm false-positive screener.

Phase 23.5. MRMS MESH and single-radar NEXRAD both produce occasional
spurious giant-hail readings:

    * Bird/insect bloom at dusk            → strong reflectivity but no hail
    * Anaprop / ground clutter             → mountain regions, inversions
    * Single-pixel noise                   → one MESH cell of 2.5″, nothing else
    * Beam overshoot at range              → cell is far from any radar; the
                                             beam at that location is several
                                             km AGL, so high-altitude graupel
                                             gets called ground hail

We can't perfectly distinguish these from real cells without
ground-truth verification, but a handful of independent signals get
us close:

    A. LSR proximity — was a ground report filed nearby + same window?
    B. Cross-source confirmation — did MRMS *and* NEXRAD both see it?
    C. Footprint area vs. claimed peak size
    D. Persistence — single-frame events with giant hail are noise

This module computes a confidence score in [0, 1] for each storm and
flags any score below SUSPECT_THRESHOLD as `suspect`. The API
default-hides suspect rows (opt-in via `?include_unconfirmed=1`).

Storm rows themselves are kept — useful for debugging, for future
labels-vs-truth model training, and so dismissals are reversible if
the heuristic is wrong.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

from geoalchemy2.functions import (
    ST_Area,
    ST_DWithin,
    ST_MakeEnvelope,
    ST_MakePoint,
    ST_SetSRID,
)
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.db.models.storm import Storm

log = logging.getLogger(__name__)


# ── Tunables ────────────────────────────────────────────────────────

SUSPECT_THRESHOLD = 0.50  # confidence < this → suspect

# How far around a storm centroid we look for corroborating signals.
LSR_SEARCH_RADIUS_DEG = 1.0          # ~110 km
LSR_TIME_WINDOW = timedelta(hours=3)

CROSS_SOURCE_RADIUS_DEG = 0.5        # ~55 km
CROSS_SOURCE_TIME_WINDOW = timedelta(minutes=30)

# Floor footprint area (degrees²) required for a "giant hail" claim.
# 0.0025 deg² ≈ 30 km² at CONUS latitudes — about the size of a small
# town. Single MESH pixels are 0.01° on a side → 0.0001 deg², two
# orders of magnitude below this floor.
MIN_AREA_DEG2_FOR_GIANT = 0.0025
GIANT_HAIL_THRESHOLD_IN = 2.0

# Hail-belt + Front Range population centers used for "is the cell in
# a metro area where we'd expect ground reports?" The radius is
# generous on purpose — we only want to suppress the "no LSR" penalty
# in genuinely rural areas. Coords are (lat, lng).
POPULATED_CENTERS: list[tuple[str, float, float]] = [
    ("Dallas-Fort Worth",  32.78, -96.80),
    ("Houston",            29.76, -95.37),
    ("Austin",             30.27, -97.74),
    ("San Antonio",        29.42, -98.49),
    ("Oklahoma City",      35.47, -97.52),
    ("Tulsa",              36.15, -95.99),
    ("Wichita",            37.69, -97.34),
    ("Kansas City",        39.10, -94.58),
    ("St. Louis",          38.63, -90.20),
    ("Springfield MO",     37.21, -93.30),
    ("Memphis",            35.15, -90.05),
    ("Nashville",          36.16, -86.78),
    ("Birmingham",         33.52, -86.81),
    ("Atlanta",            33.75, -84.39),
    ("Charlotte",          35.23, -80.84),
    ("Raleigh",            35.78, -78.64),
    ("Louisville",         38.25, -85.76),
    ("Indianapolis",       39.77, -86.16),
    ("Cincinnati",         39.10, -84.51),
    ("Columbus OH",        39.96, -82.99),
    ("Cleveland",          41.50, -81.69),
    ("Detroit",            42.33, -83.05),
    ("Chicago",            41.88, -87.63),
    ("Milwaukee",          43.04, -87.91),
    ("Minneapolis",        44.98, -93.27),
    ("Omaha",              41.26, -95.93),
    ("Des Moines",         41.59, -93.62),
    ("Denver",             39.74, -104.99),
    ("Colorado Springs",   38.83, -104.82),
    ("Albuquerque",        35.08, -106.65),
    ("Phoenix",            33.45, -112.07),
    ("Salt Lake City",     40.76, -111.89),
    ("Boise",              43.62, -116.20),
    ("Lubbock",            33.58, -101.86),
    ("Amarillo",           35.22, -101.83),
]

POPULATED_RADIUS_DEG = 0.6  # ~65 km — covers most US metros' footprints


def _is_populated(lat: float, lng: float) -> Optional[str]:
    for name, plat, plng in POPULATED_CENTERS:
        if abs(lat - plat) > POPULATED_RADIUS_DEG:
            continue
        if abs(lng - plng) > POPULATED_RADIUS_DEG:
            continue
        # Cheap squared-distance check
        dlat = lat - plat
        dlng = lng - plng
        if dlat * dlat + dlng * dlng <= POPULATED_RADIUS_DEG * POPULATED_RADIUS_DEG:
            return name
    return None


@dataclass
class ScreenReason:
    tag: str
    penalty: float


def _classify(
    storm: Storm,
    *,
    centroid_lat: float,
    centroid_lng: float,
    bbox_area_deg2: float,
    nearby_lsr_count: int,
    cross_source_count: int,
) -> tuple[float, list[str]]:
    """Apply the rule set; return (confidence, reasons).

    Reasons are ordered from highest to lowest penalty so the UI can
    surface the dominant one.
    """
    # Skip screening for SPC-LSR rows — those ARE ground truth.
    if storm.source == "SPC-LSR":
        return 1.0, []

    reasons: list[ScreenReason] = []
    size = storm.max_hail_size_in or 0.0
    lsr_confirmed = bool(storm.lsr_confirmed)

    # Rule 1 — implausibly small footprint for the claimed peak size.
    # A real 2″+ hail core covers many square km; a single pixel of
    # 2.5″ with no neighbors is almost certainly noise.
    if size >= GIANT_HAIL_THRESHOLD_IN and bbox_area_deg2 < MIN_AREA_DEG2_FOR_GIANT:
        reasons.append(ScreenReason(
            "implausibly_small_for_size",
            penalty=0.55,
        ))

    # Rule 2 — populated area + giant hail + no LSR within ±3hr.
    # In a metro, even moderate 1.5″ hail typically generates ≥1 LSR
    # within a couple hours. Zero LSRs around a 2″+ claim there is
    # the strongest false-positive signal we have.
    if size >= 1.5:
        metro = _is_populated(centroid_lat, centroid_lng)
        if metro and not lsr_confirmed and nearby_lsr_count == 0:
            # Penalty scales with size — a 2.5″ no-LSR claim in Denver
            # is much more suspicious than a 1.5″ one.
            pen = 0.35 if size < 2.0 else 0.55
            reasons.append(ScreenReason(
                f"no_lsr_near_{metro.lower().replace(' ', '_').replace('-', '_')}",
                penalty=pen,
            ))

    # Rule 3 — single-source giant hail. If MRMS shows ≥2″ but no
    # NEXRAD cell exists within ±30 min and ~55 km, we don't have
    # cross-source corroboration. (And vice versa for NEXRAD without
    # MRMS — though MRMS is grid-wide so its absence at a real event
    # would be unusual.)
    if size >= GIANT_HAIL_THRESHOLD_IN and cross_source_count == 0 and not lsr_confirmed:
        reasons.append(ScreenReason(
            "no_cross_source_confirmation",
            penalty=0.30,
        ))

    # Rule 4 — duration sanity. Storms with start_time == end_time are
    # single-frame events. For ≥1.5″ that's a noise signal; real hail
    # storms produce multi-minute swaths.
    duration_s = (storm.end_time - storm.start_time).total_seconds()
    if size >= 1.5 and duration_s < 60:
        reasons.append(ScreenReason(
            "single_frame_no_persistence",
            penalty=0.25,
        ))

    if not reasons:
        return 1.0, []

    # Combine penalties multiplicatively against confidence=1, so two
    # 0.5 penalties leave us at 0.25 — appropriately worse than either
    # alone but bounded.
    confidence = 1.0
    for r in reasons:
        confidence *= (1.0 - r.penalty)
    confidence = max(0.0, min(1.0, confidence))

    reasons.sort(key=lambda r: r.penalty, reverse=True)
    return confidence, [r.tag for r in reasons]


# ── Top-level entrypoint ────────────────────────────────────────────

async def screen_recent_storms(
    session: AsyncSession,
    lookback_days: int = 30,
    only_unscreened: bool = False,
    limit: Optional[int] = None,
) -> dict:
    """Walk recent storms and stamp confidence / suspect / reasons.

    Idempotent — re-running just refreshes the same fields with the
    current rule set. Use `only_unscreened=True` to incrementally
    process new arrivals from the live pipeline without re-evaluating
    everything.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=lookback_days)

    stmt = (
        select(Storm)
        .where(Storm.start_time >= cutoff)
        .order_by(Storm.start_time.desc())
    )
    if only_unscreened:
        stmt = stmt.where(Storm.screened_at.is_(None))
    if limit is not None:
        stmt = stmt.limit(limit)

    storms = (await session.execute(stmt)).scalars().all()

    flagged = 0
    cleared = 0
    skipped_lsr = 0

    for storm in storms:
        # Pull centroid coords from the geometry. Postgres returns a WKB
        # element; we go through ST_X / ST_Y to get plain floats.
        coord_row = (await session.execute(
            select(
                func.ST_X(Storm.centroid_geom).label("lng"),
                func.ST_Y(Storm.centroid_geom).label("lat"),
                ST_Area(Storm.bbox_geom).label("area_deg2"),
            ).where(Storm.id == storm.id)
        )).first()
        if coord_row is None:
            continue
        centroid_lat = float(coord_row.lat or 0.0)
        centroid_lng = float(coord_row.lng or 0.0)
        bbox_area_deg2 = float(coord_row.area_deg2 or 0.0)

        if storm.source == "SPC-LSR":
            storm.confidence = 1.0
            storm.suspect = False
            storm.suspect_reasons = None
            storm.screened_at = datetime.now(timezone.utc)
            skipped_lsr += 1
            continue

        # LSR proximity — count SPC-LSR rows within ~110km and ±3h.
        # Cheap rectangular pre-filter (lat/lng abs-diff bounds) before
        # the precise PostGIS check; saves a full ST_DWithin scan.
        lo = storm.start_time - LSR_TIME_WINDOW
        hi = storm.start_time + LSR_TIME_WINDOW
        envelope = ST_SetSRID(
            ST_MakeEnvelope(
                centroid_lng - LSR_SEARCH_RADIUS_DEG,
                centroid_lat - LSR_SEARCH_RADIUS_DEG,
                centroid_lng + LSR_SEARCH_RADIUS_DEG,
                centroid_lat + LSR_SEARCH_RADIUS_DEG,
            ),
            4326,
        )
        point = ST_SetSRID(
            ST_MakePoint(centroid_lng, centroid_lat), 4326,
        )
        nearby_lsr_count = (await session.execute(
            select(func.count(Storm.id)).where(and_(
                Storm.source == "SPC-LSR",
                Storm.start_time >= lo,
                Storm.start_time <= hi,
                ST_DWithin(Storm.centroid_geom, point, LSR_SEARCH_RADIUS_DEG),
            ))
        )).scalar_one()

        # Cross-source — any *different*-source storm nearby in time?
        # Group MRMS-related sources together vs NEXRAD vs LSR.
        opposite_source = (
            "NEXRAD" if storm.source.upper().startswith("MRMS") or storm.source.upper() == "MESH"
            else "MRMS"
        )
        cs_lo = storm.start_time - CROSS_SOURCE_TIME_WINDOW
        cs_hi = storm.start_time + CROSS_SOURCE_TIME_WINDOW
        cross_source_count = (await session.execute(
            select(func.count(Storm.id)).where(and_(
                Storm.id != storm.id,
                # Loose match — accept any non-LSR, non-same-source row.
                # The narrower check (exact opposite_source) would miss
                # cases where storm.source is "MRMS-CONUS" vs candidate
                # is "NEXRAD-KFTG", both of which substring-match.
                Storm.source != "SPC-LSR",
                ~func.lower(Storm.source).like(
                    func.lower(storm.source.split("-")[0]) + "%",
                ),
                Storm.start_time >= cs_lo,
                Storm.start_time <= cs_hi,
                ST_DWithin(Storm.centroid_geom, point, CROSS_SOURCE_RADIUS_DEG),
            ))
        )).scalar_one()

        confidence, reasons = _classify(
            storm,
            centroid_lat=centroid_lat,
            centroid_lng=centroid_lng,
            bbox_area_deg2=bbox_area_deg2,
            nearby_lsr_count=int(nearby_lsr_count or 0),
            cross_source_count=int(cross_source_count or 0),
        )

        storm.confidence = float(confidence)
        storm.suspect = bool(confidence < SUSPECT_THRESHOLD)
        storm.suspect_reasons = ",".join(reasons) if reasons else None
        storm.screened_at = datetime.now(timezone.utc)
        if storm.suspect:
            flagged += 1
        else:
            cleared += 1

    await session.commit()

    out = {
        "scanned": len(storms),
        "flagged_suspect": flagged,
        "cleared": cleared,
        "skipped_lsr": skipped_lsr,
        "lookback_days": lookback_days,
        "suspect_threshold": SUSPECT_THRESHOLD,
    }
    log.info("storm_screener.done %s", out)
    return out
