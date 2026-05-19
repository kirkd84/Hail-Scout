"""HailScout data pipeline CLI.

Subcommands:
    live      - Pull the latest MESH file from NOAA S3 and ingest
    backfill  - Walk a date range, pulling from Iowa State MtArchive
    once      - Ingest a specific GRIB2 file (debugging)
    loop      - Run `live` on an interval (for Railway worker mode)
    lsr       - Pull SPC daily hail Local Storm Reports (Phase 21)

Usage:
    python -m hailscout_pipeline live
    python -m hailscout_pipeline backfill --since 2025-05-04 --until 2026-05-03 --cadence 6h
    python -m hailscout_pipeline once /path/to/file.grib2
    python -m hailscout_pipeline loop --interval-seconds 300
    python -m hailscout_pipeline lsr --since 2026-05-17 --until 2026-05-18
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
from hailscout_pipeline.db.upsert import (
    upsert_cell,
    upsert_lsr_report,
    upsert_swaths,
)
from hailscout_pipeline.extraction.clustering import cluster_swaths_into_cells
from hailscout_pipeline.extraction.polygonize import extract_swaths_from_grid
from hailscout_pipeline.ingestion.grib_to_geotiff import parse_mesh_grib
from hailscout_pipeline.ingestion.mrms_client import (
    IowaArchiveClient,
    MRMSClient,
)
from hailscout_pipeline.ingestion.spc_lsr_client import SpcLsrClient


# ----- logging setup -----
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


# ----- core ingest cycle -----
def ingest_grib_file(grib_path: str, ts: datetime) -> dict:
    """Parse one GRIB2 file end-to-end and write to DB. Returns summary.

    Two-stage write:
      1. parse_mesh_grib → MeshGrid (raster in inches)
      2. extract_swaths_from_grid → per-category MultiPolygons (CONUS-wide)
      3. cluster_swaths_into_cells → list of per-cell HailSwath bundles
      4. upsert_cell per cell → one Storm row each, matched by (UTC date,
         source, centroid within STORM_MERGE_RADIUS_DEG)

    Summary aggregates across all cells created/updated this cycle.
    """
    grid = parse_mesh_grib(grib_path, ts)
    swaths = extract_swaths_from_grid(grid)
    if not swaths:
        log.info("no_swaths", ts=ts.isoformat())
        return {"storm_id": None, "swath_count": 0, "max_hail_size_in": 0.0,
                "cells": 0}

    cell_bundles = cluster_swaths_into_cells(swaths)
    if not cell_bundles:
        log.info("no_cells_after_clustering", ts=ts.isoformat(),
                 input_swaths=len(swaths))
        return {"storm_id": None, "swath_count": 0, "max_hail_size_in": 0.0,
                "cells": 0}

    total_swaths = 0
    max_in_overall = 0.0
    first_storm_id = None
    with SessionLocal() as session:
        for bundle in cell_bundles:
            # track=True is the Phase 17 behavior: across consecutive
            # 2-min snapshots, cells that match an existing Storm by
            # proximity get their swath geometry UNIONED with the
            # existing one rather than overwritten. Result: the same
            # cell drifting across timesteps produces a meandering
            # ribbon polygon — the HailTrace-style track shape.
            summary = upsert_cell(session, bundle, track=True)
            total_swaths += summary["swath_count"]
            max_in_overall = max(max_in_overall, summary["max_hail_size_in"])
            if first_storm_id is None:
                first_storm_id = summary["storm_id"]
    return {
        "storm_id": first_storm_id,
        "swath_count": total_swaths,
        "max_hail_size_in": max_in_overall,
        "cells": len(cell_bundles),
    }


# ----- subcommands -----
def cmd_live(_: argparse.Namespace) -> int:
    client = MRMSClient(bucket_name=settings.noaa_mrms_bucket)
    grib_path, key, ts = client.fetch_latest()
    try:
        summary = ingest_grib_file(grib_path, ts)
    finally:
        Path(grib_path).unlink(missing_ok=True)
    log.info("live_done", key=key, **summary)
    return 0


def cmd_once(args: argparse.Namespace) -> int:
    if args.timestamp:
        ts = datetime.fromisoformat(args.timestamp)
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
    else:
        ts = datetime.now(timezone.utc)
    # cmd_once is for debugging on a user-supplied path — never auto-unlink.
    summary = ingest_grib_file(args.path, ts)
    log.info("once_done", path=args.path, **summary)
    return 0


def cmd_backfill(args: argparse.Namespace) -> int:
    since = datetime.fromisoformat(args.since).replace(tzinfo=timezone.utc)
    until = datetime.fromisoformat(args.until).replace(tzinfo=timezone.utc)
    cadence = _parse_cadence(args.cadence)
    total_steps = max(1, int((until - since) / cadence) + 1)
    log.info("backfill_start", since=since.isoformat(), until=until.isoformat(),
             cadence_seconds=cadence.total_seconds(),
             expected_steps=total_steps)

    if args.reset:
        # Clean slate — required when re-running with different filters /
        # value-cap logic. Without this the upsert "widens" max_hail_size_in
        # so old noisy max values (e.g. 10.5") would survive.
        from sqlalchemy import text
        log.warning("backfill_reset_begin",
                    note="DELETING all rows from hail_swaths + storms")
        with SessionLocal() as session:
            session.execute(text("DELETE FROM hail_swaths"))
            session.execute(text("DELETE FROM storms"))
            session.commit()
        log.info("backfill_reset_done")

    iowa = IowaArchiveClient()
    cur = since
    n_ok, n_fail, n_empty = 0, 0, 0
    step_idx = 0
    started = time.monotonic()

    while cur <= until:
        step_idx += 1
        grib = None
        try:
            grib, url, ts = iowa.download(cur)
            summary = ingest_grib_file(grib, ts)
            if summary["swath_count"] == 0:
                n_empty += 1
            else:
                n_ok += 1
            log.info("backfill_step", step=step_idx, of=total_steps,
                     ts=ts.isoformat(), **summary)
        except Exception as e:
            n_fail += 1
            log.warning("backfill_step_failed", step=step_idx, of=total_steps,
                        ts=cur.isoformat(), error=str(e))
        finally:
            if grib:
                Path(grib).unlink(missing_ok=True)

        # Heartbeat every 50 steps so progress is visible in logs even if
        # nothing interesting happens for a stretch (winter, ocean-only
        # MESH grids, etc.).
        if step_idx % 50 == 0:
            elapsed = time.monotonic() - started
            rate = step_idx / elapsed if elapsed > 0 else 0
            remaining = (total_steps - step_idx) / rate if rate > 0 else None
            log.info("backfill_heartbeat",
                     step=step_idx, of=total_steps,
                     ok=n_ok, empty=n_empty, fail=n_fail,
                     elapsed_seconds=int(elapsed),
                     eta_seconds=int(remaining) if remaining else None)

        cur += cadence

    log.info("backfill_done", ok=n_ok, empty=n_empty, fail=n_fail,
             total=n_ok + n_empty + n_fail,
             elapsed_seconds=int(time.monotonic() - started))
    return 0


def cmd_loop(args: argparse.Namespace) -> int:
    """Run `live` forever on an interval (Railway worker mode)."""
    interval = args.interval_seconds
    log.info("loop_start", interval_seconds=interval)
    while True:
        try:
            cmd_live(args)
        except Exception as e:
            log.exception("loop_iteration_failed", error=str(e))
        log.info("loop_sleep", seconds=interval)
        time.sleep(interval)


def cmd_lsr(args: argparse.Namespace) -> int:
    """Pull SPC Local Storm Reports for a UTC date range and upsert.

    Each daily CSV ranges from ~10 reports (quiet day) to hundreds
    (major outbreak). Re-running the same range is idempotent — Storm
    ids are deterministic from (date, lat, lng, time)."""
    since = datetime.fromisoformat(args.since).replace(tzinfo=timezone.utc)
    if args.until:
        until = datetime.fromisoformat(args.until).replace(tzinfo=timezone.utc)
    else:
        # Default: just the --since day
        until = since
    log.info("lsr_start", since=since.isoformat(), until=until.isoformat())

    client = SpcLsrClient()
    n_ok, n_fail = 0, 0
    started = time.monotonic()

    with SessionLocal() as session:
        for report in client.fetch_range(since, until):
            try:
                upsert_lsr_report(session, report)
                n_ok += 1
            except Exception as e:
                n_fail += 1
                log.warning("lsr_upsert_failed",
                            id=report.synthetic_id,
                            location=report.location,
                            error=str(e))

    log.info("lsr_done", ok=n_ok, fail=n_fail,
             elapsed_seconds=int(time.monotonic() - started))
    return 0


def _parse_cadence(s: str) -> timedelta:
    """Parse '6h', '30m', '2h30m', '15m', '1d'."""
    s = s.strip().lower()
    n = len(s)
    i = 0
    seconds = 0
    while i < n:
        j = i
        while j < n and s[j].isdigit():
            j += 1
        if j == i:
            raise ValueError(f"Bad cadence: {s}")
        num = int(s[i:j])
        unit = s[j] if j < n else "s"
        mult = {"s": 1, "m": 60, "h": 3600, "d": 86400}.get(unit)
        if mult is None:
            raise ValueError(f"Bad cadence unit: {unit}")
        seconds += num * mult
        i = j + 1
    return timedelta(seconds=seconds)


def main() -> int:
    ap = argparse.ArgumentParser(prog="hailscout-pipeline")
    sub = ap.add_subparsers(dest="cmd", required=True)

    sp_live = sub.add_parser("live", help="Ingest the latest available MESH file")
    sp_live.set_defaults(func=cmd_live)

    sp_once = sub.add_parser("once", help="Ingest a specific GRIB2 file")
    sp_once.add_argument("path")
    sp_once.add_argument("--timestamp", help="ISO 8601, default=now")
    sp_once.set_defaults(func=cmd_once)

    sp_back = sub.add_parser("backfill", help="Walk a date range from Iowa State archive")
    sp_back.add_argument("--since", required=True, help="ISO date, e.g. 2025-05-04")
    sp_back.add_argument("--until", required=True, help="ISO date, e.g. 2026-05-03")
    sp_back.add_argument("--cadence", default="30m",
                         help="Step between samples, e.g. '30m', '1h', '6h'")
    sp_back.add_argument("--reset", action="store_true",
                         help="Truncate storms + hail_swaths before starting "
                              "(use when re-running with new filters)")
    sp_back.set_defaults(func=cmd_backfill)

    sp_loop = sub.add_parser("loop", help="Run `live` forever on an interval")
    sp_loop.add_argument("--interval-seconds", type=int, default=300)
    sp_loop.set_defaults(func=cmd_loop)

    sp_lsr = sub.add_parser(
        "lsr",
        help="Ingest SPC daily hail Local Storm Reports for a UTC date range",
    )
    sp_lsr.add_argument("--since", required=True,
                        help="ISO date (UTC), e.g. 2026-05-17")
    sp_lsr.add_argument("--until",
                        help="ISO date (UTC), default = --since")
    sp_lsr.set_defaults(func=cmd_lsr)

    args = ap.parse_args()
    return int(args.func(args))


if __name__ == "__main__":
    sys.exit(main())
