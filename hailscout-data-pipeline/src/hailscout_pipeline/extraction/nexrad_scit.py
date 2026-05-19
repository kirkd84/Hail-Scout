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
    """One storm cell detected in a Level II volume scan.

    `hail_confirmed` is True when polarimetric variables (ZDR, RhoHV)
    at the cell's high-reflectivity gates match the hail-vs-rain
    signature. When True, `estimated_hail_size_in` is derived from
    hail-classified gates only; when False (or unknown), it's the
    plain dBZ→size proxy.
    """
    station: str
    timestamp: datetime
    centroid: Point
    footprint: MultiPolygon
    peak_dbz: float
    estimated_hail_size_in: float
    track_id: Optional[str] = None
    hail_confirmed: bool = False
    hail_gate_fraction: float = 0.0  # fraction of cell gates with hail signature


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


# Polarimetric hail signature thresholds. WSR-88D dual-pol radars
# returned ZDR + RhoHV + KDP since the 2012-2013 fleet upgrade, so
# every modern volume scan in the Unidata mirror has these. The
# canonical hail-vs-rain discriminator:
#
#   Rain:   high refl, ZDR > 1 dB (oblate raindrops), RhoHV > 0.97
#   Hail:   high refl, ZDR ≈ 0 dB (tumbling stones), RhoHV < 0.95
#
# We treat a gate as hail-signature if it has high reflectivity AND
# (low ZDR OR low RhoHV). KDP can be added later; on its own it's
# noisier than ZDR for hail discrimination.
HAIL_REFL_MIN_DBZ = 50.0   # already the cell-detection threshold
HAIL_ZDR_MAX_DB = 1.0      # below this is hail-like
HAIL_RHOHV_MAX = 0.95      # below this is mixed-phase / hail-like

# Fraction of a cell's gates that must show hail polarimetric
# signature to flag the cell as `hail_confirmed=True`.
HAIL_CONFIRMATION_FRACTION = 0.25


def _composite_max_per_gate(radar, field_name: str) -> Optional[np.ndarray]:
    """Per-column max of a field across all sweeps in the volume.

    py-ART's `composite_reflectivity` does this for reflectivity but
    doesn't expose the operation generally. We replicate it for
    polarimetric fields (ZDR, RhoHV) so each gate gets the highest /
    most-extreme value any sweep saw at that column.

    Returns a 2D array shape matching the composite_reflectivity grid,
    or None if the field is missing from the radar.
    """
    if field_name not in radar.fields:
        return None
    try:
        data = radar.fields[field_name]["data"]
    except (KeyError, TypeError):
        return None
    # Radar data is shape (n_rays_total, n_gates). For a volume scan
    # n_rays_total = sum(sweep_rays). We reshape by sweep and take max
    # across sweeps at each az/range cell. py-ART's sweep_start_ray_index
    # and sweep_end_ray_index tell us the slices.
    try:
        starts = np.asarray(radar.sweep_start_ray_index["data"])
        ends = np.asarray(radar.sweep_end_ray_index["data"])
    except (KeyError, AttributeError):
        return None
    # Use the lowest sweep as the base grid (matches composite_reflectivity)
    base_start = int(starts[0])
    base_end = int(ends[0]) + 1
    base = data[base_start:base_end].copy()
    if hasattr(base, "filled"):
        base = base.filled(np.nan)
    base = np.asarray(base, dtype=np.float32)
    # Per-az/range, walk upper sweeps and take the most-extreme value.
    # "Extreme" depends on field: for ZDR we want MIN (low = hail), for
    # RhoHV we want MIN. We compute MIN by default; reflectivity uses
    # the existing composite path so this function is only called for
    # ZDR + RhoHV.
    for s in range(1, len(starts)):
        sweep_data = data[int(starts[s]):int(ends[s]) + 1]
        if hasattr(sweep_data, "filled"):
            sweep_data = sweep_data.filled(np.nan)
        sweep_data = np.asarray(sweep_data, dtype=np.float32)
        # Sweeps in a volume scan have different ray counts. Trim or
        # pad to match the base sweep's ray dimension.
        n_rays_base, n_gates_base = base.shape
        n_rays_sweep = sweep_data.shape[0]
        if n_rays_sweep != n_rays_base:
            # Naively trim to the shorter one — close enough for the
            # hail-detection use case at the column level.
            n = min(n_rays_base, n_rays_sweep)
            trimmed_base = base[:n]
            trimmed_sweep = sweep_data[:n, :n_gates_base]
            with np.errstate(invalid="ignore"):
                base[:n] = np.fmin(trimmed_base, trimmed_sweep)
        else:
            with np.errstate(invalid="ignore"):
                base = np.fmin(base, sweep_data[:, :n_gates_base])
    return base


