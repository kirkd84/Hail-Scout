"""Pipeline configuration via env vars."""
from __future__ import annotations
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Database — set via DATABASE_URL on Railway
    database_url: str = "postgresql+psycopg2://hailscout:hailscout@localhost:5432/hailscout_dev"
    db_echo: bool = False

    # NOAA MRMS (anonymous public bucket — no creds needed)
    noaa_mrms_bucket: str = "noaa-mrms-pds"
    # Switched from MESH_Max_1440min_00.50 (24h rolling max) to MESH_00.50
    # (instantaneous, 2-min cadence). The rolling-max product produced one
    # daily snapshot per cell that can't be tracked across time; the
    # instantaneous product produces the per-volume-scan data that real
    # storm-cell tracking (Phase 17) needs.
    mrms_product: str = "MESH_00.50"

    # NEXRAD Level II — anonymous public mirror via Unidata.
    # The original NOAA bucket `noaa-nexrad-level2` revoked anonymous
    # LIST permission, so `boto3.UNSIGNED` calls bail with AccessDenied
    # the moment we try to enumerate volume scans. Unidata mirrors the
    # same Y/M/D/{Station}/ key layout under `unidata-nexrad-level2`
    # AND allows anonymous LIST.
    # Trade-off: Unidata keeps only the recent ~7 days, no deep history.
    # For real-time NEXRAD ingest that's fine; deep historical backfill
    # would need a different access path (NCEI HDSS, requester-pays
    # against the NOAA bucket, etc.) when we get there.
    noaa_nexrad_bucket: str = "unidata-nexrad-level2"

    # Logging
    log_level: str = "INFO"


settings = Settings()
