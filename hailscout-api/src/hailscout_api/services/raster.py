"""Smooth hail-swath raster rendering.

Phase 25 — beat the blobs. HailStrike / Interactive Hail Maps render a
continuous interpolated intensity surface; we were rendering 8 discrete
polygon bands that read as chunky blobs.

This module turns a storm's accumulated swath bands into a smooth
colorized raster, server-side:

  1. Burn each size band (smallest first, so larger sits on top) into a
     single-channel value image at the band's size in inches.
  2. Gaussian-blur the value image — this bridges the hard 0.25" band
     steps into a continuous gradient (the key to the smooth look).
  3. Map values through a hail color ramp → RGBA, with alpha rising
     with size and fully transparent below the smallest band.
  4. Encode PNG. The caller pairs it with geographic bounds so the web
     renders it as a MapLibre image/raster source with linear
     resampling (smooth on zoom).

Only dependency beyond the existing stack is Pillow (PIL) — small, and
it does the fill, blur, and PNG encode without rasterio/scipy.
"""

from __future__ import annotations

import io
import math
from dataclasses import dataclass
from typing import Any, Iterable

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from hailscout_api.core import get_logger

logger = get_logger(__name__)


# Target raster width in pixels. Height derives from the bbox aspect.
# 768 is plenty for a single storm — the blur + linear resampling carry
# the smoothness, so we don't need a huge image.
_TARGET_WIDTH = 768
_MAX_DIM = 1024
_MIN_DIM = 64

# Blur radius as a fraction of the raster's smaller dimension. This is
# what melts the band stair-steps into a gradient; tuned so a typical
# storm reads smooth without washing out the core.
_BLUR_FRAC = 0.012
_BLUR_MIN_PX = 2.0

# Pad the bbox so the blurred edge has room to fade to transparent
# instead of getting clipped at the image border.
_PAD_FRAC = 0.06

# Max size the 8-bit value channel represents. 4.0" comfortably exceeds
# the post-QC plausible ceiling, so the channel never saturates on real
# hail while keeping good resolution across the meaningful range.
_SCALE_MAX_IN = 4.0


# Continuous hail color ramp (inches → RGB). Anchored to the same
# 8-bin palette the rest of the app uses, but interpolated. Tuned to
# out-read IHM's yellow→red: pale gold at the low end, deep magenta core.
_RAMP: list[tuple[float, tuple[int, int, int]]] = [
    (0.75, (255, 242, 174)),   # pale gold
    (1.00, (255, 214, 102)),   # gold
    (1.25, (255, 173, 51)),    # amber
    (1.50, (255, 122, 41)),    # orange
    (1.75, (242, 74, 41)),     # deep orange
    (2.00, (214, 40, 57)),     # red
    (2.50, (171, 31, 99)),     # crimson
    (3.00, (124, 39, 148)),    # magenta-purple core
]


@dataclass
class StormRaster:
    png_bytes: bytes
    min_lng: float
    min_lat: float
    max_lng: float
    max_lat: float
    width: int
    height: int
    peak_in: float

    def bounds_lnglat(self) -> list[list[float]]:
        """MapLibre image-source coordinates: [TL, TR, BR, BL] as lng,lat."""
        return [
            [self.min_lng, self.max_lat],
            [self.max_lng, self.max_lat],
            [self.max_lng, self.min_lat],
            [self.min_lng, self.min_lat],
        ]


def _lerp(a: int, b: int, t: float) -> int:
    return int(round(a + (b - a) * t))


def _color_for(inches: float) -> tuple[int, int, int, int]:
    """Map a hail size (inches) to RGBA via the ramp. Alpha rises with
    size; below the smallest stop it's fully transparent."""
    if inches < _RAMP[0][0]:
        return (0, 0, 0, 0)
    # Clamp to top
    if inches >= _RAMP[-1][0]:
        r, g, b = _RAMP[-1][1]
        return (r, g, b, 235)
    for i in range(len(_RAMP) - 1):
        lo_v, lo_c = _RAMP[i]
        hi_v, hi_c = _RAMP[i + 1]
        if lo_v <= inches < hi_v:
            t = (inches - lo_v) / (hi_v - lo_v)
            r = _lerp(lo_c[0], hi_c[0], t)
            g = _lerp(lo_c[1], hi_c[1], t)
            b = _lerp(lo_c[2], hi_c[2], t)
            # Alpha 150 → 235 across the size range for a glow that
            # intensifies with severity.
            frac = (inches - _RAMP[0][0]) / (_RAMP[-1][0] - _RAMP[0][0])
            a = int(150 + 85 * max(0.0, min(1.0, frac)))
            return (r, g, b, a)
    return (0, 0, 0, 0)


