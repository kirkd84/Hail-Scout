"""NEXRAD Level II ingestion entrypoint — Phase 18.

Separate from the MRMS pipeline (`__main__.py`) because py-ART is a
heavy transitive dep (numpy, scipy, netCDF4, HDF5 system libs) that
doesn't belong in the lighter MRMS Docker image. Run as a dedicated
Railway service with its own Dockerfile + railway.json.

Subcommands:
    loop      — every interval, pull the latest scan for each station
                in CONUS_NEXRAD_STATIONS, process + upsert.
    once <s>  — process one station+scan path locally (debugging).
    backfill  — walk a date range across all configured stations.

Usage:
    python -m hailscout_pipeline.nexrad_main loop --interval-seconds 600
    python -m hailscout_pipeline.nexrad_main once KOKC /path/to/scan_V06
    python -m hailscout_pipeline.nexrad_main backfill \
        --since 2026-05-12T00:00 --until 2026-05-12T06:00 \
        --stations KOKC,KFWS,KTLX
"""
from __future__ import annotations
import argparse
import logging
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import structlog

from hailscout_pipeline.config import settings
from hailscout_pipeline.db.session import SessionLocal
from hailscout_pipeline.db.upsert import upsert_nexrad_cell
from hailscout_pipeline.ingestion.nexrad_client import (
    CONUS_NEXRAD_STATIONS,
    NexradClient,
    VolumeScanKey,
)


