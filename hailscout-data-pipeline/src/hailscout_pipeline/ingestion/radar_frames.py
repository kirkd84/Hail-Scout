"""Live MRMS radar frames — download, render to PNG, store, prune.

MRMS publishes a fresh CONUS grid for each product every ~2 minutes.
This module turns the newest grid into a small PNG with alpha that the
API hands straight to MapLibre as an `image` source:

    reflectivity — MergedReflectivityComposite_00.50, "where the storm is"
    posh         — POSH_00.50, "hail is likely here"
    mesh         — MESH_00.50, "hail is falling here, this big"

Frames are immutable and short-lived. Row ids are deterministic from
(product, valid_time), so re-running overwrites instead of duplicating,
and anything older than RADAR_FRAME_RETENTION_H (default 3h) is deleted
on every pass — the table is a rolling buffer, not an archive.

Nothing here may raise into the live loop: a NOAA outage has to degrade
to "no new frames", never to a dead worker. Every per-product failure is
caught and logged, and a product with nothing above its threshold stores
an empty (fully transparent) frame rather than inventing coverage.

Schema mirrors hailscout-api migration 027 / db/models/radar.py.
"""
from __future__ import annotations

import os
import re
import struct
import zlib
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import sqlalchemy as sa
import structlog
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from hailscout_pipeline.config import settings
from hailscout_pipeline.db.session import SessionLocal
from hailscout_pipeline.ingestion.grib_to_geotiff import MeshGrid, parse_mesh_grib
from hailscout_pipeline.ingestion.mrms_client import MRMSClient
from hailscout_pipeline.ingestion.radar_ramps import (
    MESH_RAMP,
    POSH_RAMP,
    REFLECTIVITY_RAMP,
    RampStop,
    colorize,
)

log = structlog.get_logger()


MM_PER_INCH = 25.4

# A CONUS MRMS grid is 7000x3500 at 0.01°. Nobody is inspecting individual
# kilometres on a phone, and a full-resolution RGBA frame is ~98MB before
# compression, so block-reduce down to roughly this width (factor 4 →
# 1750x875, ~4km pixels). Reduction is by MAX, not mean: averaging melts
# a small hot core into its calm surroundings, which is exactly the pixel
# a roofer cares about.
FRAME_MAX_WIDTH = 1800

# Rolling retention. Frames exist to animate the last couple of hours;
# the storm/swath tables are what carry history.
DEFAULT_RETENTION_H = 3

# zlib level for the PNG. Level 6 encodes a CONUS frame in ~40ms and the
# stepped palette does the real compression work; 9 buys ~10% for 4x the CPU.
PNG_COMPRESS_LEVEL = 6

# MRMS filenames: MRMS_<PRODUCT>_<YYYYMMDD>-<HHMMSS>.grib2[.gz].
# Deliberately looser than mrms_client.MESH_PATTERN, which is MESH-only.
_FILENAME_RE = re.compile(r"_(?P<date>\d{8})-(?P<time>\d{6})\.grib2(?:\.gz)?$")


@dataclass(frozen=True)
class ProductSpec:
    """One renderable MRMS product."""

    product: str  # our id, also the API's ?product= value
    s3_product: str  # bucket path segment under CONUS/
    ramp: Sequence[RampStop]
    unit: str  # native unit, for logs and peak_value
    # parse_mesh_grib divides the raw grid by 25.4 because MESH is in
    # millimetres. POSH is a percentage and reflectivity is dBZ, so both
    # get multiplied back to recover their native values. The parser's
    # MAX_PLAUSIBLE_INCHES artifact clamp sits at 6" = 152.4 native units,
    # comfortably above 100% and above any real dBZ, so it's a no-op here.
    native_scale: float

    @property
    def min_value(self) -> float:
        """Threshold below which a pixel renders as nothing."""
        return self.ramp[0].threshold


