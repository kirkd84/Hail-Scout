"""SPC hail-outlook ingestion.

The Storm Prediction Center publishes its day-1/2 hail outlooks as plain
GeoJSON — one feature per probability contour, with the valid window stamped
on the feature itself. That feed is the whole basis of the "45% chance of hail
in your area today" notification: a FORECAST of where hail is likely later,
the complement of the MRMS radar layers (where hail is falling right now).

Everything here degrades to a no-op. A 500 from spc.noaa.gov, a truncated
body, a feature with an unparseable stamp, or a genuinely quiet day with zero
features all leave `hail_outlooks` exactly as it was. We never synthesize a
contour — an empty table is the honest answer to "no risk today".

Called from `workers.alert_worker` on a slow cadence; SPC re-issues day 1 five
times a day, so hourly is plenty.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

log = logging.getLogger(__name__)


# (day, kind, url). Day 3 has no hail-specific product — SPC switches to a
# combined severe probability there — so it's deliberately absent.
_FEEDS: tuple[tuple[int, str, str], ...] = (
    (1, "hail", "https://www.spc.noaa.gov/products/outlook/day1otlk_hail.nolyr.geojson"),
    (2, "hail", "https://www.spc.noaa.gov/products/outlook/day2otlk_hail.nolyr.geojson"),
    (1, "sighail", "https://www.spc.noaa.gov/products/outlook/day1otlk_sighail.nolyr.geojson"),
)

# The significant-hail area is a hatched "10% or greater chance of 2-inch
# hail" region — the number is a convention, not a forecast probability. We
# store it so the column stays non-null and let `kind="sighail"` carry the
# meaning everywhere it's read.
_SIGHAIL_PROBABILITY = 0.10

_TIMEOUT_S = 20.0
# NOAA asks for an identifiable agent on their public endpoints.
_HEADERS = {"User-Agent": "Hail GPS/1.0 (+https://hailgps.com)"}

# How long an expired outlook sticks around. Nothing reads a stale forecast,
# but a couple of days of history makes "why did we alert?" answerable.
_RETENTION_DAYS = 3


def _parse_spc_time(raw: object) -> datetime | None:
    """SPC stamps are YYYYMMDDHHMM in UTC. Returns None on anything else."""
    s = str(raw or "").strip()
    if len(s) != 12 or not s.isdigit():
        return None
    # SPC occasionally writes hour 24 for "end of day"; Python won't take it.
    if s[8:] == "2400":
        try:
            base = datetime.strptime(s[:8], "%Y%m%d").replace(tzinfo=timezone.utc)
        except ValueError:
            return None
        return base + timedelta(days=1)
    try:
        return datetime.strptime(s, "%Y%m%d%H%M").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _probability(label: object, kind: str) -> float | None:
    """LABEL is the fraction as a string ("0.05"). None = unusable feature."""
    if kind == "sighail":
        return _SIGHAIL_PROBABILITY
    try:
        p = float(str(label).strip())
    except (TypeError, ValueError):
        return None
    return p if 0.0 < p <= 1.0 else None


def _polygon_rings(geometry: object) -> list[Any]:
    """Every polygon (as its ring list) inside a GeoJSON geometry.

    SPC mixes Polygon and MultiPolygon across issuances, and on a day with no
    significant-hail area at all the sighail feed ships an EMPTY
    GeometryCollection placeholder. The column is MULTIPOLYGON, so everything
    collapses to the same shape here and the placeholder yields nothing —
    which is the honest answer, not a bug.
    """
    if not isinstance(geometry, dict):
        return []
    gtype = geometry.get("type")
    if gtype == "GeometryCollection":
        members = geometry.get("geometries")
        if not isinstance(members, list):
            return []
        out: list[Any] = []
        for member in members:
            out.extend(_polygon_rings(member))
        return out
    coords = geometry.get("coordinates")
    if not isinstance(coords, list) or not coords:
        return []
    if gtype == "Polygon":
        return [coords]
    if gtype == "MultiPolygon":
        return [p for p in coords if isinstance(p, list) and p]
    return []


async def _fetch_feed(
    client: httpx.AsyncClient, url: str
) -> list[dict[str, Any]] | None:
    """GeoJSON features from one SPC product.

    `None` means the feed failed (dead host, bad status, unparseable body);
    `[]` means it answered and there's simply no hail risk on the board. The
    two are very different in the logs and must not be conflated.
    """
    try:
        resp = await client.get(url, headers=_HEADERS, timeout=_TIMEOUT_S)
        resp.raise_for_status()
        payload = resp.json()
    except Exception as exc:  # noqa: BLE001 — a dead NOAA host is not our bug
        log.warning("spc_outlook.fetch_failed url=%s err=%s", url, exc)
        return None
    features = payload.get("features") if isinstance(payload, dict) else None
    if not isinstance(features, list):
        log.warning("spc_outlook.fetch_shape_unexpected url=%s", url)
        return None
    return [f for f in features if isinstance(f, dict)]


def _slices_from_features(
    day: int, kind: str, features: list[dict[str, Any]], now: datetime | None = None
) -> list[dict[str, Any]]:
    """Collapse a feed's features into one row per (probability, valid_from).

    A single contour level is usually one MultiPolygon feature, but SPC has
    shipped it split across several — merging here keeps us off the unique
    constraint instead of letting the last feature win.

    Already-expired features are dropped: the sighail placeholder carries
    whatever window was current the last time there WAS a hatched area, which
    can be months old.
    """
    now = now or datetime.now(timezone.utc)
    merged: dict[tuple[float, datetime], dict[str, Any]] = {}
    for feature in features:
        props = feature.get("properties")
        if not isinstance(props, dict):
            continue
        prob = _probability(props.get("LABEL"), kind)
        valid_from = _parse_spc_time(props.get("VALID"))
        valid_to = _parse_spc_time(props.get("EXPIRE"))
        if prob is None or valid_from is None or valid_to is None:
            continue
        if valid_to <= valid_from or valid_to <= now:
            continue
        polygons = _polygon_rings(feature.get("geometry"))
        if not polygons:
            continue

        key = (prob, valid_from)
        row = merged.get(key)
        if row is None:
            row = {
                "id": (
                    f"spc-{kind}-d{day}-"
                    f"{int(round(prob * 100)):03d}-{valid_from:%Y%m%d%H%M}"
                ),
                "day": day,
                "kind": kind,
                "probability": prob,
                "label": str(props.get("LABEL2") or props.get("LABEL") or "")[:64]
                or None,
                "valid_from": valid_from,
                "valid_to": valid_to,
                "issued_at": _parse_spc_time(props.get("ISSUE")),
                "polygons": [],
            }
            merged[key] = row
        row["polygons"].extend(polygons)
        # Keep the widest window if a split contour disagrees.
        if valid_to > row["valid_to"]:
            row["valid_to"] = valid_to
    return list(merged.values())


# ST_MakeValid can hand back a collection (SPC contours self-touch at the
# CONUS border), so extract the polygonal part before forcing MULTIPOLYGON.
# The WHERE drops anything that validated down to nothing rather than
# persisting an empty geometry that would silently match no zone.
_UPSERT_SQL = text(
    """
    INSERT INTO hail_outlooks
        (id, day, kind, probability, label, valid_from, valid_to, issued_at, geom)
    SELECT :id, :day, :kind, :probability, :label,
           :valid_from, :valid_to, :issued_at, g.geom
      FROM (
        SELECT ST_Multi(ST_CollectionExtract(
                 ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(:geojson), 4326)), 3
               )) AS geom
      ) g
     WHERE NOT ST_IsEmpty(g.geom)
    ON CONFLICT ON CONSTRAINT uq_hail_outlook_slice DO UPDATE
       SET label = EXCLUDED.label,
           valid_to = EXCLUDED.valid_to,
           issued_at = EXCLUDED.issued_at,
           geom = EXCLUDED.geom
    RETURNING id
    """
)


async def ingest_spc_outlooks(session: AsyncSession) -> dict:
    """Fetch every SPC hail feed and upsert the contours. Never raises.

    Returns {feeds_ok, feeds_failed, slices, upserted, rejected, pruned}.
    A quiet day is `slices=0` — that's data, not a failure.
    """
    slices: list[dict[str, Any]] = []
    feeds_ok = 0
    feeds_failed = 0

    async with httpx.AsyncClient(follow_redirects=True) as client:
        for day, kind, url in _FEEDS:
            features = await _fetch_feed(client, url)
            if features is None:
                feeds_failed += 1
                continue
            feeds_ok += 1
            slices.extend(_slices_from_features(day, kind, features))

    upserted = 0
    rejected = 0
    for row in slices:
        geojson = json.dumps({"type": "MultiPolygon", "coordinates": row["polygons"]})
        params = {k: v for k, v in row.items() if k != "polygons"}
        params["geojson"] = geojson
        try:
            result = await session.execute(_UPSERT_SQL, params)
            if result.scalar() is not None:
                upserted += 1
            else:
                rejected += 1  # validated down to an empty geometry
            await session.commit()
        except Exception:  # pragma: no cover — one bad contour, not the batch
            await session.rollback()
            rejected += 1
            log.exception("spc_outlook.upsert_failed id=%s", row.get("id"))

    pruned = 0
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(days=_RETENTION_DAYS)
        result = await session.execute(
            text("DELETE FROM hail_outlooks WHERE valid_to < :cutoff"),
            {"cutoff": cutoff},
        )
        pruned = result.rowcount or 0
        await session.commit()
    except Exception:  # pragma: no cover
        await session.rollback()
        log.exception("spc_outlook.prune_failed")

    summary = {
        "feeds_ok": feeds_ok,
        "feeds_failed": feeds_failed,
        "slices": len(slices),
        "upserted": upserted,
        "rejected": rejected,
        "pruned": pruned,
    }
    log.info("spc_outlook.done %s", summary)
    return summary
