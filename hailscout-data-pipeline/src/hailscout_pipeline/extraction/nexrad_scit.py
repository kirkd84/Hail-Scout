"""NEXRAD Level II Storm Cell Identification & Tracking (SCIT).

Phase 18 scaffolding. SCIT is the NWS-standard algorithm for detecting
individual storm cells in radar volume scans and tracking them across
time. Combined with HCA (Hydrometeor Classification Algorithm), it
distinguishes hail-bearing cells from pure-rain ones — the basis for
HailTrace's storm-cell polygon products.

Pipeline:
    1. Parse Level II volume scan (sweeps × elevations × az × range).
       py-ART or wradlib are the canonical parsers — heavy deps (numpy,
       scipy, netCDF4, matplotlib). We import lazily so the main MRMS
       pipeline doesn't need them.

    2. Compute reflectivity composite (max over all elevations).
       Threshold at ~50 dBZ to isolate convective cores.

    3. Connected-components labeling on the thresholded grid → cells.
       Each cell gets centroid + bbox + area + peak reflectivity.

    4. Cross-volume tracking: match cells at T+1 to cells at T by
       (centroid-distance + bbox-IoU). TINT (Tracking by Identification)
       is the standard open algorithm. We can hand-roll a simpler
       version using Hungarian matching on the centroid×IoU cost.

    5. HCA per pixel (Park et al. 2009). Classifies each radar gate as
       big drops / hail / rain / etc. using polarimetric variables.
       Gates classified as hail inside a tracked cell promote the cell
       to "hail-bearing."

    6. Emit per-track storm row with hail polygon = projected hail
       gates from the volume scan.

This module currently exposes the type contracts and a stub
`process_volume_scan()` so the rest of the pipeline can be wired up
incrementally. The full implementation is intentionally deferred — it
needs py-ART installed in the Docker image and a separate Railway
service to ingest the ~5-15 MB volume scans every few minutes per
station (~80-120 GB/day across all CONUS stations).
"""
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional

import structlog
from shapely.geometry import MultiPolygon, Point, Polygon

log = structlog.get_logger()


# Reflectivity threshold (dBZ) for cell detection. 50 dBZ is the
# standard SCIT threshold for convective cores; 35 dBZ for storm
# outline. NEXRAD volume scans report dBZ values directly.
SCIT_CELL_THRESHOLD_DBZ = 50.0
SCIT_OUTLINE_THRESHOLD_DBZ = 35.0


@dataclass
class NexradCell:
    """One storm cell detected in a Level II volume scan.

    Centroid + footprint are in WGS84 (projected from the radar's
    az-range geometry via py-ART's `gate_lonlat` or wradlib's georef).
    `peak_dbz` and `peak_hail_dbz` are sampled at the cell's
    highest-reflectivity gate.
    """
    station: str
    timestamp: datetime
    centroid: Point
    footprint: MultiPolygon
    peak_dbz: float
    peak_hail_dbz: Optional[float] = None
    # Set when the same cell has been matched across consecutive scans.
    track_id: Optional[str] = None


@dataclass
class TrackedScan:
    """One volume scan's cells, plus the parent scan metadata."""
    station: str
    timestamp: datetime
    cells: List[NexradCell] = field(default_factory=list)


def process_volume_scan(
    grib_or_v06_path: str,
    station: str,
    timestamp: datetime,
) -> TrackedScan:
    """Parse a Level II volume scan and return its detected cells.

    PHASE 18 STUB — not yet implemented. Wiring this up requires:

      pip install arm-pyart    # ~200 MB with deps; xarray, scipy, netCDF4
      # or
      pip install wradlib      # lighter; ~80 MB

    Once installed, the implementation is:

        import pyart
        radar = pyart.io.read_nexrad_archive(path)
        comp = pyart.retrieve.composite_reflectivity(radar)
        # ... threshold + connected components + project to lat/lng
        # ... return TrackedScan(cells=[...])

    Until then this function raises so any accidental call surfaces
    loudly during integration tests.
    """
    raise NotImplementedError(
        "NEXRAD SCIT processing is Phase 18 scaffolding only. "
        "Install py-ART / wradlib + implement composite-reflectivity "
        "thresholding before enabling this in the ingest path."
    )


def track_cells_across_scans(
    prior_scan: TrackedScan,
    current_scan: TrackedScan,
    centroid_threshold_deg: float = 0.20,
) -> TrackedScan:
    """Carry track_id forward by best centroid match.

    For each cell in `current_scan`, find the cell in `prior_scan`
    whose centroid is within `centroid_threshold_deg` (~22 km at
    CONUS latitudes). Inherit its track_id. Unmatched cells start
    a new track.

    Stub: hand-rolled Hungarian-style matching can replace this later
    if accuracy matters; for v1 nearest-neighbor is enough.
    """
    # Real impl would iterate prior_scan.cells, build a cost matrix
    # vs current_scan.cells (cost = centroid distance), greedy-assign,
    # propagate track_id.
    raise NotImplementedError("Phase 18 — paired with process_volume_scan")
