"""Storm + hail swath queries against PostGIS."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from geoalchemy2 import Geography
from geoalchemy2.functions import (
    ST_AsGeoJSON,
    ST_Contains,
    ST_Distance,
    ST_DWithin,
    ST_Intersects,
    ST_MakeEnvelope,
    ST_MakePoint,
    ST_Multi,
    ST_SetSRID,
    ST_SimplifyPreserveTopology,
)
from sqlalchemy import and_, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.core import get_logger
from hailscout_api.db.models.storm import HailSwath, Storm
from hailscout_api.services.impact import bbox_area_km2, storm_impact
from hailscout_api.services.verification import attach_verification

logger = get_logger(__name__)


# ---- Storm list (with serialized geometry) ----

async def query_storms_in_bbox(
    session: AsyncSession,
    min_lon: float,
    min_lat: float,
    max_lon: float,
    max_lat: float,
    from_date: datetime,
    to_date: datetime,
    limit: int = 50,
    include_swaths: bool = False,
    swath_simplify_tolerance: float = 0.05,
    source: str | None = None,
    min_hail_size_in: float | None = None,
    order: str = "recent",
    include_unconfirmed: bool = False,
) -> list[dict[str, Any]]:
    """Storms whose bbox intersects the query envelope, in date range.

    Returns a list of dicts ready for the Pydantic response — fields
    include `centroid` and `bbox` already serialized to GeoJSON.

    When include_swaths=True, each storm dict also contains a `swaths`
    list with each swath's category + GeoJSON MultiPolygon. Geometries
    are passed through ST_Simplify at the supplied tolerance (degrees)
    so the payload stays sane for CONUS-wide map renders. Tolerance
    0.05 ≈ 5km — fine for zoom 4-6 (state-level), coarse for closer
    inspection. Pass 0 for no simplification.

    Optional server-side filters:
      source           — "MRMS" | "NEXRAD" (case-sensitive match)
      min_hail_size_in — drop storms with peak < this value
    """
    envelope = ST_SetSRID(
        ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat), 4326
    )
    filters = [
        Storm.start_time >= from_date,
        Storm.start_time <= to_date,
        ST_Intersects(Storm.bbox_geom, envelope),
    ]
    if source:
        filters.append(Storm.source == source)
    if min_hail_size_in is not None and min_hail_size_in > 0:
        filters.append(Storm.max_hail_size_in >= min_hail_size_in)
    # False-positive screening (Phase 23.5): default-hide rows the
    # storm_screener has tagged as suspect. Callers asking for the
    # full unfiltered set pass `include_unconfirmed=True`.
    if not include_unconfirmed:
        filters.append(Storm.suspect.is_(False))

    # Sort: "recent" (default) = by start_time DESC; "peak" = by
    # max_hail_size_in DESC for "biggest events" leaderboards.
    if order == "peak":
        order_clause = Storm.max_hail_size_in.desc()
    else:
        order_clause = Storm.start_time.desc()

    stmt = (
        select(
            Storm.id,
            Storm.start_time,
            Storm.end_time,
            Storm.max_hail_size_in,
            Storm.source,
            Storm.lsr_confirmed,
            Storm.lsr_observed_size_in,
            Storm.lsr_observed_at,
            Storm.confidence,
            Storm.suspect,
            Storm.suspect_reasons,
            ST_AsGeoJSON(Storm.centroid_geom).label("centroid_json"),
            ST_AsGeoJSON(Storm.bbox_geom).label("bbox_json"),
        )
        .where(and_(*filters))
        .order_by(order_clause)
        .limit(limit)
    )
    rows = (await session.execute(stmt)).all()
    out: list[dict[str, Any]] = []
    storm_ids: list[str] = []
    for r in rows:
        out.append({
            "id": r.id,
            "start_time": r.start_time,
            "end_time": r.end_time,
            "max_hail_size_in": r.max_hail_size_in,
            "source": r.source,
            "lsr_confirmed": bool(r.lsr_confirmed),
            "lsr_observed_size_in": r.lsr_observed_size_in,
            "lsr_observed_at": r.lsr_observed_at,
            "confidence": float(r.confidence) if r.confidence is not None else 1.0,
            "suspect": bool(r.suspect),
            "suspect_reasons": (
                [t for t in (r.suspect_reasons or "").split(",") if t]
                if r.suspect_reasons else []
            ),
            "centroid": json.loads(r.centroid_json) if r.centroid_json else None,
            "bbox": json.loads(r.bbox_json) if r.bbox_json else None,
        })
        storm_ids.append(r.id)

    # Impact Score (1-5) — the rep's triage number (size + footprint +
    # confirmation). Attached to every storm in the list (powers the map
    # picker + storm cards).
    for s in out:
        s["impact"] = storm_impact(
            s["max_hail_size_in"],
            bbox_area_km2(s.get("bbox")),
            lsr_confirmed=s.get("lsr_confirmed", False),
            suspect=s.get("suspect", False),
        )

    if include_swaths and storm_ids:
        # Single batched query for every swath belonging to the matched
        # storms — N+1 would be brutal across 200 storms.
        # ST_SimplifyPreserveTopology guarantees a non-empty result even
        # when small per-cell polygons would otherwise collapse under
        # plain ST_Simplify. Wrap with ST_Multi so the output stays a
        # MultiPolygon (simplification can downgrade a single-piece
        # MultiPolygon to a plain Polygon, which fails Pydantic).
        # ST_ChaikinSmoothing(1) rounds the 1km-grid stair-steps into
        # gentler curves without homogenizing every polygon into the
        # same oval. 2 iterations was over-smoothing — small cells lost
        # their shape signature entirely.
        if swath_simplify_tolerance > 0:
            simplified = ST_SimplifyPreserveTopology(
                HailSwath.geom_multipolygon, swath_simplify_tolerance
            )
            smoothed = func.ST_ChaikinSmoothing(simplified, 1)
            geom_expr = ST_AsGeoJSON(ST_Multi(smoothed))
        else:
            geom_expr = ST_AsGeoJSON(HailSwath.geom_multipolygon)
        swath_stmt = (
            select(
                HailSwath.id,
                HailSwath.storm_id,
                HailSwath.hail_size_category,
                geom_expr.label("geom_json"),
                HailSwath.updated_at,
            )
            .where(HailSwath.storm_id.in_(storm_ids))
            .order_by(HailSwath.hail_size_category)
        )
        swath_rows = (await session.execute(swath_stmt)).all()
        by_storm: dict[str, list[dict[str, Any]]] = {sid: [] for sid in storm_ids}
        for s in swath_rows:
            by_storm.setdefault(s.storm_id, []).append({
                "id": s.id,
                "hail_size_category": s.hail_size_category,
                "geometry": json.loads(s.geom_json) if s.geom_json else None,
                "updated_at": s.updated_at,
            })
        for storm in out:
            storm["swaths"] = by_storm.get(storm["id"], [])

    logger.info("Queried storms in bbox", count=len(out),
                bbox=(min_lon, min_lat, max_lon, max_lat),
                include_swaths=include_swaths)
    return out


# ---- Storm detail with swaths ----

async def get_storm_with_swaths(
    session: AsyncSession,
    storm_id: str,
) -> dict[str, Any] | None:
    """Storm + all its hail swaths as GeoJSON. None if not found."""
    storm_stmt = (
        select(
            Storm.id,
            Storm.start_time,
            Storm.end_time,
            Storm.max_hail_size_in,
            Storm.source,
            Storm.lsr_confirmed,
            Storm.lsr_observed_size_in,
            Storm.lsr_observed_at,
            Storm.confidence,
            Storm.suspect,
            Storm.suspect_reasons,
            ST_AsGeoJSON(Storm.centroid_geom).label("centroid_json"),
            ST_AsGeoJSON(Storm.bbox_geom).label("bbox_json"),
        )
        .where(Storm.id == storm_id)
    )
    row = (await session.execute(storm_stmt)).first()
    if row is None:
        return None

    swath_stmt = (
        select(
            HailSwath.id,
            HailSwath.hail_size_category,
            ST_AsGeoJSON(HailSwath.geom_multipolygon).label("geom_json"),
            HailSwath.updated_at,
        )
        .where(HailSwath.storm_id == storm_id)
        .order_by(HailSwath.hail_size_category)
    )
    swath_rows = (await session.execute(swath_stmt)).all()
    swaths = [
        {
            "id": s.id,
            "hail_size_category": s.hail_size_category,
            "geometry": json.loads(s.geom_json) if s.geom_json else None,
            "updated_at": s.updated_at,
        }
        for s in swath_rows
    ]

    bbox_geo = json.loads(row.bbox_json) if row.bbox_json else None
    return {
        "id": row.id,
        "start_time": row.start_time,
        "end_time": row.end_time,
        "max_hail_size_in": row.max_hail_size_in,
        "source": row.source,
        "lsr_confirmed": bool(row.lsr_confirmed),
        "lsr_observed_size_in": row.lsr_observed_size_in,
        "lsr_observed_at": row.lsr_observed_at,
        "confidence": float(row.confidence) if row.confidence is not None else 1.0,
        "suspect": bool(row.suspect),
        "suspect_reasons": (
            [t for t in (row.suspect_reasons or "").split(",") if t]
            if row.suspect_reasons else []
        ),
        "centroid": json.loads(row.centroid_json) if row.centroid_json else None,
        "bbox": bbox_geo,
        "impact": storm_impact(
            row.max_hail_size_in,
            bbox_area_km2(bbox_geo),
            lsr_confirmed=bool(row.lsr_confirmed),
            suspect=bool(row.suspect),
        ),
        "swaths": swaths,
    }


# ---- "What hit this address?" — storms whose swaths contain the point ----

async def query_hail_at_point(
    session: AsyncSession,
    lat: float,
    lng: float,
    from_date: datetime | None = None,
    to_date: datetime | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    """For a single (lat, lng), return the storms whose hail swaths contain it.

    Each result includes the largest swath category that contains the point.
    """
    point = ST_SetSRID(ST_MakePoint(lng, lat), 4326)

    stmt = (
        select(
            Storm.id,
            Storm.start_time,
            Storm.end_time,
            Storm.max_hail_size_in,
            Storm.source,
            Storm.suspect,
            Storm.confidence,
            Storm.lsr_confirmed,
            Storm.lsr_observed_size_in,
            Storm.lsr_observed_at,
            Storm.hail_confirmed,
            Storm.hail_gate_fraction,
            Storm.peak_dbz,
            HailSwath.hail_size_category,
        )
        .join(HailSwath, HailSwath.storm_id == Storm.id)
        .where(ST_Contains(HailSwath.geom_multipolygon, point))
    )
    if from_date:
        stmt = stmt.where(Storm.start_time >= from_date)
    if to_date:
        stmt = stmt.where(Storm.start_time <= to_date)
    stmt = stmt.order_by(Storm.start_time.desc()).limit(limit)

    rows = (await session.execute(stmt)).all()

    # Roll up: one row per storm, keeping the *largest* category that contained the point
    by_storm: dict[str, dict[str, Any]] = {}
    for r in rows:
        existing = by_storm.get(r.id)
        cat = r.hail_size_category
        if existing is None:
            by_storm[r.id] = {
                "id": r.id,
                "start_time": r.start_time,
                "end_time": r.end_time,
                "max_hail_size_in": r.max_hail_size_in,
                "source": r.source,
                "suspect": bool(r.suspect),
                "confidence": float(r.confidence) if r.confidence is not None else 1.0,
                "lsr_confirmed": bool(r.lsr_confirmed),
                "lsr_observed_size_in": r.lsr_observed_size_in,
                "lsr_observed_at": r.lsr_observed_at,
                "hail_confirmed": bool(r.hail_confirmed),
                "hail_gate_fraction": r.hail_gate_fraction,
                "peak_dbz": r.peak_dbz,
                "category_at_point": cat,
            }
        else:
            # Keep the largest category — order by min_inches as float
            try:
                if _cat_min(cat) > _cat_min(existing["category_at_point"]):
                    existing["category_at_point"] = cat
            except ValueError:
                pass

    out = list(by_storm.values())
    out.sort(key=lambda d: d["start_time"], reverse=True)

    # CRITICAL for address lookups: the size that matters at an address
    # is the size AT THE POINT (the largest band containing it), NOT the
    # storm's global peak. A storm can span 50+ km with a 3"+ core miles
    # away while only 1.25" fell at this exact address. `size_at_point`
    # is that location-specific number; `max_hail_size_in` is kept as
    # the storm's peak-anywhere for context.
    for s in out:
        try:
            s["size_at_point"] = _cat_min(s["category_at_point"])
        except (ValueError, KeyError):
            s["size_at_point"] = s.get("max_hail_size_in")

    # Fuse the multi-source signals into a verification tier +
    # adjuster-facing defensibility statement. Scored on the at-point
    # size so the defensibility statement quotes the size that actually
    # fell here, not the storm's peak miles away.
    # ── Fuse nearby SPC ground reports (LSRs) — the gold standard ───────
    # A radar swath frequently won't cover an exact address even when a
    # trained spotter reported large hail a mile away (e.g. a 1.5" Arvada
    # report next to a cell our MESH read at 1.0"). Surface ground reports
    # within a short radius as their own hits so "what hit this address"
    # reflects the best available truth, not radar alone.
    #
    # The WHERE uses geometry-degrees ST_DWithin so the GiST index on
    # centroid_geom is used — casting the COLUMN to Geography (the previous
    # version) forced a full scan of every LSR row on a hot public route.
    # The geography ST_Distance in the SELECT only runs on matches.
    GROUND_RADIUS_DEG = 0.06  # ≈4.1 mi N-S; ~3.2 mi E-W at 40°N
    geog_centroid = cast(Storm.centroid_geom, Geography)
    geog_point = cast(point, Geography)
    lsr_stmt = (
        select(
            Storm.id,
            Storm.start_time,
            Storm.end_time,
            Storm.max_hail_size_in,
            Storm.source,
            ST_Distance(geog_centroid, geog_point).label("dist_m"),
        )
        .where(Storm.source == "SPC-LSR")
        .where(ST_DWithin(Storm.centroid_geom, point, GROUND_RADIUS_DEG))
    )
    if from_date:
        lsr_stmt = lsr_stmt.where(Storm.start_time >= from_date)
    if to_date:
        lsr_stmt = lsr_stmt.where(Storm.start_time <= to_date)
    lsr_stmt = lsr_stmt.order_by("dist_m").limit(limit)

    def _already_confirmed_by(r) -> bool:
        """True when a radar hit was already confirmed by an equivalent
        report (same size, observed within ~31 min) — listing the raw LSR
        row too would double-count one observation at this address."""
        for d in out:
            if not d.get("lsr_confirmed") or d.get("lsr_observed_size_in") is None:
                continue
            if abs(float(d["lsr_observed_size_in"]) - float(r.max_hail_size_in)) > 0.01:
                continue
            ts = d.get("lsr_observed_at")
            if ts is not None and abs((ts - r.start_time).total_seconds()) <= 31 * 60:
                return True
        return False

    n_ground = 0
    for r in (await session.execute(lsr_stmt)).all():
        if _already_confirmed_by(r):
            continue
        size = float(r.max_hail_size_in)
        n_ground += 1
        out.append({
            "id": r.id,
            "start_time": r.start_time,
            "end_time": r.end_time,
            "max_hail_size_in": size,
            "source": r.source,  # "SPC-LSR"
            "suspect": False,
            "confidence": 1.0,
            "lsr_confirmed": True,
            "lsr_observed_size_in": size,
            "lsr_observed_at": r.start_time,
            "hail_confirmed": True,
            "hail_gate_fraction": None,
            "peak_dbz": None,
            "category_at_point": f"{size:.2f}",
            "size_at_point": size,
            "distance_mi": round(float(r.dist_m) / 1609.34, 1),
        })

    # Verification tiers for EVERYTHING — including the ground reports.
    # (This used to run before the LSR fusion, so the strongest evidence
    # class came back with verification=None while weaker radar hits got a
    # full defensibility block.)
    attach_verification(out, size_key="size_at_point")

    # Lead with ground reports (largest first), then radar hits in time order.
    ground = [d for d in out if d.get("source") == "SPC-LSR"]
    radar = [d for d in out if d.get("source") != "SPC-LSR"]
    ground.sort(key=lambda d: d.get("size_at_point") or 0.0, reverse=True)
    out = (ground + radar)[:limit]

    logger.info("Hail at point", lat=lat, lng=lng, hits=len(out),
                ground_reports=n_ground)
    return out


async def get_storms_stats(session: AsyncSession) -> dict[str, Any]:
    """Aggregate counters for the public /v1/storms/stats endpoint.

    Cheap rollup over the whole `storms` table. Returns:
        total_cells          — every Storm row in the DB
        cells_last_24h       — Storm rows with start_time >= now - 24h
        cells_last_7d
        cells_last_30d
        peak_hail_in         — max(max_hail_size_in)
        sources              — {"MRMS": N, "NEXRAD": N, ...}
        earliest             — min(start_time)
        latest               — max(start_time)
    """
    # Counts per recent window — single roundtrip via CASE WHEN
    from datetime import timedelta, timezone

    now = datetime.now(timezone.utc)
    h24 = now - timedelta(hours=24)
    d7 = now - timedelta(days=7)
    d30 = now - timedelta(days=30)

    stmt = select(
        func.count(Storm.id).label("total"),
        func.count(Storm.id).filter(Storm.start_time >= h24).label("c24"),
        func.count(Storm.id).filter(Storm.start_time >= d7).label("c7"),
        func.count(Storm.id).filter(Storm.start_time >= d30).label("c30"),
        func.max(Storm.max_hail_size_in).label("peak"),
        func.min(Storm.start_time).label("earliest"),
        func.max(Storm.start_time).label("latest"),
    )
    row = (await session.execute(stmt)).first()

    # Per-source counts
    src_stmt = (
        select(Storm.source, func.count(Storm.id).label("n"))
        .group_by(Storm.source)
    )
    src_rows = (await session.execute(src_stmt)).all()
    sources = {r.source: int(r.n) for r in src_rows}

    out = {
        "total_cells": int(row.total or 0) if row else 0,
        "cells_last_24h": int(row.c24 or 0) if row else 0,
        "cells_last_7d": int(row.c7 or 0) if row else 0,
        "cells_last_30d": int(row.c30 or 0) if row else 0,
        "peak_hail_in": float(row.peak or 0.0) if row else 0.0,
        "earliest": row.earliest if row else None,
        "latest": row.latest if row else None,
        "sources": sources,
    }
    logger.info("Storms stats rolled up", **{
        k: v for k, v in out.items() if k not in ("sources", "earliest", "latest")
    })
    return out


def _cat_min(label: str) -> float:
    """Min hail size in inches for a category label like '1.5' or '3.0+'."""
    return float(label.rstrip("+"))
