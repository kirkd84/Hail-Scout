"""Pydantic settings for HailScout API."""

from __future__ import annotations

from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Core
    env: Literal["development", "staging", "production"] = Field(
        default="development", env="ENV"
    )
    debug: bool = Field(default=False, env="DEBUG")
    port: int = Field(default=8000, env="PORT")
    log_level: str = Field(default="INFO", env="LOG_LEVEL")

    # Database
    database_url: str = Field(
        default="postgresql+asyncpg://hailscout:hailscout@localhost:5432/hailscout",
        env="DATABASE_URL",
    )
    database_pool_size: int = Field(default=20, env="DATABASE_POOL_SIZE")
    database_pool_recycle: int = Field(default=3600, env="DATABASE_POOL_RECYCLE")

    # Clerk Authentication
    clerk_secret_key: str = Field(default="sk_test_xxxxxxxxxxxx", env="CLERK_SECRET_KEY")
    clerk_jwks_endpoint: str = Field(
        default="https://your-instance.clerk.accounts.com/.well-known/jwks.json",
        env="CLERK_JWKS_ENDPOINT",
    )

    # Geocoding
    geocoder_provider: Literal["nominatim", "mapbox"] = Field(
        default="nominatim", env="GEOCODER_PROVIDER"
    )
    nominatim_user_agent: str = Field(
        default="HailScout/0.1.0 (+https://hailscout.com)",
        env="NOMINATIM_USER_AGENT",
    )
    mapbox_api_key: str = Field(default="", env="MAPBOX_API_KEY")

    # Monitoring
    sentry_dsn: str | None = Field(default=None, env="SENTRY_DSN")
    sentry_environment: str = Field(default="development", env="SENTRY_ENVIRONMENT")

    # AWS
    aws_region: str = Field(default="us-east-1", env="AWS_REGION")
    aws_access_key_id: str | None = Field(default=None, env="AWS_ACCESS_KEY_ID")
    aws_secret_access_key: str | None = Field(default=None, env="AWS_SECRET_ACCESS_KEY")

    # CORS
    cors_origins: list[str] = Field(
        default=["http://localhost:3000", "http://localhost:3001"],
        env="CORS_ORIGINS",
    )

    class Config:
        """Pydantic config."""

        env_file = ".env"
        case_sensitive = False


def get_settings() -> Settings:
    """Get application settings."""
    return Settings()
