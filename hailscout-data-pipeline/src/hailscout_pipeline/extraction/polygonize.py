"""
Extract hail swath polygons from GeoTIFF grid.

Uses rasterio for raster reading and shapely for polygon generation.
"""

from __future__ import annotations

from datetime import datetime
from typing import NamedTuple

import structlog
from shapely.geometry import MultiPolygon

from hailscout_pipeline.extraction.thresholds import HAIL_CATEGORIES, get_category

log = structlog.get_logger()


class HailSwath(NamedTuple):
    """Extracted hail swath polygon."""

    hail_size_category: str  # Label from thresholds.py
    geom_multipolygon: MultiPolygon  # GeoJSON-like geometry (WGS84)
    timestamp: datetime
    source: str = "MRMS"


def extract_swath_polygons(geotiff_path: str, timestamp: datetime) -> list[HailSwath]:
    """
    Extract hail swath polygons from GeoTIFF.

    Reads the rasterized MESH grid, applies hail-size thresholds,
    and extracts contiguous regions as polygons.

    Args:
        geotiff_path: Path to GeoTIFF file
        timestamp: Data timestamp

    Returns:
        List of HailSwath objects (one per category)

    Raises:
        RuntimeError: If raster reading fails
    """
    log.info("extract_swaths_start", path=geotiff_path, timestamp=timestamp.isoformat())

    swaths: list[HailSwath] = []

    try:
        # TODO: Load GeoTIFF with rasterio
        # This is a stub; real implementation:
        # with rasterio.open(geotiff_path) as src:
        #     mesh_array = src.read(1)  # First band (MESH hail size)
        #     profile = src.profile  # CRS, bounds, resolution
        #
        # For each hail category:
        #   1. Create binary mask (pixels in this category)
        #   2. Use rasterio.features.shapes() to vectorize to polygons
        #   3. Merge adjacent polygons into MultiPolygon
        #   4. Append to swaths list
        #
        # Note: MESH grid uses millimeters, not inches. Convert: mm / 25.4 = inches

        log.info("extract_swaths_skipped", reason="TODO: real MRMS fixture needed")

        # For now, return empty list (scaffold)
        return swaths

    except Exception as e:
        log.exception("extract_swaths_failed", path=geotiff_path, error=str(e))
        raise RuntimeError(f"Failed to extract swaths: {e}") from e
