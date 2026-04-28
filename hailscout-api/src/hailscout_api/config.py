"""Pydantic settings for HailScout API.

Pydantic v2 / pydantic-settings v2 syntax: env-var name comes from the field
name (case-insensitive) by default, NOT from a deprecated `env="..."` kwarg
on Field. Configure via ``model_config`` instead.
"""

from __future__ import annotations

from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables.

    Field name maps to the env var of the same name (uppercased).
    e.g. ``database_url`` reads ``DATABASE_URL``.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="ignore",
    )

    # Core
    env: Literal["development", "staging", "production"] = "development"
    debug: bool = False
    port: int = 8000
    log_level: str = "INFO"

    # Database
    database_url: str = (
        "postgresql+asyncpg://hailscout:hailscout@localhost:5432/hailscout"
    )
    database_pool_size: int = 20
    database_pool_recycle: int = 3600

    # Clerk Authentication
    clerk_secret_key: str = ""
    clerk_jwks_endpoint: str = (
        "https://your-instance.clerk.accounts.com/.well-known/jwks.json"
    )

    # Geocoding
    geocoder_provider: Literal["nominatim", "mapbox"] = "nominatim"
    nominatim_user_agent: str = "HailScout/0.1.0 (+https://hailscout.com)"
    mapbox_api_key: str = ""

    # Monitoring
    sentry_dsn: str | None = None
    sentry_environment: str = "development"

    # AWS / object storage (used by future S3/R2 integrations)
    aws_region: str = "us-east-1"
    aws_access_key_id: str | None = None
    aws_secret_access_key: str | None = None

    # CORS — list of allowed origins. Accepts CSV in the env var, e.g.
    # CORS_ORIGINS="http://localhost:3000,https://app.hailscout.com"
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
    ]


def get_settings() -> Settings:
    """Get application settings."""
    return Settings()
