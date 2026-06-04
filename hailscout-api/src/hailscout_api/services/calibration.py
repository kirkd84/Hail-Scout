"""Accuracy calibration — radar estimate vs. ground-truth.

Phase 24. Every storm with `lsr_confirmed=True` is a paired
observation: our radar-derived `max_hail_size_in` (the estimate) next
to `lsr_observed_size_in` (what a human on the ground actually
reported). Across thousands of such pairs we can measure — not claim —
how accurate our size estimates are.

This does double duty:

  * Internal tuning — surfaces systematic bias (are we consistently
    over/under-estimating?) so we can correct the dBZ→size curve.
  * Marketing — produces a defensible headline stat ("our hail-size
    estimates land within 0.25″ of ground-truth reports N% of the
    time across M verified events"), which is exactly the kind of
    credibility claim HailStrike/HailRecon don't publish.

Pure SQL aggregation + a little Python; no external deps.
"""

from __future__ import annotations

import math
from typing import Any

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.core import get_logger
from hailscout_api.db.models.storm import Storm

logger = get_logger(__name__)


# Tolerance bands for the "hit rate" stat. The industry rule of thumb
# is that radar hail sizing is meaningful to about ±0.25-0.50″.
_BANDS = [0.25, 0.50, 0.75]


async def compute_calibration(
    session: AsyncSession,
    min_size_in: float = 0.0,
) -> dict[str, Any]:
    """Compare radar estimate vs. LSR ground-truth across confirmed pairs.

    Considers only non-LSR storms (radar-derived) that carry an
    `lsr_observed_size_in` (i.e. the linker matched a ground report).
    `min_size_in` lets callers restrict to claim-relevant sizes
    (e.g. ≥1.0″) since tiny-hail reports are noisier.

    Returns sample size, error metrics, tolerance-band hit rates, and a
    by-size-bucket breakdown.
    """
    # Two distinct questions, measured separately so neither distorts
    # the other:
    #   * SIZING accuracy — when radar shows hail at the report point, how
    #     close is the size? Computed on pairs with radar_size_at_lsr > 0.
    #   * DETECTION coverage — of confirmed reports, what share had radar
    #     hail at the exact point (vs the point sitting in the cell's
    #     bbox but outside the swath). radar_size_at_lsr == 0 = a miss.
    base = [
        Storm.source != "SPC-LSR",
        Storm.lsr_confirmed.is_(True),
        Storm.lsr_observed_size_in.isnot(None),
        Storm.radar_size_at_lsr_in.isnot(None),
    ]
    if min_size_in > 0:
        base.append(Storm.lsr_observed_size_in >= min_size_in)

    all_rows = (await session.execute(
        select(
            Storm.radar_size_at_lsr_in.label("est"),
            Storm.lsr_observed_size_in.label("truth"),
        ).where(and_(*base))
    )).all()

    confirmed_n = len(all_rows)
    rows = [r for r in all_rows if float(r.est) > 0.0]
    detection_rate = round(len(rows) / confirmed_n, 4) if confirmed_n else 0.0

    n = len(rows)
    if n == 0:
        return {
            "sample_size": 0,
            "confirmed_pairs": confirmed_n,
            "detection_rate": detection_rate,
            "note": ("No detected radar↔ground-truth size pairs yet. This "
                     "populates as the LSR linker matches reports to radar "
                     "cells over the backfill."),
        }

    # Error metrics. error = estimate - truth (positive = we over-estimated).
    errors = [float(r.est) - float(r.truth) for r in rows]
    abs_errors = [abs(e) for e in errors]
    mae = sum(abs_errors) / n
    bias = sum(errors) / n
    rmse = math.sqrt(sum(e * e for e in errors) / n)

    # Pearson correlation between estimate and truth.
    ests = [float(r.est) for r in rows]
    truths = [float(r.truth) for r in rows]
    corr = _pearson(ests, truths)

    # Tolerance-band hit rates.
    band_hit_rates = {
        f"within_{b:.2f}in".replace(".", "_"): round(
            sum(1 for e in abs_errors if e <= b) / n, 4
        )
        for b in _BANDS
    }

    # By-size buckets (ground-truth size), to expose where we're weak.
    buckets = _by_size_buckets(rows)

    out = {
        "sample_size": n,                    # detected size pairs
        "confirmed_pairs": confirmed_n,      # all confirmed (incl. misses)
        "detection_rate": detection_rate,    # share with radar hail at point
        "min_size_in": min_size_in,
        "mae_in": round(mae, 4),
        "bias_in": round(bias, 4),          # + = over-estimate, - = under
        "rmse_in": round(rmse, 4),
        "correlation": round(corr, 4) if corr is not None else None,
        **band_hit_rates,
        "by_size_bucket": buckets,
    }
    logger.info("Calibration computed", sample_size=n,
                mae_in=out["mae_in"], bias_in=out["bias_in"],
                detection_rate=detection_rate)
    return out


def _pearson(xs: list[float], ys: list[float]) -> float | None:
    n = len(xs)
    if n < 2:
        return None
    mx = sum(xs) / n
    my = sum(ys) / n
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    dx = math.sqrt(sum((x - mx) ** 2 for x in xs))
    dy = math.sqrt(sum((y - my) ** 2 for y in ys))
    if dx == 0 or dy == 0:
        return None
    return num / (dx * dy)


def _by_size_buckets(rows) -> list[dict[str, Any]]:
    """Group pairs by ground-truth size band; report per-band MAE/bias."""
    bands = [
        ("0.75-1.0", 0.75, 1.0),
        ("1.0-1.5", 1.0, 1.5),
        ("1.5-2.0", 1.5, 2.0),
        ("2.0-2.75", 2.0, 2.75),
        ("2.75+", 2.75, 99.0),
    ]
    out = []
    for label, lo, hi in bands:
        sub = [(float(r.est), float(r.truth)) for r in rows
               if lo <= float(r.truth) < hi]
        if not sub:
            continue
        errs = [e - t for e, t in sub]
        abs_errs = [abs(x) for x in errs]
        out.append({
            "band_in": label,
            "n": len(sub),
            "mae_in": round(sum(abs_errs) / len(sub), 3),
            "bias_in": round(sum(errs) / len(sub), 3),
        })
    return out


def marketing_headline(calib: dict[str, Any]) -> str | None:
    """Turn the calibration dict into one publishable sentence, or None
    if the sample is too small to be credible."""
    n = calib.get("sample_size", 0)
    if n < 100:
        return None
    within_quarter = calib.get("within_0_25in")
    if within_quarter is None:
        return None
    return (
        f"Across {n:,} hail events independently verified against "
        f"National Weather Service ground reports, HailScout's size "
        f"estimates fall within 0.25 inches of the reported size "
        f"{within_quarter * 100:.0f}% of the time."
    )
