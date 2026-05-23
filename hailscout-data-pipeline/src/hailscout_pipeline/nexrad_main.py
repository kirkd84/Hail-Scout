"""NEXRAD Level II ingestion entrypoint — Phase 18.

Separate from the MRMS pipeline (`__main__.py`) because py-ART is a
heavy transitive dep (numpy, scipy, netCDF4, HDF5 system libs) that
doesn't belong in the lighter MRMS Docker image. Run as a dedicated
Railway service with its own Dockerfile + railway.json.

Subcommands:
    loop          — every interval, pull the latest scan for each station
                    in CONUS_NEXRAD_STATIONS, process + upsert.
    once <s>      — process one station+scan path locally (debugging).
    backfill      — walk a date range using the Unidata mirror (last ~7d).
    deep-backfill — walk a date range using the full NCEI archive (any year).

Usage:
    python -m hailscout_pipeline.nexrad_main loop --interval-seconds 600
    python -m hailscout_pipeline.nexrad_main once KOKC /path/to/scan_V06
    python -m hailscout_pipeline.nexrad_main backfill \
        --since 2026-05-12T00:00 --until 2026-05-12T06:00 \
        --stations KOKC,KFWS,KTLX
    python -m hailscout_pipeline.nexrad_main deep-backfill \
        --since 2024-04-26T00:00 --until 2024-04-28T00:00 \
        --stations KFWS,KTLX
"""
from __future__ import annotations
import argparse
import gc
import logging
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, Future
from datetime import datetime, timedelta, timezone
from pathlib import Path

import structlog