PRODUCTS: dict[str, ProductSpec] = {
    "reflectivity": ProductSpec(
        product="reflectivity",
        s3_product="MergedReflectivityComposite_00.50",
        ramp=REFLECTIVITY_RAMP,
        unit="dBZ",
        native_scale=MM_PER_INCH,
    ),
    "posh": ProductSpec(
        product="posh",
        s3_product="POSH_00.50",
        ramp=POSH_RAMP,
        unit="%",
        native_scale=MM_PER_INCH,
    ),
    "mesh": ProductSpec(
        product="mesh",
        s3_product="MESH_00.50",
        ramp=MESH_RAMP,
        unit="in",
        native_scale=1.0,
    ),
}

# Render order = draw order in the client: context underneath, hail on top.
DEFAULT_PRODUCTS: tuple[str, ...] = ("reflectivity", "posh", "mesh")


# ----- table -----
# Declared here against a private MetaData rather than joining the Base in
# db/models.py: this is the only table the radar path touches, and keeping
# it off the shared Base means nothing that reflects or creates the
# pipeline's metadata can take ownership of an API-owned table. Columns
# mirror the API's migration 027 exactly (created_at is left to its
# server default).
_metadata = sa.MetaData()

radar_frames_table = sa.Table(
    "radar_frames",
    _metadata,
    sa.Column("id", sa.String(255), primary_key=True),
    sa.Column("product", sa.String(32), nullable=False),
    sa.Column("valid_time", sa.DateTime(timezone=True), nullable=False),
    sa.Column("min_lat", sa.Float, nullable=False),
    sa.Column("min_lng", sa.Float, nullable=False),
    sa.Column("max_lat", sa.Float, nullable=False),
    sa.Column("max_lng", sa.Float, nullable=False),
    sa.Column("width", sa.Integer, nullable=False),
    sa.Column("height", sa.Integer, nullable=False),
    sa.Column("peak_value", sa.Float, nullable=True),
    sa.Column("png", sa.LargeBinary, nullable=False),
)


@dataclass
class RenderedFrame:
    """A product grid rendered to a PNG, ready to store."""

    png: bytes
    width: int
    height: int
    min_lat: float
    min_lng: float
    max_lat: float
    max_lng: float
    peak_value: float | None  # None when nothing cleared the threshold
    covered_px: int


# ----- PNG encoding -----
def _png_chunk(tag: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


def _encode_png(rgba: np.ndarray) -> bytes:
    """Encode an (h, w, 4) uint8 array as a truecolour+alpha PNG.

    Hand-rolled because the worker image has no image library: Pillow
    isn't a dependency, and GDAL's PNG driver is create-copy only, so
    rasterio can't write one without a GeoTIFF round-trip. Encoding a
    stepped-palette raster is a header, one zlib stream and a CRC.

    Scanline filter 0 (None) is intentional. The ramps are stepped, so
    rows are long runs of identical bytes that zlib eats; a delta filter
    would break those runs up and made a busy CONUS test frame ~45%
    LARGER (308KB vs 216KB).
    """
    height, width, _ = rgba.shape
    rows = np.ascontiguousarray(rgba, dtype=np.uint8).reshape(height, width * 4)
    # Each scanline is prefixed with its filter-type byte.
    scanlines = np.concatenate(
        [np.zeros((height, 1), dtype=np.uint8), rows], axis=1
    )
    idat = zlib.compress(scanlines.tobytes(), PNG_COMPRESS_LEVEL)
    # w, h, bit depth 8, colour type 6 (RGBA), deflate, per-scanline
    # filtering (the only filter method PNG defines), no interlace.
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + _png_chunk(b"IHDR", ihdr)
        + _png_chunk(b"IDAT", idat)
        + _png_chunk(b"IEND", b"")
    )


