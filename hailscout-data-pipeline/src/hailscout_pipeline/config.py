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
    # MESH product selection — third iteration, each fixing the last:
    #   MESH_Max_1440min (24h max): one untrackable daily blob per cell.
    #   MESH_00.50 (instantaneous): trackable, but a 2-min snapshot only
    #     covers the storm's footprint AT that instant — sampled every ~5
    #     min by the live loop, a moving storm unions into disconnected
    #     beads ("a series of circles"), nothing like the real track.
    #   MESH_Max_30min (current): publishes every ~2 min like the
    #     instantaneous product (cell tracking still works), but each file
    #     paints everywhere hail fell in the last 30 min — consecutive
    #     pulls overlap heavily, so the union is the TRUE continuous storm
    #     ribbon, the swath IHM/HailStrike render.
    # NOTE: mtarchive (Iowa) mirrors only MESH + MESH_Max_1440min, so deep
    # backfills fall back to the instantaneous product (see cmd_backfill).
    mrms_product: str = "MESH_Max_30min_00.50"

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