def _polarimetric_hail_mask(radar) -> Optional[np.ndarray]:
    """Return a 2D bool mask matching the composite_reflectivity grid:
    True where the gate's polarimetric signature is hail-consistent
    (low ZDR OR low RhoHV in combination with high reflectivity).

    Returns None if ZDR / RhoHV fields aren't on the radar.
    """
    zdr_min = _composite_max_per_gate(radar, "differential_reflectivity")
    rho_min = _composite_max_per_gate(radar, "cross_correlation_ratio")
    if zdr_min is None and rho_min is None:
        return None
    # Either signature alone is enough.
    parts = []
    if zdr_min is not None:
        with np.errstate(invalid="ignore"):
            parts.append(np.nan_to_num(zdr_min, nan=99.0) < HAIL_ZDR_MAX_DB)
    if rho_min is not None:
        with np.errstate(invalid="ignore"):
            parts.append(np.nan_to_num(rho_min, nan=1.0) < HAIL_RHOHV_MAX)
    if not parts:
        return None
    mask = parts[0]
    for p in parts[1:]:
        mask = mask | p
    return mask


def process_volume_scan(
    path: str,
    station: str,
    timestamp: datetime,
) -> TrackedScan:
    """Parse a Level II volume scan and return its detected cells.

    Phase 19 addition: each cell is checked against the polarimetric
    hail signature. Cells whose high-reflectivity gates are >= the
    HAIL_CONFIRMATION_FRACTION threshold get `hail_confirmed=True` and
    a more accurate peak — taken from hail-classified gates only. The
    dBZ→size lookup stays as the underlying size estimator but its
    input is filtered through the polarimetric mask first.

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

    # Polarimetric hail signature (Phase 19). None if the radar
    # doesn't have dual-pol fields (shouldn't happen on modern WSR-88D
    # but we handle gracefully).
    hail_signature_mask = _polarimetric_hail_mask(radar)
    has_polarimetric = hail_signature_mask is not None
    if not has_polarimetric:
        log.warning("nexrad_no_polarimetric", station=station,
                    note="Falling back to dBZ-only hail estimate")

    # Mask out NaN / fill values and apply the convective-core threshold
    if hasattr(refl_field, "mask"):
        above = (refl_field.filled(-9999.0) > SCIT_CELL_THRESHOLD_DBZ)
    else:
        above = (refl_field > SCIT_CELL_THRESHOLD_DBZ)

    # Reshape hail_signature_mask if needed to match the refl grid.
    # composite_reflectivity uses the lowest sweep's az/range; the
    # polarimetric mask should already match because we use the same
    # base sweep. But sweep ray-counts can differ slightly.
    if has_polarimetric and hail_signature_mask.shape != above.shape:
        # Truncate to common rectangle
        r = min(hail_signature_mask.shape[0], above.shape[0])
        c = min(hail_signature_mask.shape[1], above.shape[1])
        hail_signature_mask = hail_signature_mask[:r, :c]
        above = above[:r, :c]
        if hasattr(refl_field, "mask"):
            refl_field = refl_field[:r, :c]
        else:
            refl_field = refl_field[:r, :c]

    # Connected-components labeling — each connected region is one cell
    labeled, n_cells = ndimage.label(above)
    log.info("nexrad_labels", station=station, n_labels=int(n_cells),
             gates_above_threshold=int(above.sum()),
             polarimetric=has_polarimetric)

    if n_cells == 0:
        return TrackedScan(station=station, timestamp=timestamp, cells=[])

    # Gate-center coordinates in WGS84
    lats = np.asarray(composite_radar.gate_latitude["data"])
    lons = np.asarray(composite_radar.gate_longitude["data"])
    if lats.shape != labeled.shape:
        # Truncate to match the labeled grid (from prior reshape)
        r, c = labeled.shape
        lats = lats[:r, :c]
        lons = lons[:r, :c]

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

        # Phase 19: refine the hail-size estimate via polarimetrics.
        hail_confirmed = False
        hail_gate_fraction = 0.0
        if has_polarimetric:
            cell_hail_sig = hail_signature_mask & cell_mask
            n_hail_gates = int(cell_hail_sig.sum())
            hail_gate_fraction = n_hail_gates / float(gate_count)
            if hail_gate_fraction >= HAIL_CONFIRMATION_FRACTION:
                hail_confirmed = True
                # Peak dBZ taken from hail-classified gates only
                hail_dbz_vals = refl_field[cell_hail_sig]
                if hasattr(hail_dbz_vals, "compressed"):
                    hail_dbz_vals = hail_dbz_vals.compressed()
                if len(hail_dbz_vals) > 0:
                    peak_dbz = float(np.max(hail_dbz_vals))

        # When polarimetrics deny the hail signature for a cell that
        # otherwise has high dBZ, we still produce a cell record
        # (heavy rain is also worth knowing about for the map) but we
        # cap the hail-size estimate at penny-tier so we don't claim
        # softballs based on rain reflectivity.
        if has_polarimetric and not hail_confirmed:
            hail_size = min(_dbz_to_hail_size_in(peak_dbz), 1.0)
        else:
            hail_size = _dbz_to_hail_size_in(peak_dbz)

        cells.append(NexradCell(
            station=station,
            timestamp=timestamp,
            centroid=footprint.centroid,
            footprint=MultiPolygon([footprint]),
            peak_dbz=peak_dbz,
            estimated_hail_size_in=hail_size,
            hail_confirmed=hail_confirmed,
            hail_gate_fraction=hail_gate_fraction,
        ))

    log.info("nexrad_cells", station=station, ts=timestamp.isoformat(),
             cells=len(cells),
             confirmed=sum(1 for c in cells if c.hail_confirmed),
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
