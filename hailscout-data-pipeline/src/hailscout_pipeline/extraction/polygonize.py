"""Extract hail swath MultiPolygons from a MeshGrid.

For each hail size category (penny, quarter, ... softball) we build a
binary mask of pixels >= category min, then vectorize to polygons via
rasterio.features.shapes. Adjacent polygons are merged into a single
MultiPolygon per category.
"""
from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime

import numpy as np
import structlog
from rasterio.features import shapes
from rasterio.transform import Affine
from shapely.geometry import MultiPolygon, Polygon, shape as shapely_shape
from shapely.ops import unary_union

from hailscout_pipeline.extraction.thresholds import HAIL_CATEGORIES
from hailscout_pipeline.ingestion.grib_to_geotiff import MeshGrid

log = structlog.get_logger()

# Skip swaths smaller than this many pixels (~1 km² each at ~1 km grid)
# 4 px ≈ 4 sq km — filters out single-cell noise.
MIN_PIXELS_PER_SWATH = 4


@dataclass
class HailSwath:
    """Extracted hail swath polygon."""
    hail_size_category: str
    geom_multipolygon: MultiPolygon
    timestamp: datetime
    source: str = "MRMS"
    max_hail_size_in: float = 0.0
    pixel_count: int = 0


def extract_swaths_from_grid(grid: MeshGrid) -> list[HailSwath]:
    """Build one MultiPolygon per hail size category from a MeshGrid.

    Returns swaths sorted by category (smallest → largest size).
    """
    a, b, c, d, e, f = grid.transform
    aff = Affine(a, b, c, d, e, f)

    swaths: list[HailSwath] = []
    arr = grid.values

    for cat in HAIL_CATEGORIES:
        # Pixels in [cat.min_inches, cat.max_inches) — or just >= min if unbounded
        if cat.max_inches is None:
            mask = arr >= cat.min_inches
        else:
            mask = (arr >= cat.min_inches) & (arr < cat.max_inches)

        pixel_count = int(mask.sum())
        if pixel_count < MIN_PIXELS_PER_SWATH:
            continue

        # rasterio.features.shapes wants uint8 mask
        mask_u8 = mask.astype(np.uint8)
        polys: list[Polygon] = []
        for geom_dict, value in shapes(mask_u8, mask=mask_u8, transform=aff):
            if value != 1:
                continue
            poly = shapely_shape(geom_dict)
            # Skip near-degenerate polygons
            if poly.is_empty or poly.area <= 0:
                continue
            polys.append(poly)

        if not polys:
            continue

        # Merge into a single MultiPolygon
        merged = unary_union(polys)
        if isinstance(merged, Polygon):
            multi = MultiPolygon([merged])
        elif isinstance(merged, MultiPolygon):
            multi = merged
        else:
            # GeometryCollection — pull out polygons
            polys2 = [g for g in merged.geoms if isinstance(g, Polygon)]
            if not polys2:
                continue
            multi = MultiPolygon(polys2)

        # Max size within this category's pixels
        in_cat_values = arr[mask]
        max_in = float(in_cat_values.max()) if in_cat_values.size > 0 else cat.min_inches

        swaths.append(HailSwath(
            hail_size_category=cat.label,
            geom_multipolygon=multi,
            timestamp=grid.timestamp,
            max_hail_size_in=max_in,
            pixel_count=pixel_count,
        ))
        log.info("swath_extracted",
                 category=cat.label, pixels=pixel_count,
                 polys=len(multi.geoms), max_inches=max_in)

    return swaths


# Backwards-compat shim
def extract_swath_polygons(geotiff_path: str, timestamp: datetime) -> list[HailSwath]:
    """Legacy: load GeoTIFF and extract swaths."""
    import rasterio
    with rasterio.open(geotiff_path) as src:
        arr = src.read(1)
        a, b, c, d, e, f = src.transform.a, src.transform.b, src.transform.c, \
                           src.transform.d, src.transform.e, src.transform.f
        grid = MeshGrid(
            values=arr, transform=(a, b, c, d, e, f), crs="EPSG:4326",
            timestamp=timestamp, width=src.width, height=src.height,
        )
    return extract_swaths_from_grid(grid)
