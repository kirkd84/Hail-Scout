"""Postgres-backed work queue for NEXRAD backfill shards.

Phase 23.7 — fan-out coordination. Service replicas claim work units
from a shared table; this lets us scale `railway service scale
<N>` and have N containers self-coordinate without manual SHARD_INDEX
env vars per container.

Design:
  * `nexrad_backfill_shards` table — one row per (station, year-slice)
  * Workers atomically claim a row with `SELECT … FOR UPDATE SKIP
    LOCKED`, stamp `claimed_at` + `claimed_by` (their RAILWAY_REPLICA_ID),
    process it, then mark `completed_at`.
  * Stale claims (older than CLAIM_TIMEOUT_HOURS with no `completed_at`)
    are reclaimable — a worker that crashes mid-shard releases its claim
    automatically after the timeout.
  * Idempotent: re-running the seed inserts only the missing rows;
    re-processing a completed shard is harmless thanks to upsert
    semantics downstream.

The table is auto-created on first call to `ensure_table_exists`. We
don't run it through Alembic because the pipeline service doesn't have
alembic configured — it just talks raw SQL to the DB.
"""

from __future__ import annotations

import logging
import os
import socket
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Iterable

from sqlalchemy import text

from hailscout_pipeline.db.session import SessionLocal

log = logging.getLogger(__name__)


# A claim is "stale" if older than this and not completed. Workers
# can poach it on the assumption the holder crashed.
CLAIM_TIMEOUT_HOURS = 2

# Heartbeat cadence: workers re-stamp claimed_at this often during a
# long shard so other workers don't poach it.
HEARTBEAT_INTERVAL_SECONDS = 600


@dataclass
class Shard:
    """One claimable unit of work."""
    id: int
    station: str
    since: datetime
    until: datetime


def _worker_id() -> str:
    """Stable identifier for this worker process.

    Prefer `RAILWAY_REPLICA_ID` (set per replica). Fall back to the
    container hostname so local dev still gets a unique id."""
    rid = os.environ.get("RAILWAY_REPLICA_ID", "").strip()
    if rid:
        return f"replica:{rid[:16]}"
    return f"host:{socket.gethostname()}"


def ensure_table_exists() -> None:
    """Create the shards table if it doesn't exist. Idempotent.

    Kept as raw DDL because pipeline doesn't link the alembic env from
    hailscout-api; running it via the SQLAlchemy session is simpler
    than coordinating cross-service migrations.
    """
    ddl = """
    CREATE TABLE IF NOT EXISTS nexrad_backfill_shards (
        id            BIGSERIAL PRIMARY KEY,
        station       VARCHAR(10) NOT NULL,
        since_ts      TIMESTAMPTZ NOT NULL,
        until_ts      TIMESTAMPTZ NOT NULL,
        claimed_at    TIMESTAMPTZ,
        claimed_by    VARCHAR(255),
        completed_at  TIMESTAMPTZ,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_nexrad_shard UNIQUE (station, since_ts, until_ts)
    );
    CREATE INDEX IF NOT EXISTS ix_nexrad_shards_unclaimed
        ON nexrad_backfill_shards (id)
        WHERE completed_at IS NULL;
    """
    with SessionLocal() as session:
        for stmt in ddl.strip().split(";"):
            s = stmt.strip()
            if not s:
                continue
            session.execute(text(s))
        session.commit()


def seed_shards(
    stations: Iterable[str],
    since: datetime,
    until: datetime,
    slice_days: int | None = None,
) -> int:
    """Insert (station, since, until) rows for every requested unit
    of work. If `slice_days` is set, each station's date range is
    chopped into ~slice_days chunks so multiple workers can attack
    one station in parallel. Otherwise each station is one shard.

    Returns the count of newly-inserted rows (UPSERTed on the uniq
    constraint, so re-runs are no-ops).
    """
    ensure_table_exists()
    rows: list[dict] = []

    if since.tzinfo is None:
        since = since.replace(tzinfo=timezone.utc)
    if until.tzinfo is None:
        until = until.replace(tzinfo=timezone.utc)

    for station in stations:
        if slice_days and slice_days > 0:
            cur = since
            step = timedelta(days=slice_days)
            while cur < until:
                hi = min(cur + step, until)
                rows.append({
                    "station": station.upper(),
                    "since_ts": cur,
                    "until_ts": hi,
                })
                cur = hi
        else:
            rows.append({
                "station": station.upper(),
                "since_ts": since,
                "until_ts": until,
            })

    if not rows:
        return 0

    stmt = text("""
        INSERT INTO nexrad_backfill_shards (station, since_ts, until_ts)
        VALUES (:station, :since_ts, :until_ts)
        ON CONFLICT (station, since_ts, until_ts) DO NOTHING
    """)
    inserted = 0
    with SessionLocal() as session:
        for r in rows:
            res = session.execute(stmt, r)
            # rowcount > 0 means a row was inserted (not skipped by ON CONFLICT)
            if res.rowcount and res.rowcount > 0:
                inserted += 1
        session.commit()
    log.info("shard_queue.seed", extra={
        "requested": len(rows), "inserted_new": inserted,
    })
    return inserted


