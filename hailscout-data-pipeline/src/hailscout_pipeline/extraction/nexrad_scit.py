"""NEXRAD Level II Storm Cell Identification & Tracking (SCIT).

Phase 18 implementation. Processes radar volume scans into per-cell
polygons with hail-size annotation and cross-volume tracking — the
sub-km-resolution counterpart to the MRMS MESH pipeline.

Pipeline:
    1. Parse Level II volume scan with py-ART. Each file is one
       station's volume scan (4-10 min wall time covers all elevations).

    2. Composite reflectivity = max dBZ across elevation sweeps.
       Threshold at SCIT_CELL_THRESHOLD_DBZ to isolate convective cores.

    3. scipy.ndimage.label runs connected-components on the binary
       mask. Each labeled region is one storm cell.

    4. For each cell, build a polygon footprint from the convex hull
       of the gate centers above threshold. Projected to WGS84 using
       py-ART's `gate_longitude` / `gate_latitude` fields.

    5. Cross-volume tracking via centroid nearest-neighbor matching
       (within CELL_TRACK_THRESHOLD_DEG). Carries `track_id` forward
       so the same cell across consecutive scans accumulates into one
       track-shaped Storm row in the DB.

    6. Estimated max hail size from peak dBZ via the standard
       NWS-derived heuristic (Auer 1994 / Witt 1998 simplification).
       Real hail sizing wants polarimetric variables (ZDR, KDP, RhoHV)
       but the dBZ proxy is good enough for v1.

py-ART import is module-level — the NEXRAD Dockerfile installs it.
The MRMS pipeline doesn't import this module so it doesn't need
py-ART.
"""
from __future__ import annotations
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional

import numpy as np
import pyart
import structlog
from scipy import ndimage
from scipy.spatial.distance import cdist
from shapely.geometry import MultiPoint, MultiPolygon, Point, Polygon

log = structlog.get_logger()


# Reflectivity threshold (dBZ) for cell detection. 50 dBZ is the
# standard SCIT threshold for convective cores; lower values include
# stratiform precip that's not relevant to hail.
SCIT_CELL_THRESHOLD_DBZ = 50.0

# Minimum gates above threshold to keep a cell. Radar gates are ~1km²
# at the typical analysis range, so 8 gates ≈ 8 km² of high-dBZ core —
# below this is single-cell noise / range folding.
MIN_CELL_GATES = 8

# Centroid distance threshold (degrees) for cross-volume cell matching.
# 0.20° ≈ 22 km at CONUS latitudes — cells typically move 5-15 km
# between 5-10 min volume scans, so this comfortably catches normal
# cell motion while keeping distinct nearby cells separate.
CELL_TRACK_THRESHOLD_DEG = 0.20


@dataclass
class NexradCell:
    """One storm cell detected in a Level II volume scan."""
    station: str
    timestamp: datetime
    centroid: Point
    footprint: MultiPolygon
    peak_dbz: float
    estimated_hail_size_in: float
    track_id: Optional[str] = None


@dataclass
class TrackedScan:
    """One volume scan's cells, plus the parent scan metadata."""
    station: str
    timestamp: datetime
    cells: List[NexradCell] = field(default_factory=list)


def _dbz_to_hail_size_in(peak_dbz: float) -> float:
    """Convert peak composite reflectivity (dBZ) to approximate hail
    diameter (inches).

    Empirical NWS lookup (Witt 1998 / Auer 1994 simplification):
        45-50 dBZ  → 0.5" (pea / no significant hail)
        50-55 dBZ  → 0.75-1.0" (penny / quarter)
        55-60 dBZ  → 1.0-1.5"
        60-65 dBZ  → 1.5-2.0"
        65-70 dBZ  → 2.0-3.0"
        70+  dBZ   → 3.0"+ (record-eligible)

    A real polarimetric Hydrometeor Classification Algorithm would
    sharpen this with ZDR + RhoHV, but the dBZ proxy is the v1 baseline
    every NWS office uses for first-pass hail call-outs.
    """
    if peak_dbz >= 70: return 3.5
    if peak_dbz >= 65: return 2.5
    if peak_dbz >= 60: return 1.75
    if peak_dbz >= 58: return 1.5
    if peak_dbz >= 55: return 1.25
    if peak_dbz >= 53: return 1.0
    if peak_dbz >= 50: return 0.75
    return 0.5


def _hail_size_to_category(inches: float) -> str:
    """Map hail diameter to the shared HailSwath category label.
    Matches the 8-bin palette used by the MRMS pipeline."""
    if inches >= 3.0:  return "3.0+"
    if inches >= 2.75: return "2.75"
    if inches >= 2.5:  return "2.5"
    if inches >= 2.0:  return "2.0"
    if inches >= 1.75: return "1.75"
    if inches >= 1.5:  return "1.5"
    if inches >= 1.25: return "1.25"
    if inches >= 1.0:  return "1.0"
    return "0.75"


