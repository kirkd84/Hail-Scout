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
    mrms_product: str = "MESH_Max_1440min_00.50"

    # Logging
    log_level: str = "INFO"


settings = Settings()
