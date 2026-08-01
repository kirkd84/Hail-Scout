"""Colour ramps for the live radar frames.

A roofer reads these images, not a meteorologist, so each ramp answers a
plain-language question instead of showing a physical scale:

    mesh         — "hail is falling here, THIS big"  (the hero layer)
    posh         — "hail is likely here"             (amber wash)
    reflectivity — "the storm is over there"         (muted background)

The mesh ramp mirrors `BINS` in hailscout-web/src/lib/hail.ts (the same
palette the mobile MapScreen uses) colour-for-colour — the legend beside
the map has to match the pixels on it. Keep the two in sync if either moves.

Ramps are STEPPED, not interpolated. Three reasons: radar products have
always been read as discrete bins, a stepped frame matches the legend
swatch-for-swatch, and a dozen distinct colours compress far harder in
PNG than a continuous gradient (a busy CONUS frame lands ~200KB instead
of megabytes).
"""
from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class RampStop:
    """Values >= `threshold` (and below the next stop) render as `rgba`.

    `threshold` is in the product's native unit — inches for mesh,
    percent for posh, dBZ for reflectivity.
    """

    threshold: float
    rgba: tuple[int, int, int, int]


# Hail SIZE — the hero layer. Alpha climbs with size so a 3" core reads
# as solid while a 0.5" fringe still lets the streets show through.
MESH_RAMP: Sequence[RampStop] = (
    RampStop(0.50, (0x9E, 0xD9, 0xA4, 170)),  # Pea
    RampStop(0.75, (0x36, 0xC1, 0x68, 185)),  # Penny
    RampStop(1.00, (0xF2, 0xD5, 0x30, 200)),  # Quarter
    RampStop(1.25, (0xF0, 0xA1, 0x2C, 210)),  # Half-dollar
    RampStop(1.50, (0xEA, 0x7A, 0x2C, 215)),  # Walnut
    RampStop(1.75, (0xD9, 0x46, 0x2F, 225)),  # Golf ball
    RampStop(2.00, (0xA1, 0x1F, 0x2A, 230)),  # Hen egg
    RampStop(2.50, (0xD4, 0x5B, 0xAA, 235)),  # Tennis ball
    RampStop(2.75, (0x8E, 0x3C, 0xA8, 240)),  # Baseball
    RampStop(3.00, (0x4A, 0x20, 0x70, 245)),  # Softball
)

# Hail LIKELIHOOD (MRMS POSH, 0-100%). One amber hue getting deeper and
# more opaque with probability — it must never compete with the size
# layer stacked on top of it. Barely visible until ~30%, which is where
# "keep an eye on it" turns into "there's hail in that storm".
POSH_RAMP: Sequence[RampStop] = (
    RampStop(20.0, (0xFB, 0xD3, 0x8D, 45)),
    RampStop(30.0, (0xF7, 0xC2, 0x5A, 90)),
    RampStop(40.0, (0xF3, 0xAC, 0x3A, 120)),
    RampStop(50.0, (0xEE, 0x9A, 0x28, 145)),
    RampStop(60.0, (0xE6, 0x89, 0x1C, 170)),
    RampStop(70.0, (0xDC, 0x7A, 0x12, 190)),
    RampStop(80.0, (0xCE, 0x6A, 0x0B, 205)),
    RampStop(90.0, (0xBE, 0x5A, 0x06, 220)),
)

# Storm position (composite reflectivity, dBZ). Deliberately desaturated
# and capped well below opaque: this is context under everything else,
# and the moment it gets punchy the eye stops finding the hail.
REFLECTIVITY_RAMP: Sequence[RampStop] = (
    RampStop(20.0, (0xA8, 0xC4, 0xDC, 55)),
    RampStop(25.0, (0x8F, 0xB3, 0xD1, 70)),
    RampStop(30.0, (0x86, 0xBC, 0xA8, 85)),
    RampStop(35.0, (0x9C, 0xC2, 0x92, 95)),
    RampStop(40.0, (0xC2, 0xC5, 0x8C, 105)),
    RampStop(45.0, (0xD3, 0xBC, 0x7E, 115)),
    RampStop(50.0, (0xD9, 0xA8, 0x74, 125)),
    RampStop(55.0, (0xD0, 0x8F, 0x6E, 135)),
    RampStop(60.0, (0xC4, 0x79, 0x6E, 145)),
)


def colorize(values: np.ndarray, ramp: Sequence[RampStop]) -> np.ndarray:
    """Map a (h, w) grid of native values to an (h, w, 4) uint8 RGBA image.

    Anything below the ramp's first stop becomes fully transparent, so a
    quiet frame is an (almost) empty image that composites cleanly over
    the basemap.
    """
    thresholds = np.array([s.threshold for s in ramp], dtype=np.float32)
    lut = np.zeros((len(ramp) + 1, 4), dtype=np.uint8)
    # Row 0 is "below the first stop = nothing here". It carries the first
    # stop's RGB at alpha 0 rather than transparent BLACK: clients scale
    # these frames, and interpolating an opaque colour against transparent
    # black paints a dark halo around every swath edge.
    lut[0] = (*ramp[0].rgba[:3], 0)
    for i, stop in enumerate(ramp, start=1):
        lut[i] = stop.rgba

    # side="right" so a pixel exactly on a threshold gets that stop's colour.
    idx = np.searchsorted(thresholds, values, side="right")
    return lut[idx]