def process_volume_scan(
    path: str,
    station: str,
    timestamp: datetime,
) -> TrackedScan:
    """Parse a Level II volume scan and return its detected cells.

    Caller owns the file lifecycle — we don't unlink here.
    """
    log.info("nexrad_scan_open", path=path, station=station,
             ts=timestamp.isoformat())
    radar = pyart.io.read_nexrad_archive(path)

    # composite_reflectivity = max dBZ over all elevation sweeps. The
    # resulting field is a 2-D grid keyed by az × range at the lowest
    # sweep's geometry, suitable for connected-components labeling.
    composite_radar = pyart.retrieve.composite_reflectivity(radar)
    refl_field = composite_radar.fields["composite_reflectivity"]["data"]

    # Mask out NaN / fill values and apply the convective-core threshold
    if hasattr(refl_field, "mask"):
        above = (refl_field.filled(-9999.0) > SCIT_CELL_THRESHOLD_DBZ)
    else:
        above = (refl_field > SCIT_CELL_THRESHOLD_DBZ)

    # Connected-components labeling — each connected region is one cell
    labeled, n_cells = ndimage.label(above)
    log.info("nexrad_labels", station=station, n_labels=int(n_cells),
             gates_above_threshold=int(above.sum()))

    if n_cells == 0:
        return TrackedScan(station=station, timestamp=timestamp, cells=[])

    # Gate-center coordinates in WGS84
    lats = np.asarray(composite_radar.gate_latitude["data"])
    lons = np.asarray(composite_radar.gate_longitude["data"])

    cells: List[NexradCell] = []
    for cell_id in range(1, int(n_cells) + 1):
        cell_mask = (labeled == cell_id)
        gate_count = int(cell_mask.sum())
        if gate_count < MIN_CELL_GATES:
            continue

        cell_lats = lats[cell_mask].astype(float)
        cell_lons = lons[cell_mask].astype(float)

        pts = MultiPoint(list(zip(cell_lons.tolist(), cell_lats.tolist())))
        # Convex hull is a fast, robust footprint for a swarm of gate
        # centers. Alpha-shape would carve out the actual storm shape
        # more tightly but adds an alphashape / cgal dependency.
        footprint = pts.convex_hull
        if not isinstance(footprint, Polygon) or footprint.is_empty \
                or footprint.area <= 0:
            continue

        peak_dbz = float(refl_field[cell_mask].max())
        hail_size = _dbz_to_hail_size_in(peak_dbz)

        cells.append(NexradCell(
            station=station,
            timestamp=timestamp,
            centroid=footprint.centroid,
            footprint=MultiPolygon([footprint]),
            peak_dbz=peak_dbz,
            estimated_hail_size_in=hail_size,
        ))

    log.info("nexrad_cells", station=station, ts=timestamp.isoformat(),
             cells=len(cells),
             peak_dbz=max((c.peak_dbz for c in cells), default=0.0))
    return TrackedScan(station=station, timestamp=timestamp, cells=cells)


def track_cells_across_scans(
    prior: TrackedScan,
    current: TrackedScan,
    centroid_threshold_deg: float = CELL_TRACK_THRESHOLD_DEG,
) -> TrackedScan:
    """Carry track_id forward from prior scan via centroid NN matching.

    Greedy nearest-neighbor: for each cell in current, find the closest
    unassigned cell in prior within `centroid_threshold_deg`; inherit
    its track_id. Cells with no match start a new track.

    Mutates `current.cells` in place; returns `current` for chaining.
    """
    # Bootstrap: nothing to inherit from — fresh track ids for all
    if not prior.cells:
        for c in current.cells:
            if c.track_id is None:
                c.track_id = f"track_{uuid.uuid4().hex[:12]}"
        return current

    if not current.cells:
        return current

    prior_pts = np.array(
        [[c.centroid.x, c.centroid.y] for c in prior.cells]
    )
    current_pts = np.array(
        [[c.centroid.x, c.centroid.y] for c in current.cells]
    )

    # Distance matrix in degrees (planar — fine at small radii)
    dist = cdist(current_pts, prior_pts)

    assigned: set[int] = set()
    matches = 0
    for i in range(len(current.cells)):
        sorted_j = np.argsort(dist[i])
        matched_id: Optional[str] = None
        for j in sorted_j:
            if int(j) in assigned:
                continue
            if dist[i, j] > centroid_threshold_deg:
                break
            matched_id = prior.cells[int(j)].track_id
            assigned.add(int(j))
            matches += 1
            break
        current.cells[i].track_id = matched_id or f"track_{uuid.uuid4().hex[:12]}"

    log.info("nexrad_tracking",
             station=current.station,
             ts=current.timestamp.isoformat(),
             current_cells=len(current.cells),
             prior_cells=len(prior.cells),
             matched=matches,
             new_tracks=len(current.cells) - matches)
    return current
