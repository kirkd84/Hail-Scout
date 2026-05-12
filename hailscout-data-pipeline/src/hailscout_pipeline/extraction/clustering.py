"""Cluster per-category hail swaths into individual storm cells.

Why this exists
---------------
The original `extract_swaths_from_grid` produces one `HailSwath` per
category for the whole CONUS, each containing every contiguous hail
polygon in that category. The downstream upsert then rolls them up
into a single `Storm` row per UTC date — so a busy day with hail in
Texas, Iowa, and the Carolinas produces ONE storm row whose bbox
spans 2000 km. The map can't tell those apart, and storm-cell
products like HailTrace / IHM look polished precisely because they
keep cells separate.

This module clusters per-polygon, not per-category. Each isolated
storm cell becomes its own `(swaths_for_this_cell)` payload, ready to
be upserted as an independent Storm row.

Algorithm
---------
1. Flatten every per-category MultiPolygon into individual polygons,
   tagged with their category + max-inches.
2. Buffer each by CLUSTER_BUFFER_DEG (≈ 33 km), then `unary_union`
   — adjacent / nearby buffers fuse, producing a MultiPolygon whose
   pieces are the storm-cell regions.
3. Each original polygon is assigned to the region that contains its
   centroid.
4. For each cluster, re-merge polygons within the same category and
   emit a fresh `HailSwath` list.

The buffer-and-union trick is O(N) in shapely's spatial index — no
DBSCAN dependency, no distance matrix. For a typical CONUS day with
a few hundred polygons it runs in well under a second.
"""
from __future__ import annotations
from collections import defaultdict
from datetime import datetime
from typing import List, Tuple

import structlog
from shapely.geometry import MultiPolygon, Polygon
from shapely.ops import unary_union

from hailscout_pipeline.extraction.polygonize import HailSwath

log = structlog.get_logger()


# ≈ 33 km at CONUS latitudes. Two polygons within ~33 km of each other
# get merged into the same cell — matches typical mesoscale-convective-
# system cell spacing. Wider buffers fuse adjacent cells into one mega-
# cell (bad); tighter buffers split single supercells into stripes (bad).
CLUSTER_BUFFER_DEG = 0.30

# Skip clusters that are noise — fewer total pixels than this across
# all categories AND no damaging-hail (>=1.5") presence. Matches the
# tiered detection rule in polygonize.py.
MIN_CLUSTER_PIXELS_LIGHT_HAIL = 4
DAMAGING_HAIL_INCHES = 1.5


def cluster_swaths_into_cells(
    swaths: List[HailSwath],
) -> List[List[HailSwath]]:
    """Split per-category CONUS swaths into per-cell swath bundles.

    Returns a list where each element is the `HailSwath[]` for one
    storm cell. Empty list if input is empty.
    """
    if not swaths:
        return []

    # 1. Flatten — one entry per individual polygon, tagged.
    items: List[Tuple[Polygon, str, float]] = []  # (polygon, category, max_in)
    for swath in swaths:
        for poly in swath.geom_multipolygon.geoms:
            if poly.is_empty or poly.area <= 0:
                continue
            items.append((poly, swath.hail_size_category, swath.max_hail_size_in))

    if not items:
        return []

    # 2. Buffer + union → cluster regions.
    buffered = [p[0].buffer(CLUSTER_BUFFER_DEG) for p in items]
    merged = unary_union(buffered)
    if isinstance(merged, Polygon):
        cluster_regions = [merged]
    elif isinstance(merged, MultiPolygon):
        cluster_regions = list(merged.geoms)
    else:
        # GeometryCollection — extract polygons only
        cluster_regions = [g for g in merged.geoms if isinstance(g, Polygon)]

    log.info("cluster_regions", count=len(cluster_regions),
             buffer_deg=CLUSTER_BUFFER_DEG)

    # 3. Assign each polygon to its containing cluster region.
    #    Fallback to nearest region if no `contains` hit (rare; happens
    #    on polygon boundaries).
    cells: defaultdict = defaultdict(lambda: defaultdict(list))
    for poly, cat, max_in in items:
        centroid = poly.centroid
        cluster_idx = -1
        for idx, region in enumerate(cluster_regions):
            if region.contains(centroid):
                cluster_idx = idx
                break
        if cluster_idx == -1:
            # Centroid on boundary or weird geometry — pick the nearest
            # region by min distance.
            cluster_idx = min(
                range(len(cluster_regions)),
                key=lambda i: cluster_regions[i].distance(centroid),
            )
        cells[cluster_idx][cat].append((poly, max_in))

    # 4. Build a fresh HailSwath[] per cluster.
    timestamp: datetime = swaths[0].timestamp
    source: str = swaths[0].source

    cell_bundles: List[List[HailSwath]] = []
    for cluster_idx, by_category in cells.items():
        cell_swaths: List[HailSwath] = []
        total_pixels_light = 0
        has_damaging = False
        for category, poly_items in by_category.items():
            polys = [pi[0] for pi in poly_items]
            max_in = max(pi[1] for pi in poly_items)
            merged_geom = unary_union(polys)
            if isinstance(merged_geom, Polygon):
                multi = MultiPolygon([merged_geom])
            elif isinstance(merged_geom, MultiPolygon):
                multi = merged_geom
            else:
                # GeometryCollection edge case
                polys2 = [g for g in merged_geom.geoms if isinstance(g, Polygon)]
                if not polys2:
                    continue
                multi = MultiPolygon(polys2)

            # Approximate pixel count from area (each MRMS pixel ≈ 0.01°
            # × 0.01° at the equator; at CONUS latitudes the latitude
            # term is ~the same since rasterio gives us square-degree
            # area). 1 px ≈ 0.0001 deg².
            approx_pixels = max(1, int(multi.area / 0.0001))

            cell_swaths.append(HailSwath(
                hail_size_category=category,
                geom_multipolygon=multi,
                timestamp=timestamp,
                source=source,
                max_hail_size_in=max_in,
                pixel_count=approx_pixels,
            ))

            cat_min = float(category.rstrip("+"))
            if cat_min >= DAMAGING_HAIL_INCHES:
                has_damaging = True
            else:
                total_pixels_light += approx_pixels

        # Drop cells that are purely small-hail noise.
        if not has_damaging and total_pixels_light < MIN_CLUSTER_PIXELS_LIGHT_HAIL:
            log.info("cluster_dropped_noise",
                     cluster_idx=cluster_idx,
                     light_pixels=total_pixels_light)
            continue

        if cell_swaths:
            cell_bundles.append(cell_swaths)

    log.info("clustering_done",
             input_swaths=len(swaths),
             input_polygons=len(items),
             cells=len(cell_bundles))
    return cell_bundles