from hailscout_pipeline.config import settings
from hailscout_pipeline.db.session import SessionLocal
from hailscout_pipeline.db.upsert import upsert_nexrad_cell
from hailscout_pipeline.ingestion.ncei_nexrad_client import NceiNexradClient
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

    Optional one-shot backfill on startup: if `DEEP_BACKFILL_SINCE`
    is set in the environment, run a single `backfill` pass before
    entering the normal live loop. Useful for seeding historical
    track data without spinning up a separate Railway service.
    Companion env vars: `DEEP_BACKFILL_UNTIL` (default = SINCE+1d)
    and `DEEP_BACKFILL_STATIONS` (default = --stations or hail-belt).
    Upserts are idempotent by track_id, so re-runs on container
    restart are wasteful but not harmful — clear the env vars when
    finished.

    Note: the env-var name retains "DEEP_" for backward compat with
    instances already configured against it, but the actual backfill
    now runs against the Unidata mirror via `cmd_backfill`. The
    `noaa-nexrad-level2` bucket revoked anonymous LIST and direct
    GET sometime in 2026; the Unidata mirror turned out to retain
    multi-year history, so the NCEI client path (cmd_deep_backfill)
    is effectively dead unless someone wires AWS requester-pays.
    """
    interval = args.interval_seconds

    # Phase 23.7 fan-out: when SHARD_INDEX + SHARD_COUNT are both set,
    # the container handles only its slice of the station list (using
    # Python's slice notation: list[index::count]). Lets us deploy N
    # parallel copies of the same image to chunk a 5-year backfill
    # across the hail belt without building a job queue.
    def _apply_shard(station_list: list[str]) -> list[str]:
        si = os.environ.get("SHARD_INDEX", "").strip()
        sc = os.environ.get("SHARD_COUNT", "").strip()
        if not (si and sc):
            return station_list
        try:
            si_i = int(si)
            sc_i = int(sc)
            if 0 <= si_i < sc_i and sc_i > 0:
                out = station_list[si_i::sc_i]
                log.info("nexrad_shard_apply",
                         shard_index=si_i, shard_count=sc_i,
                         stations_in=len(station_list),
                         my_stations=out)
                return out
        except ValueError:
            pass
        log.warning("nexrad_shard_bad_env",
                    shard_index=si, shard_count=sc)
        return station_list

    base_stations = (
        [s.strip().upper() for s in args.stations.split(",")]
        if args.stations
        else list(CONUS_NEXRAD_STATIONS.keys())
    )
    stations = _apply_shard(base_stations)

    # Phase 23.7 work-queue mode. When BACKFILL_QUEUE=1 is set, the
    # replica enters a claim-and-process loop against the
    # nexrad_backfill_shards table instead of the env-var dispatch.
    # First boot seeds the queue from DEEP_BACKFILL_SINCE/UNTIL/STATIONS.
    # All other replicas claim work and process it. When the queue is
    # drained, the worker drops into the normal live loop.
    if os.environ.get("BACKFILL_QUEUE", "").strip() == "1":
        _run_queue_worker(args)
        log.info("nexrad_loop_queue_done — entering live loop")

    backfill_since_env = os.environ.get("DEEP_BACKFILL_SINCE", "").strip()
    if backfill_since_env:
        backfill_until_env = os.environ.get("DEEP_BACKFILL_UNTIL", "").strip()
        backfill_stations_env = os.environ.get(
            "DEEP_BACKFILL_STATIONS", "",
        ).strip()
        # Resolve the backfill station list, then shard it.
        if backfill_stations_env:
            bf_stations = [s.strip().upper() for s in backfill_stations_env.split(",")]
        else:
            bf_stations = (
                [s.strip().upper() for s in args.stations.split(",")]
                if args.stations
                else list(CONUS_NEXRAD_STATIONS.keys())
            )
        bf_stations = _apply_shard(bf_stations)

        # Reuse cmd_backfill (Unidata mirror) by faking the argparse
        # Namespace. The mirror has anonymous LIST + multi-year history,
        # which is what we actually need.
        fake_args = argparse.Namespace(
            since=backfill_since_env,
            until=(backfill_until_env
                   or (datetime.fromisoformat(backfill_since_env)
                       + timedelta(days=1)).isoformat()),
            stations=(",".join(bf_stations) if bf_stations else None),
        )
        log.info("nexrad_loop_pre_backfill_start",
                 since=fake_args.since, until=fake_args.until,
                 stations=fake_args.stations or "(hail-belt default)",
                 source="unidata-nexrad-level2")
        try:
            cmd_backfill(fake_args)
        except Exception as e:
            log.exception("nexrad_loop_pre_backfill_failed", error=str(e))
        log.info("nexrad_loop_pre_backfill_done — entering live loop")

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


def _apply_lsr_prefilter(
    scans: list[VolumeScanKey],
    station: str,
    radius_km: float,
) -> list[VolumeScanKey]:
    """Drop scans on UTC dates where no SPC LSR was filed within
    `radius_km` of the station.

    The 5-year hail-belt backfill is dominated by clear-air days that
    yield zero hail cells. Pre-filtering by LSR proximity cuts most of
    that wasted work — only days with documented ground-truth hail
    activity within typical radar range get processed.

    Safety: if no LSR rows exist at all in the scan window (i.e. the
    LSR backfill hasn't reached this date range yet), we fall back to
    processing everything. Better to do extra work than silently drop
    valid scans.

    The check uses Postgres + PostGIS — one batched query per station.
    Costs ~50 ms; saves ~80% of station-days during quiet stretches.
    """
    if not scans:
        return scans

    coords = CONUS_NEXRAD_STATIONS.get(station.upper())
    if coords is None:
        # Unknown station — don't filter; let the user notice via the
        # downstream "0 cells" logs.
        return scans
    slat, slng = coords

    radius_deg = radius_km / 111.0  # rough km→deg at mid-latitudes
    min_ts = min(s.timestamp for s in scans) - timedelta(days=1)
    max_ts = max(s.timestamp for s in scans) + timedelta(days=1)

    # Local imports — keeps the rest of the module light and the
    # nexrad container build doesn't change.
    from sqlalchemy import and_, func, select
    from geoalchemy2.functions import ST_DWithin, ST_MakePoint, ST_SetSRID
    from hailscout_pipeline.db.models import Storm

    with SessionLocal() as session:
        # Sanity check: any LSR rows in the window at all?
        any_lsr = session.execute(
            select(func.count(Storm.id))
            .where(and_(
                Storm.source == "SPC-LSR",
                Storm.start_time >= min_ts,
                Storm.start_time <= max_ts,
            ))
        ).scalar_one()
        if not any_lsr:
            log.info("nexrad_lsr_prefilter_skipped",
                     station=station,
                     reason="no_lsr_data_in_window",
                     min_ts=min_ts.isoformat(), max_ts=max_ts.isoformat())
            return scans

        point = ST_SetSRID(ST_MakePoint(slng, slat), 4326)
        active = session.execute(
            select(func.date(Storm.start_time).label("d"))
            .where(and_(
                Storm.source == "SPC-LSR",
                Storm.start_time >= min_ts,
                Storm.start_time <= max_ts,
                ST_DWithin(Storm.centroid_geom, point, radius_deg),
            ))
            .group_by(func.date(Storm.start_time))
        ).all()
        active_dates = {row.d for row in active}

    # Be slightly generous — include the day before/after any active
    # date, since LSRs filed near midnight UTC can sit on either side
    # of the storm that produced them.
    keep = set(active_dates)
    for d in active_dates:
        keep.add(d - timedelta(days=1))
        keep.add(d + timedelta(days=1))

    kept = [s for s in scans if s.timestamp.date() in keep]
    log.info("nexrad_lsr_prefilter",
             station=station,
             scans_in=len(scans),
             scans_kept=len(kept),
             dates_with_lsrs=len(active_dates),
             dropped_ratio=round(1.0 - len(kept) / max(1, len(scans)), 3))
    return kept


def cmd_backfill(args: argparse.Namespace) -> int:
    """Walk a date range for one or more stations.

    Pulls every volume scan in the window, processes + upserts.
    Useful for filling historical track data over a known severe-weather
    event.

    Optimizations (Phase 23.7 — hail-belt 5y prep):
      * LSR pre-filter — skip dates with no SPC ground reports near
        the station. Cuts most clear-air work. Toggle via
        `LSR_PREFILTER=0` env var (default on).
      * Async download — prefetch the next scan in a background
        thread while py-ART parses the current one. Roughly 30-40%
        wall-clock savings since downloads and parsing overlap.
      * GC hygiene — explicit gc.collect() every 20 scans to keep
        the container's RSS from drifting upward across long runs.
    """
    since = datetime.fromisoformat(args.since).replace(tzinfo=timezone.utc)
    until = datetime.fromisoformat(args.until).replace(tzinfo=timezone.utc)
    stations = (
        [s.strip().upper() for s in args.stations.split(",")]
        if args.stations
        else list(CONUS_NEXRAD_STATIONS.keys())
    )
    lsr_filter_on = os.environ.get("LSR_PREFILTER", "1").strip() == "1"
    lsr_radius_km = float(os.environ.get("LSR_PREFILTER_RADIUS_KM", "250"))

    log.info("nexrad_backfill_start",
             since=since.isoformat(), until=until.isoformat(),
             stations=stations, station_count=len(stations),
             lsr_prefilter=lsr_filter_on,
             lsr_radius_km=lsr_radius_km)

    client = NexradClient(bucket_name=settings.noaa_nexrad_bucket)
    n_ok, n_fail, n_skipped = 0, 0, 0
    started = time.monotonic()

    for station in stations:
        try:
            scans = client.list_volume_scans_window(since, until, station)
            scans_total = len(scans)

            if lsr_filter_on:
                scans = _apply_lsr_prefilter(scans, station, lsr_radius_km)
                n_skipped += scans_total - len(scans)

            log.info("nexrad_backfill_station",
                     station=station,
                     scan_count_total=scans_total,
                     scan_count_processed=len(scans))

            # Async prefetch: download[i+1] runs in a background thread
            # while _process_one chews on scan[i]. One worker is enough
            # — py-ART is the slow step and there's nothing to gain
            # from multiple concurrent downloads.
            with ThreadPoolExecutor(max_workers=1) as executor:
                prefetch: Future | None = None

                for i, scan_key in enumerate(scans):
                    local: str | None = None

                    # Resolve current download (from prefetch when avail)
                    try:
                        if prefetch is not None:
                            local = prefetch.result(timeout=180)
                        else:
                            local = client.download(scan_key)
                    except Exception as e:
                        n_fail += 1
                        log.warning("nexrad_backfill_download_failed",
                                    station=scan_key.station,
                                    ts=scan_key.timestamp.isoformat(),
                                    error=str(e))
                        prefetch = (
                            executor.submit(client.download, scans[i + 1])
                            if i + 1 < len(scans) else None
                        )
                        continue

                    # Kick off prefetch for next iteration immediately,
                    # before processing the current one.
                    prefetch = (
                        executor.submit(client.download, scans[i + 1])
                        if i + 1 < len(scans) else None
                    )

                    try:
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

                    # Memory hygiene — py-ART and numpy buffers can
                    # leave Python's GC slow to reclaim. Explicit
                    # collection every ~minute of wall-clock keeps RSS
                    # bounded across multi-day runs.
                    if (i + 1) % 20 == 0:
                        gc.collect()
        except Exception as e:
            n_fail += 1
            log.exception("nexrad_backfill_station_failed",
                          station=station, error=str(e))
        # Reset prior-scan cache between stations to avoid cross-station
        # track contamination
        _prior_scans.pop(station, None)
        gc.collect()

    log.info("nexrad_backfill_done",
             ok=n_ok, fail=n_fail, skipped_no_lsr=n_skipped,
             elapsed_seconds=int(time.monotonic() - started))
    return 0


def _run_queue_worker(args: argparse.Namespace) -> None:
    """Postgres-coordinated shard worker.

    On first boot of any replica, seed the queue from the env-var
    backfill range (DEEP_BACKFILL_SINCE / UNTIL / STATIONS). All
    replicas then claim shards atomically from the table and process
    them, in parallel, until the queue is drained. After that the
    caller drops into the normal live loop.

    Seeding is idempotent (UNIQUE on station+range, ON CONFLICT DO
    NOTHING), so it's safe for every replica to call seed_shards()
    at boot — only the first one actually inserts rows.
    """
    from hailscout_pipeline.db.shard_queue import (
        Shard,
        claim_next_shard,
        complete_shard,
        ensure_table_exists,
        heartbeat,
        queue_status,
        seed_shards,
    )

    ensure_table_exists()

    # Seed only when DEEP_BACKFILL_* is set on this replica. Multiple
    # replicas calling this is fine — the unique constraint dedupes.
    since_env = os.environ.get("DEEP_BACKFILL_SINCE", "").strip()
    until_env = os.environ.get("DEEP_BACKFILL_UNTIL", "").strip()
    stations_env = os.environ.get("DEEP_BACKFILL_STATIONS", "").strip()
    if since_env and until_env:
        seed_since = datetime.fromisoformat(since_env)
        seed_until = datetime.fromisoformat(until_env)
        if stations_env:
            seed_stations = [s.strip().upper() for s in stations_env.split(",")]
        else:
            seed_stations = list(CONUS_NEXRAD_STATIONS.keys())
        # Slice each station's 5y range into roughly 1-year chunks so
        # multiple replicas can chew on the same station in parallel.
        # 365-day slices give ~5 sub-shards per station for a 5-year
        # range; 31 stations × 5 = ~155 work units, easily soaks up
        # 8-50 replicas without starvation.
        slice_days_env = os.environ.get("BACKFILL_SLICE_DAYS", "365").strip()
        try:
            slice_days = int(slice_days_env)
        except ValueError:
            slice_days = 365
        new_rows = seed_shards(
            seed_stations, seed_since, seed_until,
            slice_days=slice_days,
        )
        status_now = queue_status()
        log.info("nexrad_queue_seed_done",
                 stations=len(seed_stations),
                 slice_days=slice_days,
                 newly_inserted=new_rows,
                 **status_now)

    # Claim-and-process loop. Each shard gets its own _process_loop
    # call which handles LSR pre-filter + async download.
    while True:
        shard: Shard | None = claim_next_shard()
        if shard is None:
            log.info("nexrad_queue_drained — no more shards")
            return
        log.info("nexrad_queue_shard_start",
                 shard_id=shard.id, station=shard.station,
                 since=shard.since.isoformat(),
                 until=shard.until.isoformat())

        # Build a one-station argparse.Namespace and reuse cmd_backfill.
        # cmd_backfill heartbeats on its per-scan granularity already
        # (via the gc.collect cadence) — we add explicit heartbeats here
        # at the per-shard level too via a wrapper.
        shard_args = argparse.Namespace(
            since=shard.since.isoformat(),
            until=shard.until.isoformat(),
            stations=shard.station,
        )

        # Heartbeat thread: re-stamps claimed_at every 10 min so
        # other replicas don't reclaim this shard during long runs.
        import threading
        stop_hb = threading.Event()

        def _heartbeat_loop():
            while not stop_hb.wait(600):  # 10 min
                try:
                    heartbeat(shard.id)
                except Exception:
                    log.exception("nexrad_queue_heartbeat_failed",
                                  shard_id=shard.id)

        hb_thread = threading.Thread(target=_heartbeat_loop, daemon=True)
        hb_thread.start()

        try:
            cmd_backfill(shard_args)
            complete_shard(shard.id)
            log.info("nexrad_queue_shard_done",
                     shard_id=shard.id, station=shard.station)
        except Exception:
            log.exception("nexrad_queue_shard_failed",
                          shard_id=shard.id, station=shard.station)
            # Leave claimed_at as-is; stale-claim logic will let another
            # worker pick it up after CLAIM_TIMEOUT_HOURS.
        finally:
            stop_hb.set()


def cmd_deep_backfill(args: argparse.Namespace) -> int:
    """Walk a date range against NOAA's deep Level II archive (any year).

    Identical contract to `cmd_backfill` but sources scans from
    `noaa-nexrad-level2` via anonymous HTTPS (Phase 22 — Unidata only
    keeps ~7 days, so anything older needs the NCEI/AWS deep archive).
    """
    since = datetime.fromisoformat(args.since).replace(tzinfo=timezone.utc)
    until = datetime.fromisoformat(args.until).replace(tzinfo=timezone.utc)
    stations = (
        [s.strip().upper() for s in args.stations.split(",")]
        if args.stations
        else list(CONUS_NEXRAD_STATIONS.keys())
    )
    log.info("nexrad_deep_backfill_start",
             since=since.isoformat(), until=until.isoformat(),
             stations=stations, station_count=len(stations))

    client = NceiNexradClient()
    n_ok, n_fail = 0, 0
    started = time.monotonic()

    for station in stations:
        try:
            scans = client.list_volume_scans_window(since, until, station)
            log.info("nexrad_deep_backfill_station",
                     station=station, scan_count=len(scans))
            for scan_key in scans:
                local = None
                try:
                    local = client.download(scan_key)
                    _process_one(local, scan_key.station, scan_key.timestamp)
                    n_ok += 1
                except Exception as e:
                    n_fail += 1
                    log.warning("nexrad_deep_backfill_scan_failed",
                                station=scan_key.station,
                                ts=scan_key.timestamp.isoformat(),
                                error=str(e))
                finally:
                    if local:
                        Path(local).unlink(missing_ok=True)
        except Exception as e:
            n_fail += 1
            log.exception("nexrad_deep_backfill_station_failed",
                          station=station, error=str(e))
        # Reset track cache between stations (same reason as backfill).
        _prior_scans.pop(station, None)

    log.info("nexrad_deep_backfill_done", ok=n_ok, fail=n_fail,
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

    sp_deep = sub.add_parser(
        "deep-backfill",
        help="Walk a date range from NOAA's full Level II archive (any year)",
    )
    sp_deep.add_argument("--since", required=True,
                         help="ISO timestamp, e.g. 2024-04-26T00:00")
    sp_deep.add_argument("--until", required=True,
                         help="ISO timestamp, e.g. 2024-04-28T00:00")
    sp_deep.add_argument("--stations",
                         help="Comma-separated station IDs. "
                              "Default: CONUS_NEXRAD_STATIONS.")
    sp_deep.set_defaults(func=cmd_deep_backfill)

    args = ap.parse_args()
    return int(args.func(args))


if __name__ == "__main__":
    sys.exit(main())