def claim_next_shard() -> Shard | None:
    """Atomically claim the next unclaimed (or stale) shard.

    Uses `SELECT … FOR UPDATE SKIP LOCKED` so concurrent workers
    never grab the same row. Returns None when the queue is drained.
    """
    worker = _worker_id()
    stale_cutoff_sql = (
        f"now() - interval '{CLAIM_TIMEOUT_HOURS} hours'"
    )
    select_sql = text(f"""
        SELECT id, station, since_ts, until_ts
          FROM nexrad_backfill_shards
         WHERE completed_at IS NULL
           AND (claimed_at IS NULL OR claimed_at < {stale_cutoff_sql})
         ORDER BY id
         LIMIT 1
         FOR UPDATE SKIP LOCKED
    """)
    update_sql = text("""
        UPDATE nexrad_backfill_shards
           SET claimed_at = now(), claimed_by = :worker
         WHERE id = :id
    """)

    with SessionLocal() as session:
        row = session.execute(select_sql).first()
        if row is None:
            session.commit()
            return None
        session.execute(update_sql, {"worker": worker, "id": row.id})
        session.commit()
        log.info("shard_queue.claimed", extra={
            "shard_id": row.id, "station": row.station,
            "since": row.since_ts.isoformat(),
            "until": row.until_ts.isoformat(),
            "worker": worker,
        })
        return Shard(
            id=row.id,
            station=row.station,
            since=row.since_ts,
            until=row.until_ts,
        )


def heartbeat(shard_id: int) -> None:
    """Re-stamp `claimed_at` so other workers don't poach this shard
    mid-run. Call periodically during long-running shard processing."""
    worker = _worker_id()
    with SessionLocal() as session:
        session.execute(text("""
            UPDATE nexrad_backfill_shards
               SET claimed_at = now()
             WHERE id = :id AND claimed_by = :worker
               AND completed_at IS NULL
        """), {"id": shard_id, "worker": worker})
        session.commit()


def complete_shard(shard_id: int) -> None:
    worker = _worker_id()
    with SessionLocal() as session:
        session.execute(text("""
            UPDATE nexrad_backfill_shards
               SET completed_at = now()
             WHERE id = :id
        """), {"id": shard_id})
        session.commit()
    log.info("shard_queue.completed", extra={
        "shard_id": shard_id, "worker": worker,
    })


def queue_status() -> dict:
    """Quick rollup for ops visibility — how much of the queue is
    done? Returns counts of total / completed / claimed / unclaimed."""
    with SessionLocal() as session:
        row = session.execute(text("""
            SELECT
                count(*) AS total,
                count(*) FILTER (WHERE completed_at IS NOT NULL) AS completed,
                count(*) FILTER (
                    WHERE completed_at IS NULL
                      AND claimed_at IS NOT NULL
                      AND claimed_at >= now() - interval :timeout
                ) AS in_progress,
                count(*) FILTER (
                    WHERE completed_at IS NULL
                      AND (claimed_at IS NULL OR claimed_at < now() - interval :timeout)
                ) AS unclaimed
              FROM nexrad_backfill_shards
        """), {"timeout": f"{CLAIM_TIMEOUT_HOURS} hours"}).first()
    return {
        "total": int(row.total or 0),
        "completed": int(row.completed or 0),
        "in_progress": int(row.in_progress or 0),
        "unclaimed": int(row.unclaimed or 0),
    }
