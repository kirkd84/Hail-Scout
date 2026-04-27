"""Configuration management for hailscout-tiles."""

from typing import Literal

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Global application settings."""

    # Database
    database_url: str = "postgresql://localhost/hailscout"

    # AWS
    aws_region: str = "us-east-1"
    aws_profile: str | None = None
    s3_bucket: str = "hailscout-tiles"
    cloudfront_distribution_id: str | None = None

    # Tile generation
    tile_output_dir: str = "/tmp/hailscout-tiles"
    tile_min_zoom: int = 4
    tile_max_zoom: int = 14
    tile_layer_name: str = "swaths"
    tippecanoe_cmd: str = "tippecanoe"  # Path to tippecanoe binary

    # Swath query
    swath_lookback_days: int = 7  # Query swaths from last N days for "current" tileset
    swath_bbox_padding: float = 0.1  # Degrees to pad storm bbox

    # Logging
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"

    class Config:
        """Pydantic config."""

        env_file = ".env"
        case_sensitive = False


def get_settings() -> Settings:
    """Get global settings singleton."""
    return Settings()