# ----- render -----
def _downsample_max(values: np.ndarray, factor: int) -> np.ndarray:
    """Block-reduce by MAX. Trailing rows/cols that don't fill a block
    are cropped — the caller must derive bounds from the cropped shape."""
    if factor <= 1:
        return values
    height, width = values.shape
    crop_h = (height // factor) * factor
    crop_w = (width // factor) * factor
    block = values[:crop_h, :crop_w].reshape(
        crop_h // factor, factor, crop_w // factor, factor
    )
    return block.max(axis=(1, 3))


def render_frame(spec: ProductSpec, grid: MeshGrid) -> RenderedFrame:
    """Downsample, colourise and PNG-encode one parsed product grid."""
    factor = max(1, -(-grid.width // FRAME_MAX_WIDTH))  # ceil division
    reduced = _downsample_max(grid.values, factor)
    # Scale to native units AFTER the block-max, not before: the scale is
    # positive so it commutes with max, and doing it here multiplies a
    # 1750x875 array instead of allocating a second 98MB full-res copy.
    if spec.native_scale != 1.0:
        reduced = reduced * spec.native_scale
    height, width = reduced.shape

    covered_px = int((reduced >= spec.min_value).sum())
    peak_value = round(float(reduced.max()), 2) if covered_px else None

    rgba = colorize(reduced, spec.ramp)
    png = _encode_png(rgba)

    # parse_mesh_grib's transform origin is the CENTRE of the first pixel
    # (lons[0], lats[0]); an image overlay needs the outer EDGES, so shift
    # out by half a source pixel. Rows run north→south after the parse.
    pixel_x, _, west_c, _, neg_pixel_y, north_c = grid.transform
    pixel_y = -neg_pixel_y
    west = west_c - pixel_x / 2
    north = north_c + pixel_y / 2

    return RenderedFrame(
        png=png,
        width=width,
        height=height,
        min_lng=west,
        max_lng=west + pixel_x * width * factor,
        max_lat=north,
        min_lat=north - pixel_y * height * factor,
        peak_value=peak_value,
        covered_px=covered_px,
    )


# ----- source discovery -----
def frame_id(product: str, valid_time: datetime) -> str:
    """Deterministic, URL-safe id — the API serves /v1/radar/frames/<id>.png."""
    return f"{product}_{valid_time.strftime('%Y%m%dT%H%M%SZ')}"


def _latest_key(client: MRMSClient) -> tuple[str, datetime] | None:
    """Newest object key for the client's product, or None if the bucket
    has nothing for today or yesterday."""
    now = datetime.now(timezone.utc)
    # Today first; only reach back a day when today is still empty, which
    # is just the first minutes after 00Z.
    for day in (now, now - timedelta(days=1)):
        best_key: str | None = None
        best_ts: datetime | None = None
        for key in client.list_keys_for_date(day):
            m = _FILENAME_RE.search(key.rsplit("/", 1)[-1])
            if not m:
                continue
            try:
                ts = datetime.strptime(
                    f"{m['date']}{m['time']}", "%Y%m%d%H%M%S"
                ).replace(tzinfo=timezone.utc)
            except ValueError:
                continue
            if best_ts is None or ts > best_ts:
                best_key, best_ts = key, ts
        if best_key is not None and best_ts is not None:
            return best_key, best_ts
    return None


# ----- persistence -----
def _frame_exists(session: Session, fid: str) -> bool:
    return (
        session.execute(
            sa.select(radar_frames_table.c.id).where(
                radar_frames_table.c.id == fid
            )
        ).first()
        is not None
    )


def upsert_frame(
    session: Session, spec: ProductSpec, valid_time: datetime, frame: RenderedFrame
) -> str:
    """Write one frame, replacing any existing row for the same
    (product, valid_time). Re-rendering a timestamp is idempotent."""
    fid = frame_id(spec.product, valid_time)
    values = {
        "id": fid,
        "product": spec.product,
        "valid_time": valid_time,
        "min_lat": frame.min_lat,
        "min_lng": frame.min_lng,
        "max_lat": frame.max_lat,
        "max_lng": frame.max_lng,
        "width": frame.width,
        "height": frame.height,
        "peak_value": frame.peak_value,
        "png": frame.png,
    }
    stmt = pg_insert(radar_frames_table).values(**values)
    stmt = stmt.on_conflict_do_update(
        constraint="uq_radar_frame_product_time",
        set_={k: v for k, v in values.items() if k != "id"},
    )
    session.execute(stmt)
    session.commit()
    return fid


def prune_frames(session: Session, retention_hours: int) -> int:
    """Delete frames past the retention window. Returns rows removed."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=retention_hours)
    result = session.execute(
        sa.delete(radar_frames_table).where(
            radar_frames_table.c.valid_time < cutoff
        )
    )
    session.commit()
    return int(result.rowcount or 0)


# ----- entry point -----
def _retention_hours() -> int:
    raw = os.environ.get("RADAR_FRAME_RETENTION_H", "").strip()
    if not raw:
        return DEFAULT_RETENTION_H
    try:
        hours = int(raw)
    except ValueError:
        log.warning("radar_retention_invalid", value=raw,
                    using=DEFAULT_RETENTION_H)
        return DEFAULT_RETENTION_H
    return hours if hours > 0 else DEFAULT_RETENTION_H


def ingest_product(session: Session, spec: ProductSpec) -> dict:
    """Fetch + render + store the newest frame for one product.

    Returns a small status dict; raises only on a genuinely unexpected
    error, which `ingest_radar_frames` catches per product.
    """
    client = MRMSClient(
        bucket_name=settings.noaa_mrms_bucket,
        product=spec.s3_product,
    )
    latest = _latest_key(client)
    if latest is None:
        log.warning("radar_no_source_files", product=spec.product,
                    s3_product=spec.s3_product)
        return {"product": spec.product, "status": "no_source"}

    key, valid_time = latest
    fid = frame_id(spec.product, valid_time)
    if _frame_exists(session, fid):
        # The loop ticks at roughly the publish cadence, so landing on a
        # timestamp we already rendered is normal — skip the download.
        log.info("radar_frame_current", product=spec.product, id=fid)
        return {"product": spec.product, "status": "current", "id": fid}

    grib_path, _key, _ts = client.download_key(key, valid_time)
    try:
        grid = parse_mesh_grib(grib_path, valid_time)
    finally:
        Path(grib_path).unlink(missing_ok=True)

    frame = render_frame(spec, grid)
    upsert_frame(session, spec, valid_time, frame)
    log.info(
        "radar_frame_stored",
        product=spec.product,
        id=fid,
        valid_time=valid_time.isoformat(),
        size=f"{frame.width}x{frame.height}",
        png_kb=round(len(frame.png) / 1024, 1),
        covered_px=frame.covered_px,
        peak=frame.peak_value,
        unit=spec.unit,
    )
    return {"product": spec.product, "status": "stored", "id": fid}


def ingest_radar_frames(
    products: Sequence[str] | None = None,
    retention_hours: int | None = None,
) -> dict:
    """Render the newest frame for each product, then prune old ones.

    One S3 listing and at most one download per product. Per-product
    failures are logged and skipped so a single bad product (or a NOAA
    outage) can't cost us the others — or the worker.
    """
    names = list(products) if products else list(DEFAULT_PRODUCTS)
    retention = retention_hours if retention_hours is not None else _retention_hours()

    stored = current = failed = 0
    with SessionLocal() as session:
        for name in names:
            spec = PRODUCTS.get(name)
            if spec is None:
                log.warning("radar_unknown_product", product=name,
                            known=list(PRODUCTS))
                failed += 1
                continue
            try:
                result = ingest_product(session, spec)
            except Exception as e:  # noqa: BLE001 — never kill the caller
                failed += 1
                # Roll back so one product's failure can't poison the
                # session for the products behind it.
                try:
                    session.rollback()
                except Exception:
                    pass
                log.warning("radar_product_failed", product=name, error=str(e))
                continue
            if result["status"] == "stored":
                stored += 1
            elif result["status"] == "current":
                current += 1
            else:
                failed += 1

        try:
            pruned = prune_frames(session, retention)
        except Exception as e:  # noqa: BLE001
            try:
                session.rollback()
            except Exception:
                pass
            log.warning("radar_prune_failed", error=str(e))
            pruned = 0

    return {
        "stored": stored,
        "current": current,
        "failed": failed,
        "pruned": pruned,
        "retention_hours": retention,
    }
