"""Parse MRMS MESH GRIB2 → in-memory raster grid (in inches).

GRIB2 format: NOAA MRMS MESH product, ~7000×3500 grid covering CONUS at
0.01° (~1 km) resolution. Values are hail size in millimeters.
"""
from __future__ import annotations
import gzip
import shutil
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from tempfile import gettempdir

import numpy as np
import structlog
import xarray as xr

log = structlog.get_logger()


@dataclass
class MeshGrid:
    """Parsed MESH grid in physical units (inches)."""
    values: np.ndarray  # (height, width), float32, hail size in INCHES
    transform: tuple[float, float, float, float, float, float]
    crs: str
    timestamp: datetime
    width: int
    height: int

    @property
    def bounds(self) -> tuple[float, float, float, float]:
        """(min_lon, min_lat, max_lon, max_lat) in WGS84."""
        a, _b, c, _d, e, f = self.transform
        west = c
        north = f
        east = c + a * self.width
        south = f + e * self.height
        return (west, min(south, north), east, max(south, north))


def _maybe_gunzip(path: str) -> str:
    p = Path(path)
    if p.suffix != ".gz":
        return path
    out = Path(gettempdir()) / p.with_suffix("").name
    with gzip.open(p, "rb") as src, open(out, "wb") as dst:
        shutil.copyfileobj(src, dst)
    log.info("gunzipped", src=str(p), dst=str(out), size=out.stat().st_size)
    return str(out)


def parse_mesh_grib(grib_path: str, timestamp: datetime) -> MeshGrid:
    """Parse a NOAA MRMS MESH GRIB2 file into a MeshGrid (inches)."""
    grib_path = _maybe_gunzip(grib_path)
    log.info("grib_open", path=grib_path)

    ds = xr.open_dataset(grib_path, engine="cfgrib",
                         backend_kwargs={"indexpath": ""})

    var_names = list(ds.data_vars)
    if not var_names:
        raise RuntimeError(f"No data variables in GRIB2: {grib_path}")
    var = ds[var_names[0]]
    log.info("grib_variable", name=var_names[0], shape=tuple(var.shape))

    # mm → inches; sentinel negatives → 0
    arr = np.asarray(var.values, dtype=np.float32) / 25.4
    arr = np.where(arr < 0, 0.0, arr)

    lats = np.asarray(ds["latitude"].values)
    lons = np.asarray(ds["longitude"].values)

    # 0..360 → -180..180 (and reorder)
    if lons.max() > 180:
        lons = np.where(lons > 180, lons - 360, lons)
        order = np.argsort(lons)
        lons = lons[order]
        arr = arr[:, order]

    # Latitude must descend (north → south) for "north up" raster
    if lats[0] < lats[-1]:
        lats = lats[::-1]
        arr = arr[::-1, :]

    pixel_x = float(lons[1] - lons[0])
    pixel_y = float(lats[0] - lats[1])  # positive
    transform = (pixel_x, 0.0, float(lons[0]),
                 0.0, -pixel_y, float(lats[0]))
    height, width = arr.shape

    log.info("grib_parsed", shape=(height, width),
             pixel_deg=pixel_x,
             max_inches=float(arr.max()),
             nonzero_pct=float((arr > 0).mean() * 100))

    return MeshGrid(values=arr, transform=transform, crs="EPSG:4326",
                    timestamp=timestamp, width=width, height=height)


def write_geotiff(grid: MeshGrid, out_path: str) -> str:
    """Optional: write MeshGrid as GeoTIFF for debugging."""
    import rasterio
    from rasterio.transform import Affine

    a, b, c, d, e, f = grid.transform
    transform = Affine(a, b, c, d, e, f)
    with rasterio.open(
        out_path, "w", driver="GTiff",
        height=grid.height, width=grid.width, count=1, dtype="float32",
        crs=grid.crs, transform=transform,
        compress="deflate", predictor=2,
    ) as dst:
        dst.write(grid.values, 1)
    log.info("geotiff_written", path=out_path)
    return out_path
