"""Generate current tileset (last 7 days) and upload to S3."""

import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path

from hailscout_tiles.config import get_settings
from hailscout_tiles.pipeline.query import query_swaths_by_date_range
from hailscout_tiles.pipeline.geojson_export import geodataframe_to_ndjson
from hailscout_tiles.pipeline.tippecanoe import run_tippecanoe
from hailscout_tiles.pipeline.tile_split import split_mbtiles_to_pbf
from hailscout_tiles.pipeline.upload import upload_tiles_to_s3
from hailscout_tiles.jobs.invalidate_cache import invalidate_cloudfront

logger = logging.getLogger(__name__)


def generate_current() -> None:
    """Generate tileset for the last 7 days of swaths.

    Workflow:
    1. Query hail_swaths from DB (last 7 days)
    2. Export to newline-delimited GeoJSON
    3. Run tippecanoe to create .mbtiles
    4. Split .mbtiles into /swaths/{z}/{x}/{y}.pbf files
    5. Upload to S3
    6. Invalidate CloudFront cache
    """
    settings = get_settings()
    logger.info("Starting current tileset generation")

    # Determine date range: last 7 days
    now = datetime.now(timezone.utc)
    start_date = now - timedelta(days=settings.swath_lookback_days)
    end_date = now

    logger.info(
        f"Querying swaths from {start_date.isoformat()} to {end_date.isoformat()}"
    )

    # Step 1: Query database
    gdf = query_swaths_by_date_range(start_date, end_date)
    if len(gdf) == 0:
        logger.warning("No swaths found in date range; skipping tileset generation")
        return

    logger.info(f"Found {len(gdf)} swaths")

    # Step 2: Export to NDJSON
    work_dir = Path(settings.tile_output_dir) / "current"
    work_dir.mkdir(parents=True, exist_ok=True)

    geojson_path = work_dir / "swaths.ndjson"
    geodataframe_to_ndjson(gdf, str(geojson_path))
    logger.info(f"Exported to {geojson_path}")

    # Step 3: Run tippecanoe
    mbtiles_path = work_dir / "swaths.mbtiles"
    run_tippecanoe(
        input_path=str(geojson_path),
        output_path=str(mbtiles_path),
        layer_name=settings.tile_layer_name,
        min_zoom=settings.tile_min_zoom,
        max_zoom=settings.tile_max_zoom,
    )
    logger.info(f"Generated {mbtiles_path}")

    # Step 4: Split into .pbf files
    tiles_dir = work_dir / "tiles"
    tiles_dir.mkdir(parents=True, exist_ok=True)
    split_mbtiles_to_pbf(str(mbtiles_path), str(tiles_dir))
    logger.info(f"Split tiles to {tiles_dir}")

    # Step 5: Upload to S3
    upload_tiles_to_s3(
        tiles_dir=str(tiles_dir),
        s3_prefix="swaths",
        s3_bucket=settings.s3_bucket,
    )
    logger.info("Uploaded to S3")

    # Step 6: Invalidate CloudFront
    if settings.cloudfront_distribution_id:
        invalidate_cloudfront(
            distribution_id=settings.cloudfront_distribution_id,
            pattern="/swaths/*",
        )
        logger.info("Invalidated CloudFront cache")

    logger.info("Current tileset generation complete")
