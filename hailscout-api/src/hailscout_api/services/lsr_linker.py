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

    # Make this run authoritative: clear prior confirmations in the
    # window first, then re-link with swath-containment. Otherwise a
    # stale bbox-only confirmation from the old logic would keep showing
    # a false "ground-truth confirmed" badge. Reset + re-link commit in
    # one transaction so there's no window of wiped confirmations.
    await session.execute(
        update(Storm)
        .where(and_(
            Storm.source != "SPC-LSR",
            Storm.start_time >= cutoff,
        ))
        .values(
            lsr_confirmed=False,
            lsr_observed_size_in=None,
            lsr_observed_at=None,
            radar_size_at_lsr_in=None,
        )
    )

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
        # Confirm ONLY when the report point falls inside an actual swath
        # band (not merely the storm's bounding box). This makes a
        # confirmation mean "radar showed hail at the reported location"
        # — precise enough to back a verification badge — and guarantees
        # radar_size_at_lsr_in is a real detected size, so the sizing
        # calibration isn't polluted by bbox-only near-misses.
        #
        # One indexed join: candidate = (storm, band) pairs in the time
        # window whose band polygon contains the LSR point. We keep the
        # largest band size at the point as the radar estimate, and tag
        # that band's storm.
        window_lo = lsr.start_time - _TIME_WINDOW
        window_hi = lsr.start_time + _TIME_WINDOW
        # Interval OVERLAP, not start-time proximity: tracked storms
        # accumulate for hours under one row whose start_time is the track
        # birth — an LSR filed 45+ min into a long-lived supercell must
        # still match while the storm is active.
        match_row = (
            await session.execute(
                select(Storm, HailSwath.hail_size_category)
                .join(HailSwath, HailSwath.storm_id == Storm.id)
                .where(and_(
                    Storm.source != "SPC-LSR",
                    Storm.start_time <= window_hi,
                    Storm.end_time >= window_lo,
                    ST_Contains(HailSwath.geom_multipolygon, lsr.centroid_geom),
                ))
                # Largest band at the point wins (handles overlapping cells
                # and multiple bands containing the point).
                .order_by(Storm.max_hail_size_in.desc())
            )
        ).first()
        if match_row is None:
            continue
        match, _cat = match_row

        # Best (largest) band size at the point across all bands of the
        # matched storm that contain it — the radar's size estimate HERE.
        point_bands = (
            await session.execute(
                select(HailSwath.hail_size_category)
                .where(and_(
                    HailSwath.storm_id == match.id,
                    ST_Contains(HailSwath.geom_multipolygon, lsr.centroid_geom),
                ))
            )
        ).scalars().all()
        radar_at_point = max(
            (_cat_to_inches(c) for c in point_bands), default=0.0
        )
        if radar_at_point <= 0.0:
            continue  # defensive: no real band at the point → not a confirm

        # Record the pair. If already confirmed by a different (larger)
        # report, keep that pairing so the calibration pair stays matched.
        new_size = lsr.max_hail_size_in
        if not (
            match.lsr_confirmed
            and match.lsr_observed_size_in is not None
            and match.lsr_observed_size_in >= new_size
        ):
            match.lsr_observed_size_in = new_size
            match.radar_size_at_lsr_in = radar_at_point
            match.lsr_observed_at = lsr.start_time
        match.lsr_confirmed = True
        confirmed += 1

    # Always commit — the reset above must persist even when nothing
    # re-confirms in this window.
    await session.commit()

    log.info("lsr_linker.done",
             extra={"scanned": scanned, "confirmed": confirmed,
                    "lookback_days": lookback_days})
    return {"lsrs_scanned": scanned, "cells_confirmed": confirmed}
