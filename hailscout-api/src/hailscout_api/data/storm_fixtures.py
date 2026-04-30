"""Server-side mirror of hailscout-web/src/lib/storm-fixtures.ts.

Used by the alert generator until the real MRMS ingest pipeline ships.
Centroid + bbox + peak hail size is enough for distance-based 'did this
storm touch the address' checks. Polygon containment lives in the web
client; the API uses the bbox as a coarse proxy.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from math import sqrt


@dataclass(frozen=True)
class StormFixture:
    id: str
    city: str
    centroid_lat: float
    centroid_lng: float
    half_length_deg: float  # bbox half-length along lat
    half_width_deg: float   # bbox half-width along lng
    peak_size_in: float
    start_time: datetime
    end_time: datetime
    is_live: bool = False

    @property
    def min_lat(self) -> float:  return self.centroid_lat - self.half_length_deg
    @property
    def max_lat(self) -> float:  return self.centroid_lat + self.half_length_deg
    @property
    def min_lng(self) -> float:  return self.centroid_lng - self.half_width_deg
    @property
    def max_lng(self) -> float:  return self.centroid_lng + self.half_width_deg


def _ago(minutes: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(minutes=minutes)


# Static archive — dates in late April 2026 (same as JS fixtures).
_BASE = datetime(2026, 4, 12, 20, 14, tzinfo=timezone.utc)

ARCHIVE_FIXTURES: list[StormFixture] = [
    StormFixture("fx-storm-dfw-04-12",      "Dallas–Fort Worth, TX", 32.81,  -96.97,  0.55, 0.18, 2.75, _BASE,                                       _BASE + timedelta(hours=2, minutes=24)),
    StormFixture("fx-storm-okc-04-14",      "Oklahoma City, OK",     35.47,  -97.50,  0.62, 0.21, 3.0,  _BASE + timedelta(days=2, hours=2),          _BASE + timedelta(days=2, hours=4, minutes=16)),
    StormFixture("fx-storm-wichita-04-15",  "Wichita, KS",           37.69,  -97.34,  0.50, 0.16, 1.75, _BASE + timedelta(days=3, hours=-1),         _BASE + timedelta(days=3, hours=1)),
    StormFixture("fx-storm-denver-04-18",   "Denver, CO",            39.74, -104.99,  0.50, 0.18, 2.25, _BASE + timedelta(days=6, hours=2),          _BASE + timedelta(days=6, hours=4)),
    StormFixture("fx-storm-omaha-04-19",    "Omaha, NE",             41.26,  -95.93,  0.46, 0.16, 1.5,  _BASE + timedelta(days=7, minutes=-3),       _BASE + timedelta(days=7, hours=2, minutes=10)),
    StormFixture("fx-storm-kc-04-20",       "Kansas City, MO",       39.10,  -94.58,  0.58, 0.20, 2.5,  _BASE + timedelta(days=8, hours=2, minutes=51), _BASE + timedelta(days=8, hours=5, minutes=28)),
    StormFixture("fx-storm-lubbock-04-21",  "Lubbock, TX",           33.58, -101.86,  0.45, 0.17, 2.0,  _BASE + timedelta(days=9, hours=1, minutes=4),  _BASE + timedelta(days=9, hours=2, minutes=55)),
    StormFixture("fx-storm-stl-04-22",      "St. Louis, MO",         38.63,  -90.20,  0.45, 0.14, 1.25, _BASE + timedelta(days=10, hours=2, minutes=20), _BASE + timedelta(days=10, hours=4, minutes=37)),
    StormFixture("fx-storm-ind-04-25",      "Indianapolis, IN",      39.77,  -86.16,  0.45, 0.17, 1.75, _BASE + timedelta(days=13, hours=3, minutes=34), _BASE + timedelta(days=13, hours=5, minutes=18)),
    StormFixture("fx-storm-amarillo-04-26", "Amarillo, TX",          35.22, -101.83,  0.60, 0.22, 3.5,  _BASE + timedelta(days=14, hours=41/60),     _BASE + timedelta(days=14, hours=2, minutes=34)),
]


def live_fixtures() -> list[StormFixture]:
    """Live storms — timestamps relative to NOW so the demo always feels fresh."""
    return [
        StormFixture("fx-storm-live-wichita-falls", "Wichita Falls, TX", 33.91,  -98.49, 0.40, 0.14, 2.25, _ago(14),  _ago(-30), is_live=True),
        StormFixture("fx-storm-live-dodge-city",    "Dodge City, KS",    37.75, -100.02, 0.42, 0.15, 1.75, _ago(38),  _ago(-12), is_live=True),
        StormFixture("fx-storm-live-tulsa",         "Tulsa, OK",         36.15,  -95.99, 0.48, 0.17, 2.5,  _ago(72),  _ago(8),   is_live=True),
        StormFixture("fx-storm-live-greenville",    "Greenville, TX",    33.14,  -96.11, 0.36, 0.13, 1.5,  _ago(128), _ago(72),  is_live=False),
    ]


def all_fixtures() -> list[StormFixture]:
    """Live (computed) + static archive."""
    return [*live_fixtures(), *ARCHIVE_FIXTURES]


def storm_at(lat: float, lng: float, storm: StormFixture) -> bool:
    """True if (lat, lng) falls within the storm's bbox.

    This is a coarse proxy for polygon containment (which the web client
    does precisely). For alert-triggering it's fine — false positives at
    the bbox corners just mean a few extra alerts, not missed ones.
    """
    if not (storm.min_lat <= lat <= storm.max_lat):
        return False
    if not (storm.min_lng <= lng <= storm.max_lng):
        return False
    # Soften the corners — only count points within an inscribed ellipse
    nx = (lng - storm.centroid_lng) / storm.half_width_deg
    ny = (lat - storm.centroid_lat) / storm.half_length_deg
    return (nx * nx + ny * ny) <= 1.05  # generous tolerance


def storms_at_point(lat: float, lng: float) -> list[StormFixture]:
    return [s for s in all_fixtures() if storm_at(lat, lng, s)]
