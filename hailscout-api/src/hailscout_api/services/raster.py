"""Smooth hail-swath raster rendering.

Phase 25 — beat the blobs. HailStrike / Interactive Hail Maps render a
continuous interpolated intensity surface; we were rendering 8 discrete
polygon bands that read as chunky blobs.

This module turns a storm's accumulated swath bands into a smooth
colorized raster, server-side:

  1. Burn each size band (smallest first, so larger sits on top) into a
     single-channel value image at the band's size in inches.
  2. BRIDGE + close: a LARGE morphological close (dilate→erode) links
     neighboring cell blobs into one continuous swath ribbon — the
     "show the full path" fix that turns a string of pale beads into a
     connected storm track — then a small close fills pinholes inside
     severe cores. Erode-back keeps cores at their true size.
  3. PEAK-PRESERVING smoothing: the value surface is the per-pixel MAX
     of a dilated medium blur (keeps small severe cores from averaging
     below the 0.75" color floor — the old "washed-out dots" failure)
     and a DOWN-WEIGHTED wide blur (just an organic feathered rim). The
     wide blur at full strength bled every swath into a broad pale halo
     — the "amorphous cloud" look, worst once many storms overlapped —
     so the bridge/close above now does the gap-linking instead.
  4. Map values through a hail color ramp → RGBA. Alpha feathers in just
     BELOW the smallest band (0.60") instead of all the way down at
     0.30", and at a higher base alpha, so a swath reads as a confident
     IHM-style ribbon with organic edges rather than a faint wash.
  5. Encode PNG. The caller pairs it with geographic bounds so the web
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
from PIL import Image, ImageChops, ImageDraw, ImageFilter

from hailscout_api.core import get_logger

logger = get_logger(__name__)


# Target raster width in pixels. Height derives from the bbox aspect.
# Per-storm rasters default lower; the viewport endpoint passes the
# client's screen-derived width (up to _MAX_DIM).
_TARGET_WIDTH = 1024
_MAX_DIM = 2048
_MIN_DIM = 64

# Smoothing parameters in GROUND KILOMETERS — zoom-invariant by design.
# (Earlier versions sized these as fractions of the image, so every zoom
# level smoothed by a different number of ground-km and the swath SHAPE
# visibly morphed as you zoomed. Now the shaping math always happens at
# a fixed ground resolution, so a storm keeps one shape at every zoom.)
#   bridge — LARGE morphological close (dilate→erode) that links the
#            cells of one storm track into a continuous ribbon WITHOUT
#            fading them. Small enough to never weld separate storms.
#   close  — pinhole fill inside severe cores.
#   dilate — pre-grows cells so the blur can't average small severe
#            cores below the color floor.
#   medium — melts band stair-steps + raw ~1km pixels into a gradient.
#   wide   — soft outer skirt, DOWN-WEIGHTED (see _WIDE_WEIGHT).
_BRIDGE_KM = 3.0
_CLOSE_KM = 1.2
_DILATE_KM = 1.7
_BLUR_MED_KM = 1.8
_BLUR_WIDE_KM = 4.5

# The wide skirt is composited into the max-of-scales at this weight. At
# full strength (1.0) it bled every swath into a faint cloud that tinted
# huge areas of the basemap; ~0.30 keeps an organic feathered edge while
# the bridge/close keeps the swath body solid and confident.
_WIDE_WEIGHT = 0.30

# Fixed ground resolution for the shaping math. When the OUTPUT raster is
# finer than this (city zoom), polygons are burned + smoothed on a
# 250 m/px grid and the finished field is upscaled bilinearly — identical
# shape at every zoom, and morphology cost stays bounded no matter how
# deep the client zooms. Coarser outputs (state/CONUS zoom) process at
# their own resolution; the km radii shrink below one pixel there, which
# degrades gracefully to the honest discrete-dots look.
_PROC_KM_PER_PX = 0.25

# Pad the bbox so the blurred edge has room to fade to transparent
# instead of getting clipped at the image border.
_PAD_FRAC = 0.06

# Max size the 8-bit value channel represents. 4.0" comfortably exceeds
# the post-QC plausible ceiling, so the channel never saturates on real
# hail while keeping good resolution across the meaningful range.
_SCALE_MAX_IN = 4.0

# Alpha feather: fully transparent below _FEATHER_START_IN, ramping up
# to _ALPHA_AT_BASE at the smallest ramp stop (0.75"), then rising to
# _ALPHA_MAX at the top of the ramp. The feather now starts at 0.60"
# (just below the 0.75" base), not 0.30": the old wide feather painted a
# broad low-alpha halo far beyond the real swath, which read as a pale
# cloud (and stacked into a wash once storms overlapped). A higher base
# alpha makes a single swath read confidently instead of washing out,
# while still fading the rim organically rather than a cookie-cutter cut.
_FEATHER_START_IN = 0.60
_ALPHA_AT_BASE = 190
_ALPHA_MAX = 255


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


def _rgb_for(inches: float) -> tuple[int, int, int]:
    """RGB from the ramp; clamps below to the first stop's color (the
    feathered fringe wears the palest swath color, never a new hue)."""
    if inches <= _RAMP[0][0]:
        return _RAMP[0][1]
    if inches >= _RAMP[-1][0]:
        return _RAMP[-1][1]
    for i in range(len(_RAMP) - 1):
        lo_v, lo_c = _RAMP[i]
        hi_v, hi_c = _RAMP[i + 1]
        if lo_v <= inches < hi_v:
            t = (inches - lo_v) / (hi_v - lo_v)
            return (
                _lerp(lo_c[0], hi_c[0], t),
                _lerp(lo_c[1], hi_c[1], t),
                _lerp(lo_c[2], hi_c[2], t),
            )
    return _RAMP[-1][1]


def _color_for(inches: float) -> tuple[int, int, int, int]:
    """RGBA for a hail size. Alpha feathers in from _FEATHER_START_IN,
    reaches _ALPHA_AT_BASE at the smallest band, and climbs with
    severity to _ALPHA_MAX."""
    if inches < _FEATHER_START_IN:
        return (0, 0, 0, 0)
    base = _RAMP[0][0]
    r, g, b = _rgb_for(inches)
    if inches < base:
        t = (inches - _FEATHER_START_IN) / (base - _FEATHER_START_IN)
        # Smoothstep so the fade eases in instead of ramping linearly.
        t = t * t * (3 - 2 * t)
        return (r, g, b, int(round(_ALPHA_AT_BASE * t)))
    frac = (inches - base) / (_RAMP[-1][0] - base)
    frac = max(0.0, min(1.0, frac))
    a = int(round(_ALPHA_AT_BASE + (_ALPHA_MAX - _ALPHA_AT_BASE) * frac))
    return (r, g, b, a)


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
    *,
    pad: bool = True,
    target_width: int = _TARGET_WIDTH,
) -> StormRaster | None:
    """Render a smooth colorized PNG from swath bands.

    `swaths`: list of {hail_size_category, geometry(GeoJSON)} dicts.
      Can be one storm's bands (storm raster) or every storm's bands in
      a viewport (viewport raster) — they all burn into one surface.
    `bbox`: (min_lng, min_lat, max_lng, max_lat).
    `pad`: True for a single-storm raster (feathered margin); False for a
      viewport raster, where the image must align exactly to the map
      bounds passed in.
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
    if pad:
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
    width = max(_MIN_DIM, min(_MAX_DIM, target_width))
    height = int(round(width / aspect)) if aspect > 0 else width
    height = max(_MIN_DIM, min(_MAX_DIM, height))

    # Ground scale of the OUTPUT raster (km per pixel, latitude axis; the
    # aspect math above keeps pixels near-square on the ground).
    km_per_px_out = max(1e-6, (span_lat * 111.0) / float(height))

    # PROCESSING grid — the zoom-invariance core. All burning + morphology
    # + blurring happens at a fixed ~250 m/px ground resolution whenever
    # the output is finer than that, and the finished smooth field is
    # upscaled to the output size at the end. Same ground grid → same
    # shape at every zoom (and bounded morphology cost at deep zooms).
    if km_per_px_out < _PROC_KM_PER_PX:
        proc_h = max(_MIN_DIM, int(math.ceil((span_lat * 111.0) / _PROC_KM_PER_PX)))
        proc_w = max(_MIN_DIM, int(round(proc_h * (width / float(height)))))
    else:
        proc_w, proc_h = width, height
    km_per_px = max(1e-6, (span_lat * 111.0) / float(proc_h))

    def to_px(lng: float, lat: float) -> tuple[float, float]:
        x = (lng - min_lng) / span_lng * proc_w
        y = (max_lat - lat) / span_lat * proc_h  # north at top
        return (x, y)

    # 1. Burn band values into an 8-bit 'L' image. Size is scaled to
    #    0-255 over [0, _SCALE_MAX_IN] so an 8-bit channel (which PIL
    #    can Gaussian-blur reliably, unlike 32-bit 'I') holds it.
    value_img = Image.new("L", (proc_w, proc_h), 0)
    draw = ImageDraw.Draw(value_img)
    peak = 0.0
    for inches, geom in bands:
        peak = max(peak, inches)
        fill_val = max(0, min(255, int(round(inches / _SCALE_MAX_IN * 255))))
        for ring in _iter_polys(geom):
            pts = [to_px(c[0], c[1]) for c in ring if len(c) >= 2]
            if len(pts) >= 3:
                draw.polygon(pts, fill=fill_val)

    def _km_px(km: float) -> float:
        """Ground kilometers → processing-grid pixels."""
        return km / km_per_px

    # 2a. BRIDGE pass — a LARGE morphological close (dilate then erode)
    #    that LINKS neighboring cell blobs into one continuous swath
    #    ribbon. Unlike a blur it joins the cells WITHOUT fading them;
    #    the erode-back step keeps cores at their true size. ~3 km bridges
    #    within-track gaps, never separate storms.
    bridge_r = int(round(_km_px(_BRIDGE_KM)))
    for _ in range(bridge_r):
        value_img = value_img.filter(ImageFilter.MaxFilter(3))
    for _ in range(bridge_r):
        value_img = value_img.filter(ImageFilter.MinFilter(3))

    # 2b. Small CLOSE to fill the transparent pinholes the raw swath
    #    polygons leave inside a severe core (cone-of-silence, beam
    #    blockage, inter-cell gaps).
    close_r = int(round(_km_px(_CLOSE_KM)))
    for _ in range(close_r):
        value_img = value_img.filter(ImageFilter.MaxFilter(3))
    for _ in range(close_r):
        value_img = value_img.filter(ImageFilter.MinFilter(3))

    # 3. Peak-preserving smoothing, two layers max-composited:
    #    CORE  = blur(dilate(img)) — the dilation pre-grows every cell so
    #            the blur can't average small severe cores down below the
    #            color floor (the old washed-out-dots failure), and the
    #            blur rounds the grown ~1km pixel squares into organic
    #            blobs while melting band steps into gradients.
    #    SKIRT = wide blur of the raw image, DOWN-WEIGHTED to _WIDE_WEIGHT
    #            — just an organic feathered rim.
    #    Px floors keep storms visible as soft dots at coarse zooms where
    #    the km radii fall below one pixel.
    d = max(1, int(round(_km_px(_DILATE_KM))))
    r_med = max(1.0, _km_px(_BLUR_MED_KM))
    r_wide = max(1.5, _km_px(_BLUR_WIDE_KM))
    core = value_img
    for _ in range(d):
        core = core.filter(ImageFilter.MaxFilter(3))
    core = core.filter(ImageFilter.GaussianBlur(radius=r_med))
    skirt = value_img.filter(ImageFilter.GaussianBlur(radius=r_wide))
    if _WIDE_WEIGHT < 1.0:
        skirt = skirt.point(lambda v: int(v * _WIDE_WEIGHT))
    value_img = ImageChops.lighter(core, skirt)

    # 3b. Upscale the finished smooth field to the requested output size.
    #    Bilinear on an already-smooth gradient adds no artifacts, and it
    #    guarantees the SHAPE the client sees is the 250 m/px one at
    #    every zoom level.
    if (proc_w, proc_h) != (width, height):
        value_img = value_img.resize((width, height), Image.BILINEAR)

    # 4. Colorize → RGBA, vectorized via a precomputed 256-entry LUT.
    #    Far faster than a per-pixel Python loop.
    lut = _build_lut()  # (256, 4) uint8
    vals = np.asarray(value_img, dtype=np.uint8)
    rgba = lut[vals]  # (h, w, 4) uint8
    out = Image.fromarray(rgba, mode="RGBA")

    buf = io.BytesIO()
    # No `optimize` — at up to 2048px it costs hundreds of ms for a few
    # percent size win; the image is mostly transparent and compresses
    # well at the default level anyway.
    out.save(buf, format="PNG", compress_level=6)
    logger.info("storm_raster_rendered", width=width, height=height,
                bands=len(bands), peak_in=peak,
                smooth_px=(d, round(r_med, 1), round(r_wide, 1)))
    return StormRaster(
        png_bytes=buf.getvalue(),
        min_lng=min_lng, min_lat=min_lat, max_lng=max_lng, max_lat=max_lat,
        width=width, height=height, peak_in=peak,
    )
