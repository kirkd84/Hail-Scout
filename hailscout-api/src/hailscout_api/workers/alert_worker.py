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


async def _one_pass() -> dict:
    """One generator pass across every org. Returns the per-org summary."""
    factory = db_session._async_session_factory  # noqa: SLF001
    if factory is None:
        # First-time init in this process. The web app initializes this
        # on FastAPI startup; the worker initializes it here so we can
        # share the same module-global without coupling to FastAPI.
        db_session.init_db(get_settings())
        factory = db_session._async_session_factory  # noqa: SLF001
        assert factory is not None
    async with factory() as session:
        return await generate_alerts_for_all_orgs(session)


def _flat_counts(per_org: dict) -> dict:
    """Flatten per-org dicts into a single rollup for log readability."""
    total = {
        "orgs": len(per_org),
        "orgs_with_new": 0,
        "created": 0,
        "slack_sent": 0,
        "email_sent": 0,
        "errors": 0,
    }
    for org_id, s in per_org.items():
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
        per_org = await _one_pass()
        rollup = _flat_counts(per_org)
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
            per_org = await _one_pass()
            rollup = _flat_counts(per_org)
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


def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s — %(message)s",
        stream=sys.stdout,
    )
    return asyncio.run(_main_async())


if __name__ == "__main__":
    sys.exit(main())
