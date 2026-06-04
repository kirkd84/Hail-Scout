"""LSR ↔ NEXRAD / MRMS storm confirmation pass.

Phase 23 bonus. The SPC Local Storm Reports pipeline (`source="SPC-LSR"`)
inserts ground-truth observations as their own Storm rows. Cross-
referencing those against radar-derived cells (MRMS / NEXRAD) is the
"is this real?" check — when an LSR centroid falls inside a radar
cell's bbox within ±30 min, we stamp the radar cell as
`lsr_confirmed=true`.

The link is one-way: LSR rows themselves stay untouched. Confirmed
radar cells get a `lsr_observed_size_in` (the human-reported size)
and `lsr_observed_at` (the report timestamp). UIs can then surface
"ground-truth confirmed" badges and prefer confirmed cells for
high-confidence alerts.

This is intentionally idempotent and append-only — re-running just
updates the same flags. A future cron worker calls
`link_recent_lsrs` on a cadence.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from geoalchemy2.functions import ST_Contains
from sqlalchemy import and_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.db.models.storm import HailSwath, Storm


def _cat_to_inches(label: str) -> float:
    try:
        return float(str(label).rstrip("+"))
    except (ValueError, AttributeError):
        return 0.0

log = logging.getLogger(__name__)


# A radar cell starting more than this far away from the LSR isn't
# the same event. The LSR `start_time` is the human-call-in time,
# which lags the actual hail-on-ground by 5-25 minutes typically;
# the radar cell starts at scan-time which leads it. ±30 min
# captures both directions comfortably.
_TIME_WINDOW = timedelta(minutes=30)


async def link_recent_lsrs(
    session: AsyncSession,
    lookback_days: int = 30,
) -> dict:
    """For every LSR in the last `lookback_days`, find a matching
    radar cell and stamp it as confirmed. Returns a summary dict.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=lookback_days)
    lsrs = (
        await session.execute(
            select(Storm)
            .where(and_(
                Storm.source == "SPC-LSR",
                Storm.start_time >= cutoff,
            ))
            .order_by(Storm.start_time.asc()),
        )
    ).scalars().all()

    confirmed = 0
    scanned = 0
    for lsr in lsrs:
        scanned += 1
        # Candidate radar cells whose bbox contains the LSR centroid
        # and whose start_time is within ±30 min. We use
        # ST_Contains(bbox_geom, centroid_geom) — both already in 4326,
        # both sides PostGIS-typed, so this is a single indexed lookup.
        window_lo = lsr.start_time - _TIME_WINDOW
        window_hi = lsr.start_time + _TIME_WINDOW
        candidate_stmt = (
            select(Storm)
            .where(and_(
                Storm.source != "SPC-LSR",
                Storm.start_time >= window_lo,
                Storm.start_time <= window_hi,
                ST_Contains(Storm.bbox_geom, lsr.centroid_geom),
            ))
            # Prefer the LARGEST-hail candidate. When KFWS and KTLX both
            # see the same supercell (Phase 20 merge can also leave two
            # nearby cells), tagging the biggest one gives the best
            # downstream signal for alerts and leaderboards.
            .order_by(Storm.max_hail_size_in.desc())
            .limit(1)
        )
        match = (await session.execute(candidate_stmt)).scalars().first()
        if match is None:
            continue

        # Radar size AT the LSR's location = the largest swath band of
        # the matched storm whose polygon actually contains the report
        # point (0 if the point is inside the bbox but outside every
        # band — i.e. radar showed no hail there). This is the
        # like-for-like value to calibrate against the report size,
        # NOT the storm's global peak.
        point_band = (
            await session.execute(
                select(HailSwath.hail_size_category)
                .where(and_(
                    HailSwath.storm_id == match.id,
                    ST_Contains(HailSwath.geom_multipolygon, lsr.centroid_geom),
                ))
            )
        ).scalars().all()
        radar_at_point = max(
            (_cat_to_inches(c) for c in point_band), default=0.0
        )

        # Record the pair. If already confirmed by a different LSR, keep
        # whichever observed size is larger and pair the radar-at-point
        # for THAT same report so the calibration pair stays matched.
        new_size = lsr.max_hail_size_in
        if (
            match.lsr_confirmed
            and match.lsr_observed_size_in is not None
            and match.lsr_observed_size_in >= new_size
        ):
            pass  # keep existing (larger) pairing
        else:
            match.lsr_observed_size_in = new_size
            match.radar_size_at_lsr_in = radar_at_point
            match.lsr_observed_at = lsr.start_time
        match.lsr_confirmed = True
        confirmed += 1

    if confirmed:
        await session.commit()

    log.info("lsr_linker.done",
             extra={"scanned": scanned, "confirmed": confirmed,
                    "lookback_days": lookback_days})
    return {"lsrs_scanned": scanned, "cells_confirmed": confirmed}
