"""Generate historical tileset for a specific date."""

import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from hailscout_tiles.config import get_settings
from hailscout_tiles.pipeline.query import query_swaths_by_date_range
from hailscout_tiles.pipeline.geojson_export import geodataframe_to_ndjson
from hailscout_tiles.pipeline.tippecanoe import run_tippecanoe
from hailscout_tiles.pipeline.tile_split import split_mbtiles_to_pbf
from hailscout_tiles.pipeline.upload import upload_tiles_to_s3

logger = logging.getLogger(__name__)


def generate_historical(
    date: datetime,
    bbox: Optional[tuple[float, float, float, float]] = None,
) -> None:
    """Generate tileset for a specific historical date.

    Args:
        date: Date to generate (e.g., datetime(2023, 5, 15, tzinfo=timezone.utc))
        bbox: Optional bounding box (minx, miny, maxx, maxy) to limit query

    Workflow:
    1. Query hail_swaths for the specific date
    2. Export to newline-delimited GeoJSON
    3. Run tippecanoe to create .mbtiles
    4. Split .mbtiles into /{date}/{z}/{x}/{y}.pbf files
    5. Upload to S3 under /historical/{YYYY-MM-DD}/
    """
    settings = get_settings()
    logger.info(f"Starting historical tileset generation for {date.date()}")

    # Ensure date is in UTC and spans the full day
    if date.tzinfo is None:
        date = date.replace(tzinfo=timezone.utc)

    start_date = date.replace(hour=0, minute=0, second=0, microsecond=0)
    end_date = start_date.replace(hour=23, minute=59, second=59, microsecond=999999)

    logger.info(
        f"Querying swaths from {start_date.isoformat()} to {end_date.isoformat()}"
    )

    # Step 1: Query database
    gdf = query_swaths_by_date_range(start_date, end_date, bbox=bbox)
    if len(gdf) == 0:
        logger.warning(f"No swaths found for {date.date()}; skipping")
        return

    logger.info(f"Found {len(gdf)} swaths")

    # Step 2: Export to NDJSON
    date_str = date.strftime("%Y-%m-%d")
    work_dir = Path(settings.tile_output_dir) / "historical" / date_str
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
    s3_prefix = f"historical/{date_str}"
    upload_tiles_to_s3(
        tiles_dir=str(tiles_dir),
        s3_prefix=s3_prefix,
        s3_bucket=settings.s3_bucket,
    )
    logger.info(f"Uploaded to S3 at {s3_prefix}")

    # Note: CloudFront invalidation is NOT needed for historical tiles
    # (they are immutable and cached forever)

    logger.info(f"Historical tileset generation for {date.date()} complete")
