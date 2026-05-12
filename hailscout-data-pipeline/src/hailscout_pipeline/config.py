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

    # NEXRAD Level II (anonymous public bucket — Phase 18).
    # Used for SCIT-style storm-cell identification at sub-km radial
    # resolution per radar station. Stitched with MRMS for CONUS coverage.
    noaa_nexrad_bucket: str = "noaa-nexrad-level2"

    # Logging
    log_level: str = "INFO"

    # Logging
    log_level: str = "INFO"


settings = Settings()
