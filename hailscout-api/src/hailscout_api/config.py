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
    # Svix-signed Clerk webhook secret (from Clerk dashboard → Webhooks).
    # Used by /v1/webhooks/clerk to verify event payloads.
    clerk_webhook_secret: str = ""
    clerk_jwks_endpoint: str = (
        "https://your-instance.clerk.accounts.com/.well-known/jwks.json"
    )
    # Expected JWT issuer (the Clerk Frontend API origin, e.g.
    # "https://your-instance.clerk.accounts.com"). When set, JWT verification
    # pins the `iss` claim per Clerk's backend verification guidance. Leave
    # empty to skip the issuer check (NOT recommended in production).
    clerk_issuer: str = ""
    # Optional allow-list of authorized parties (the `azp` claim, typically
    # your frontend origins). When set, a token whose `azp` is present but not
    # in this list is rejected; empty = no azp check. Like ``cors_origins``,
    # this is a list field, so the env var must be a JSON array, e.g.
    # CLERK_AUTHORIZED_PARTIES='["http://localhost:3000","https://hail-scout.vercel.app"]'.
    clerk_authorized_parties: list[str] = []
    # JWKS cache TTL in seconds. The signing keys rarely rotate, so a single
    # fetch is reused across requests for this long instead of re-fetching the
    # JWKS endpoint on every authenticated call.
    clerk_jwks_cache_ttl_seconds: int = 3600

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
        # Production web app on Vercel.
        "https://hail-scout.vercel.app",
    ]


def get_settings() -> Settings:
    """Get application settings."""
    return Settings()
