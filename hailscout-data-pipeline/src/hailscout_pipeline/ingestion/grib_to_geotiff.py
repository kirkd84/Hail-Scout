"""
Parse GRIB2 → xarray → GeoTIFF conversion.

Uses cfgrib for GRIB2 parsing and rasterio for GeoTIFF output.
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from tempfile import gettempdir

import structlog
import xarray as xr

log = structlog.get_logger()


def grib_to_geotiff(grib_path: str, timestamp: datetime) -> tuple[str, str]:
    """
    Parse GRIB2 file and convert to GeoTIFF.

    Args:
        grib_path: Path to GRIB2 file
        timestamp: Timestamp of the data (for S3 key generation)

    Returns:
        Tuple of (local_geotiff_path, s3_key_path)

    Raises:
        RuntimeError: If parsing or conversion fails
    """
    log.info("grib_parse_start", path=grib_path)

    try:
        # TODO: Load GRIB2 with cfgrib
        # This is a stub; real implementation:
        # ds = xr.open_dataset(grib_path, engine='cfgrib')
        # mesh_var = ds['MESH_Max_1440min_00.50']  # or whatever variable name
        # Convert to numpy array, apply georeferencing, write to GeoTIFF
        #
        # For now, we'll document the expected flow:
        # 1. Load GRIB2 into xarray Dataset
        # 2. Extract MESH variable (float32 grid of hail size in mm)
        # 3. Use rasterio to write GeoTIFF with proper CRS (WGS84) and geotransform
        # 4. Return local and S3 paths

        # Placeholder: skip actual parsing for scaffold
        log.info("grib_parse_skipped", reason="TODO: real MRMS fixture needed")

        # Generate output paths
        year = timestamp.year
        month = f"{timestamp.month:02d}"
        day = f"{timestamp.day:02d}"
        ts_str = timestamp.strftime("%Y%m%d_%H%M%S")

        local_geotiff = Path(gettempdir()) / f"MESH_{ts_str}.tif"
        s3_key = f"mesh/{year}/{month}/{day}/{ts_str}.tif"

        # For now, create empty placeholder
        log.info("geotiff_placeholder", path=str(local_geotiff), s3_key=s3_key)

        return str(local_geotiff), s3_key

    except Exception as e:
        log.exception("grib_parse_failed", path=grib_path, error=str(e))
        raise RuntimeError(f"Failed to parse GRIB2: {e}") from e