# ── Logging setup ───────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(message)s",
    stream=sys.stdout,
)
structlog.configure(
    processors=[
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.JSONRenderer(),
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)
log = structlog.get_logger()


# ── Core: process one volume scan, track, upsert ────────────────────
# Module-level prior-scan cache, keyed by station. Letting tracking
# inherit track_ids across loop iterations gives us the "same cell
# across consecutive volume scans" continuity that produces the
# meandering track polygon in the DB.
_prior_scans: dict[str, "TrackedScan"] = {}  # type: ignore[name-defined]


def _process_one(local_path: str, station: str, ts: datetime) -> dict:
    """Parse one volume scan, track its cells, upsert into the DB.

    Imports nexrad_scit lazily so this module loads even on the MRMS
    image (where py-ART isn't installed).
    """
    from hailscout_pipeline.extraction.nexrad_scit import (
        TrackedScan,
        process_volume_scan,
        track_cells_across_scans,
    )

    scan: "TrackedScan" = process_volume_scan(local_path, station, ts)

    prior = _prior_scans.get(station)
    if prior is not None:
        scan = track_cells_across_scans(prior, scan)
    else:
        # Bootstrap fresh track_ids
        from hailscout_pipeline.extraction.nexrad_scit import (
            track_cells_across_scans as _t,
        )
        scan = _t(TrackedScan(station=station, timestamp=ts), scan)

    _prior_scans[station] = scan

    summary: dict = {
        "station": station,
        "ts": ts.isoformat(),
        "cells": len(scan.cells),
    }
    if not scan.cells:
        log.info("nexrad_no_cells", **summary)
        return summary

    with SessionLocal() as session:
        for cell in scan.cells:
            upsert_nexrad_cell(session, cell)

    summary["peak_dbz"] = max(c.peak_dbz for c in scan.cells)
    summary["peak_hail_in"] = max(c.estimated_hail_size_in for c in scan.cells)
    log.info("nexrad_ingested", **summary)
    return summary


# ── Subcommands ─────────────────────────────────────────────────────
def cmd_once(args: argparse.Namespace) -> int:
    """Process one specific volume scan from a local path."""
    ts = (datetime.fromisoformat(args.timestamp)
          if args.timestamp else datetime.now(timezone.utc))
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    _process_one(args.path, args.station, ts)
    return 0


def cmd_loop(args: argparse.Namespace) -> int:
    """Every interval, pull the latest scan for each configured station.

    Stations come from the --stations arg (comma-separated) or from
    CONUS_NEXRAD_STATIONS (hail-belt subset, ~33 sites).
    """
    interval = args.interval_seconds
    stations = (
        [s.strip().upper() for s in args.stations.split(",")]
        if args.stations
        else list(CONUS_NEXRAD_STATIONS.keys())
    )
    log.info("nexrad_loop_start", interval_seconds=interval,
             stations=stations, station_count=len(stations))

    client = NexradClient(bucket_name=settings.noaa_nexrad_bucket)

    while True:
        cycle_started = time.monotonic()
        cycle_summary = {"stations_processed": 0, "cells_total": 0, "errors": 0}
        for station in stations:
            try:
                # Latest scan = today's most recent non-MDM volume.
                # Scans are typically 4-10 min apart so we pull the
                # newest one each loop cycle (interval >= 10 min).
                now = datetime.now(timezone.utc)
                scans = client.list_volume_scans(now, station)
                if not scans:
                    # Try yesterday in case we're early in the UTC day
                    scans = client.list_volume_scans(
                        now - timedelta(days=1), station
                    )
                scans = [s for s in scans if not s.is_mdm]
                if not scans:
                    log.warning("nexrad_no_scans", station=station)
                    continue
                latest = scans[-1]
                local = client.download(latest)
                try:
                    summary = _process_one(local, latest.station, latest.timestamp)
                    cycle_summary["stations_processed"] += 1
                    cycle_summary["cells_total"] += summary.get("cells", 0)
                finally:
                    Path(local).unlink(missing_ok=True)
            except Exception as e:
                cycle_summary["errors"] += 1
                log.exception("nexrad_station_failed", station=station,
                              error=str(e))

        elapsed = time.monotonic() - cycle_started
        log.info("nexrad_loop_cycle", elapsed_seconds=int(elapsed),
                 **cycle_summary)
        sleep_remaining = max(1, interval - int(elapsed))
        log.info("nexrad_loop_sleep", seconds=sleep_remaining)
        time.sleep(sleep_remaining)


def cmd_backfill(args: argparse.Namespace) -> int:
    """Walk a date range for one or more stations.

    Pulls every volume scan in the window, processes + upserts.
    Useful for filling historical track data over a known severe-weather
    event.
    """
    since = datetime.fromisoformat(args.since).replace(tzinfo=timezone.utc)
    until = datetime.fromisoformat(args.until).replace(tzinfo=timezone.utc)
    stations = (
        [s.strip().upper() for s in args.stations.split(",")]
        if args.stations
        else list(CONUS_NEXRAD_STATIONS.keys())
    )
    log.info("nexrad_backfill_start",
             since=since.isoformat(), until=until.isoformat(),
             stations=stations, station_count=len(stations))

    client = NexradClient(bucket_name=settings.noaa_nexrad_bucket)
    n_ok, n_fail = 0, 0
    started = time.monotonic()

    for station in stations:
        try:
            scans = client.list_volume_scans_window(since, until, station)
            log.info("nexrad_backfill_station",
                     station=station, scan_count=len(scans))
            for scan_key in scans:
                local = None
                try:
                    local = client.download(scan_key)
                    _process_one(local, scan_key.station, scan_key.timestamp)
                    n_ok += 1
                except Exception as e:
                    n_fail += 1
                    log.warning("nexrad_backfill_scan_failed",
                                station=scan_key.station,
                                ts=scan_key.timestamp.isoformat(),
                                error=str(e))
                finally:
                    if local:
                        Path(local).unlink(missing_ok=True)
        except Exception as e:
            n_fail += 1
            log.exception("nexrad_backfill_station_failed",
                          station=station, error=str(e))
        # Reset prior-scan cache between stations to avoid cross-station
        # track contamination
        _prior_scans.pop(station, None)

    log.info("nexrad_backfill_done", ok=n_ok, fail=n_fail,
             elapsed_seconds=int(time.monotonic() - started))
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(prog="hailscout-pipeline.nexrad")
    sub = ap.add_subparsers(dest="cmd", required=True)

    sp_once = sub.add_parser("once", help="Process one volume scan file")
    sp_once.add_argument("station")
    sp_once.add_argument("path")
    sp_once.add_argument("--timestamp", help="ISO 8601, default=now")
    sp_once.set_defaults(func=cmd_once)

    sp_loop = sub.add_parser(
        "loop", help="Continuously pull the latest scan for each station",
    )
    sp_loop.add_argument("--interval-seconds", type=int, default=600,
                         help="Cycle interval (default 600 = 10 min)")
    sp_loop.add_argument("--stations",
                         help="Comma-separated station IDs (e.g. KOKC,KFWS). "
                              "Default: CONUS_NEXRAD_STATIONS (hail-belt subset).")
    sp_loop.set_defaults(func=cmd_loop)

    sp_back = sub.add_parser("backfill", help="Walk a date range across stations")
    sp_back.add_argument("--since", required=True,
                         help="ISO timestamp, e.g. 2026-05-12T00:00")
    sp_back.add_argument("--until", required=True,
                         help="ISO timestamp, e.g. 2026-05-12T06:00")
    sp_back.add_argument("--stations",
                         help="Comma-separated station IDs. "
                              "Default: CONUS_NEXRAD_STATIONS.")
    sp_back.set_defaults(func=cmd_backfill)

    args = ap.parse_args()
    return int(args.func(args))


if __name__ == "__main__":
    sys.exit(main())
