"""Background alert-generator worker.

Phase 23. Runs `services.alert_generator.generate_alerts_for_all_orgs`
on a fixed interval so notifications fire even when no user is hitting
the /v1/alerts route. The web app's polling and SSE paths still work
on their own; this worker exists to close the gap for orgs that
configure email/Slack and then walk away.

Deploy as a sibling Railway service against the same Postgres + same
image (`hailscout-api/Dockerfile`). Start command:

    python -u -m hailscout_api.workers.alert_worker

Tunables (env):
    ALERT_WORKER_INTERVAL_S   — sleep between passes (default 120)
    ALERT_WORKER_RUN_ONCE     — "1" to run a single pass and exit
                                (useful for cron-style invocations)
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
import time
from datetime import datetime, timezone

from hailscout_api.config import get_settings
from hailscout_api.db import session as db_session
from hailscout_api.services.alert_generator import generate_alerts_for_all_orgs
from hailscout_api.services.lsr_linker import link_recent_lsrs
from hailscout_api.services.storm_screener import screen_recent_storms

log = logging.getLogger(__name__)


def _interval_seconds() -> int:
    raw = os.environ.get("ALERT_WORKER_INTERVAL_S", "120")
    try:
        n = int(raw)
        # Floor at 30s so we don't accidentally hammer the DB if someone
        # passes "0" or "1". Ceiling at 1h since longer intervals are
        # really a cron job, not a loop.
        return max(30, min(3600, n))
    except ValueError:
        return 120


def _run_once_mode() -> bool:
    return os.environ.get("ALERT_WORKER_RUN_ONCE", "").strip() == "1"


# Full-history sweep state. The backfill inserts storms with historical
# start_times (2021-2026), which fall OUTSIDE a short recency window — so a
# 2-day link/screen would never touch them and verification + calibration
# would stay empty. We therefore run a FULL-RANGE pass on a slow cadence
# (first tick immediate) so every backfilled cell gets ground-truth-linked
# and screened. `time.monotonic()` baseline 0 → runs on the first pass.
_last_full_sweep_at: float = 0.0


def _full_sweep_interval_s() -> int:
    raw = os.environ.get("LSR_FULL_SWEEP_INTERVAL_S", "10800")  # 3h default
    try:
        return max(0, int(raw))
    except ValueError:
        return 10800


def _full_sweep_days() -> int:
    raw = os.environ.get("LSR_FULL_SWEEP_DAYS", "2200")  # ~6y covers the 5y backfill
    try:
        return max(1, int(raw))
    except ValueError:
        return 2200


async def _one_pass() -> dict:
    """One worker tick. Runs against fresh sessions:

      1. Screen unscreened storms across the FULL history (cheap — the
         only_unscreened filter means only new/backfilled rows are
         touched), so historical backfill arrivals get tagged.
      2. Link recent SPC LSRs to nearby radar cells (live storms).
      3. Periodically (slow cadence, first tick immediate) run a
         FULL-RANGE LSR link so backfilled historical cells get
         ground-truth-confirmed — this is what lights up verification
         tiers + the accuracy calibration across all 5 years.
      4. Generate + fan out alerts for every org.

    Order matters: link before screen/alerts so a freshly-confirmed cell
    screens correctly and shows confirmed in any email that fires.
    """
    global _last_full_sweep_at

    factory = db_session._async_session_factory  # noqa: SLF001
    if factory is None:
        db_session.init_db(get_settings())
        factory = db_session._async_session_factory  # noqa: SLF001
        assert factory is not None

    screen_summary: dict = {}
    link_summary: dict = {}
    full_sweep_summary: dict = {}
    alert_summary: dict = {}

    # ── Periodic full-history sweep (the data light-up) ──
    interval = _full_sweep_interval_s()
    now = time.monotonic()
    due = interval > 0 and (now - _last_full_sweep_at) >= interval
    if due or _last_full_sweep_at == 0.0:
        days = _full_sweep_days()
        async with factory() as session:
            try:
                full_link = await link_recent_lsrs(session, lookback_days=days)
                full_screen = await screen_recent_storms(
                    session, lookback_days=days, only_unscreened=False,
                )
                full_sweep_summary = {
                    "lookback_days": days,
                    "lsr": full_link,
                    "screen": full_screen,
                }
                log.warning("alert_worker.full_sweep_done %s", full_sweep_summary)
            except Exception:
                log.exception("alert_worker.full_sweep_failed")
        _last_full_sweep_at = now

    # ── Per-tick incremental ──
    async with factory() as session:
        try:
            link_summary = await link_recent_lsrs(session, lookback_days=2)
        except Exception:
            log.exception("alert_worker.lsr_link_failed")

    async with factory() as session:
        try:
            screen_summary = await screen_recent_storms(
                session, lookback_days=_full_sweep_days(), only_unscreened=True,
            )
        except Exception:
            log.exception("alert_worker.screen_failed")

    async with factory() as session:
        alert_summary = await generate_alerts_for_all_orgs(session)

    return {
        "full_sweep": full_sweep_summary,
        "screen": screen_summary,
        "lsr_link": link_summary,
        "alerts_per_org": alert_summary,
    }


def _flat_counts(result: dict) -> dict:
    """Flatten the multi-job per-pass dict into a single rollup for
    log readability. Accepts the result of `_one_pass()`."""
    per_org = result.get("alerts_per_org", {}) or {}
    screen = result.get("screen", {}) or {}
    link = result.get("lsr_link", {}) or {}

    total = {
        "orgs": len(per_org),
        "orgs_with_new": 0,
        "created": 0,
        "slack_sent": 0,
        "email_sent": 0,
        "errors": 0,
        "screened": screen.get("scanned", 0),
        "newly_suspect": screen.get("flagged_suspect", 0),
        "lsr_confirmed_cells": link.get("cells_confirmed", 0),
    }
    for _org_id, s in per_org.items():
        if "error" in s:
            total["errors"] += 1
            continue
        created = s.get("created", 0)
        if created:
            total["orgs_with_new"] += 1
        total["created"] += created
        total["slack_sent"] += s.get("slack_sent", 0)
        total["email_sent"] += s.get("email_sent", 0)
    return total


async def _main_async() -> int:
    interval = _interval_seconds()
    run_once = _run_once_mode()
    log.warning(
        "alert_worker.start interval_s=%s run_once=%s",
        interval, run_once,
    )

    if run_once:
        started = time.monotonic()
        pass_result = await _one_pass()
        rollup = _flat_counts(pass_result)
        log.warning(
            "alert_worker.run_once_done elapsed_s=%.1f %s",
            time.monotonic() - started, rollup,
        )
        return 0

    # Infinite loop. We don't trap KeyboardInterrupt — letting Railway's
    # process supervisor restart on intentional shutdown is fine.
    while True:
        started = time.monotonic()
        try:
            pass_result = await _one_pass()
            rollup = _flat_counts(pass_result)
            log.warning(
                "alert_worker.pass_done elapsed_s=%.1f %s",
                time.monotonic() - started, rollup,
            )
        except Exception:  # pragma: no cover
            log.exception("alert_worker.pass_failed")

        # Sleep the remainder of the interval — if the pass itself took
        # longer than the interval, log a warning and proceed immediately
        # so we don't queue up unbounded delay.
        elapsed = time.monotonic() - started
        rest = interval - elapsed
        if rest < 0:
            log.warning(
                "alert_worker.over_interval elapsed_s=%.1f interval_s=%s",
                elapsed, interval,
            )
            rest = 0
        await asyncio.sleep(rest)


async def run_worker_loop() -> None:
    """In-process worker loop, callable from an already-running event loop
    (i.e. the FastAPI app). Lets the API host the alert/screen/link/sweep
    work without a separate Railway service — gated by RUN_ALERT_WORKER_INPROC.

    Identical pass to the standalone worker, but never exits and swallows
    its own errors so a bad pass can't take the API down.
    """
    interval = _interval_seconds()
    log.warning("alert_worker.inproc_start interval_s=%s", interval)
    while True:
        started = time.monotonic()
        try:
            pass_result = await _one_pass()
            log.warning(
                "alert_worker.inproc_pass_done elapsed_s=%.1f %s",
                time.monotonic() - started, _flat_counts(pass_result),
            )
        except Exception:  # pragma: no cover
            log.exception("alert_worker.inproc_pass_failed")
        elapsed = time.monotonic() - started
        await asyncio.sleep(max(1.0, interval - elapsed))


def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s — %(message)s",
        stream=sys.stdout,
    )
    return asyncio.run(_main_async())


if __name__ == "__main__":
    sys.exit(main())