def _build_lut() -> "np.ndarray":
    """Precompute a (256, 4) uint8 RGBA lookup table for the 8-bit value
    channel, where channel v maps to size (v/255)*_SCALE_MAX_IN inches."""
    lut = np.zeros((256, 4), dtype=np.uint8)
    for v in range(256):
        lut[v] = _color_for(v / 255.0 * _SCALE_MAX_IN)
    return lut


def _cat_to_inches(label: str) -> float:
    try:
        return float(str(label).rstrip("+"))
    except (ValueError, AttributeError):
        return 0.0


def _iter_polys(geometry: dict[str, Any]) -> Iterable[list[list[float]]]:
    """Yield exterior rings (list of [lng,lat]) from a GeoJSON
    Polygon or MultiPolygon. Interior holes are ignored — at hail-swath
    scale they're visually negligible and add complexity."""
    if not geometry:
        return
    gtype = geometry.get("type")
    coords = geometry.get("coordinates")
    if gtype == "Polygon":
        if coords:
            yield coords[0]
    elif gtype == "MultiPolygon":
        for poly in coords or []:
            if poly:
                yield poly[0]


def render_storm_raster(
    swaths: list[dict[str, Any]],
    bbox: tuple[float, float, float, float],
) -> StormRaster | None:
    """Render a smooth colorized PNG from a storm's swath bands.

    `swaths`: list of {hail_size_category, geometry(GeoJSON)} dicts.
    `bbox`: (min_lng, min_lat, max_lng, max_lat) — the storm bounds.
    Returns None if there's nothing renderable.
    """
    bands = [
        (_cat_to_inches(s["hail_size_category"]), s.get("geometry"))
        for s in swaths
        if s.get("geometry")
    ]
    bands = [(v, g) for v, g in bands if v > 0]
    if not bands:
        return None
    bands.sort(key=lambda x: x[0])  # smallest first → largest drawn on top

    min_lng, min_lat, max_lng, max_lat = bbox
    span_lng = max(max_lng - min_lng, 1e-4)
    span_lat = max(max_lat - min_lat, 1e-4)
    pad_lng = span_lng * _PAD_FRAC
    pad_lat = span_lat * _PAD_FRAC
    min_lng -= pad_lng
    max_lng += pad_lng
    min_lat -= pad_lat
    max_lat += pad_lat
    span_lng = max_lng - min_lng
    span_lat = max_lat - min_lat

    # Pixel dims from aspect (account for latitude compression so the
    # raster isn't stretched).
    mid_lat = (min_lat + max_lat) / 2.0
    aspect = (span_lng * math.cos(math.radians(mid_lat))) / span_lat
    width = _TARGET_WIDTH
    height = int(round(width / aspect)) if aspect > 0 else _TARGET_WIDTH
    width = max(_MIN_DIM, min(_MAX_DIM, width))
    height = max(_MIN_DIM, min(_MAX_DIM, height))

    def to_px(lng: float, lat: float) -> tuple[float, float]:
        x = (lng - min_lng) / span_lng * width
        y = (max_lat - lat) / span_lat * height  # north at top
        return (x, y)

    # 1. Burn band values into an 8-bit 'L' image. Size is scaled to
    #    0-255 over [0, _SCALE_MAX_IN] so an 8-bit channel (which PIL
    #    can Gaussian-blur reliably, unlike 32-bit 'I') holds it.
    value_img = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(value_img)
    peak = 0.0
    for inches, geom in bands:
        peak = max(peak, inches)
        fill_val = max(0, min(255, int(round(inches / _SCALE_MAX_IN * 255))))
        for ring in _iter_polys(geom):
            pts = [to_px(c[0], c[1]) for c in ring if len(c) >= 2]
            if len(pts) >= 3:
                draw.polygon(pts, fill=fill_val)

    # 2. Gaussian blur to melt the band steps into a gradient.
    blur_px = max(_BLUR_MIN_PX, min(width, height) * _BLUR_FRAC)
    value_img = value_img.filter(ImageFilter.GaussianBlur(radius=blur_px))

    # 3. Colorize → RGBA, vectorized via a precomputed 256-entry LUT.
    #    Far faster than a per-pixel Python loop on a ~768×500 image.
    lut = _build_lut()  # (256, 4) uint8
    vals = np.asarray(value_img, dtype=np.uint8)
    rgba = lut[vals]  # (h, w, 4) uint8
    out = Image.fromarray(rgba, mode="RGBA")

    buf = io.BytesIO()
    out.save(buf, format="PNG", optimize=True)
    logger.info("storm_raster_rendered", width=width, height=height,
                bands=len(bands), peak_in=peak, blur_px=round(blur_px, 1))
    return StormRaster(
        png_bytes=buf.getvalue(),
        min_lng=min_lng, min_lat=min_lat, max_lng=max_lng, max_lat=max_lat,
        width=width, height=height, peak_in=peak,
    )
