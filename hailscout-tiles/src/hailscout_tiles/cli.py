"""Command-line interface for hailscout-tiles."""

import logging
import sys
from datetime import datetime, timezone
from typing import Optional

import click
import structlog

from hailscout_tiles.config import get_settings
from hailscout_tiles.jobs.generate_current import generate_current
from hailscout_tiles.jobs.generate_historical import generate_historical
from hailscout_tiles.jobs.invalidate_cache import invalidate_cloudfront


def setup_logging(log_level: str) -> None:
    """Configure structlog."""
    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer(),
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=log_level,
    )


@click.group()
def cli() -> None:
    """HailScout Tiles — Vector tile service for hail swaths."""
    pass


@cli.command()
def generate_current_cmd() -> None:
    """Generate current tileset (last 7 days)."""
    settings = get_settings()
    setup_logging(settings.log_level)

    try:
        generate_current()
        click.echo("Current tileset generation completed successfully")
    except Exception as e:
        click.echo(f"Error: {e}", err=True)
        sys.exit(1)


@cli.command()
@click.option("--date", type=str, help="Date in YYYY-MM-DD format")
@click.option(
    "--bbox",
    type=str,
    help="Bounding box in minx,miny,maxx,maxy format (comma-separated)",
)
def generate_historical_cmd(date: Optional[str], bbox: Optional[str]) -> None:
    """Generate historical tileset for a specific date."""
    settings = get_settings()
    setup_logging(settings.log_level)

    if not date:
        click.echo("Error: --date is required", err=True)
        sys.exit(1)

    try:
        # Parse date
        date_obj = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)

        # Parse bbox if provided
        bbox_tuple = None
        if bbox:
            try:
                parts = bbox.split(",")
                bbox_tuple = (float(parts[0]), float(parts[1]), float(parts[2]), float(parts[3]))
            except (ValueError, IndexError):
                click.echo("Error: --bbox must be minx,miny,maxx,maxy", err=True)
                sys.exit(1)

        generate_historical(date_obj, bbox_tuple)
        click.echo(f"Historical tileset generation for {date} completed successfully")
    except Exception as e:
        click.echo(f"Error: {e}", err=True)
        sys.exit(1)


@cli.command()
@click.option("--pattern", type=str, default="/swaths/*", help="CloudFront path pattern")
def invalidate_cache_cmd(pattern: str) -> None:
    """Invalidate CloudFront cache for a path pattern."""
    settings = get_settings()
    setup_logging(settings.log_level)

    if not settings.cloudfront_distribution_id:
        click.echo(
            "Error: CLOUDFRONT_DISTRIBUTION_ID not configured",
            err=True,
        )
        sys.exit(1)

    try:
        invalidation_id = invalidate_cloudfront(
            settings.cloudfront_distribution_id,
            pattern,
        )
        click.echo(f"Invalidation created: {invalidation_id}")
    except Exception as e:
        click.echo(f"Error: {e}", err=True)
        sys.exit(1)


@cli.command()
def health() -> None:
    """Health check — verify database and S3 connectivity."""
    settings = get_settings()
    setup_logging(settings.log_level)

    try:
        # Check database
        from sqlalchemy import create_engine, text

        engine = create_engine(settings.database_url)
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            result.fetchone()
        click.echo("✓ Database OK")

        # Check S3
        import boto3

        s3_client = boto3.client("s3")
        s3_client.head_bucket(Bucket=settings.s3_bucket)
        click.echo(f"✓ S3 bucket OK: {settings.s3_bucket}")

        click.echo("✓ All systems healthy")
    except Exception as e:
        click.echo(f"✗ Health check failed: {e}", err=True)
        sys.exit(1)


if __name__ == "__main__":
    cli()
