"""
Configuration management using Pydantic Settings.

Loads environment variables and provides type-safe access to config.
"""

from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings from environment variables."""

    # Database
    db_user: str = "hailscout"
    db_password: str
    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "hailscout_dev"
    db_echo: bool = False

    # AWS
    aws_region: str = "us-east-1"
    aws_account_id: str = "123456789012"

    # S3 Buckets
    noaa_mrms_bucket: str = "noaa-mrms-pds"
    hailscout_raw_bucket: str = "hailscout-raw"

    # Logging
    log_level: str = "INFO"

    # Runtime
    environment: str = "development"

    class Config:
        """Pydantic config."""

        env_file = ".env"
        case_sensitive = False

    @property
    def database_url(self) -> str:
        """Construct SQLAlchemy database URL."""
        return (
            f"postgresql+psycopg2://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )

    @property
    def is_production(self) -> bool:
        """Check if running in production."""
        return self.environment == "production"


# Global settings instance
settings = Settings()
