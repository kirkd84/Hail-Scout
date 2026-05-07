"""HailScout data pipeline CLI.

Subcommands:
    live      - Pull the latest MESH file from NOAA S3 and ingest
    backfill  - Walk a date range, pulling from Iowa State MtArchive
    once      - Ingest a specific GRIB2 file (debugging)
    loop      - Run `live` on an interval (for Railway worker mode)

Usage:
    python -m hailscout_pipeline live
    python -m hailscout_pipeline backfill --since 2025-05-04 --until 2026-05-03 --cadence 6h
    python -m hailscout_pipeline once /path/to/file.grib2
    python -m hailscout_pipeline loop --interval-seconds 300
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
from hailscout_pipeline.db.upsert import upsert_swaths
from hailscout_pipeline.extraction.polygonize import extract_swaths_from_grid
from hailscout_pipeline.ingestion.grib_to_geotiff import parse_mesh_grib
from hailscout_pipeline.ingestion.mrms_client import (
    IowaArchiveClient,
    MRMSClient,
)


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
    """Parse one GRIB2 file end-to-end and write to DB. Returns summary."""
    grid = parse_mesh_grib(grib_path, ts)
    swaths = extract_swaths_from_grid(grid)
    if not swaths:
        log.info("no_swaths", ts=ts.isoformat())
        return {"storm_id": None, "swath_count": 0, "max_hail_size_in": 0.0}
    with SessionLocal() as session:
        return upsert_swaths(session, swaths)


# ----- subcommands -----
def cmd_live(_: argparse.Namespace) -> int:
    client = MRMSClient(bucket_name=settings.noaa_mrms_bucket)
    grib_path, key, ts = client.fetch_latest()
    summary = ingest_grib_file(grib_path, ts)
    log.info("live_done", key=key, **summary)
    Path(grib_path).unlink(missing_ok=True)
    return 0


def cmd_once(args: argparse.Namespace) -> int:
    ts = datetime.now(timezone.utc) if not args.timestamp else \
        datetime.fromisoformat(args.timestamp)
    summary = ingest_grib_file(args.path, ts)
    log.info("once_done", path=args.path, **summary)
    return 0


def cmd_backfill(args: argparse.Namespace) -> int:
    since = datetime.fromisoformat(args.since).replace(tzinfo=timezone.utc)
    until = datetime.fromisoformat(args.until).replace(tzinfo=timezone.utc)
    cadence = _parse_cadence(args.cadence)
    log.info("backfill_start", since=since.isoformat(), until=until.isoformat(),
             cadence_seconds=cadence.total_seconds())

    iowa = IowaArchiveClient()
    cur = since
    n_ok, n_fail, n_empty = 0, 0, 0

    while cur <= until:
        try:
            grib, url, ts = iowa.download(cur)
            summary = ingest_grib_file(grib, ts)
            Path(grib).unlink(missing_ok=True)
            if summary["swath_count"] == 0:
                n_empty += 1
            else:
                n_ok += 1
            log.info("backfill_step", ts=ts.isoformat(), **summary)
        except Exception as e:
            n_fail += 1
            log.warning("backfill_step_failed", ts=cur.isoformat(), error=str(e))
        cur += cadence

    log.info("backfill_done", ok=n_ok, empty=n_empty, fail=n_fail,
             total=n_ok + n_empty + n_fail)
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
    sp_back.add_argument("--cadence", default="6h",
                         help="Step between samples, e.g. '6h', '1d'")
    sp_back.set_defaults(func=cmd_backfill)

    sp_loop = sub.add_parser("loop", help="Run `live` forever on an interval")
    sp_loop.add_argument("--interval-seconds", type=int, default=300)
    sp_loop.set_defaults(func=cmd_loop)

    args = ap.parse_args()
    return int(args.func(args))


if __name__ == "__main__":
    sys.exit(main())
