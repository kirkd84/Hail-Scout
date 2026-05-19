"""NEXRAD Level II client — anonymous fetch from the Unidata mirror.

Phase 18. Level II volume scans are the highest-resolution radar data
the NWS publishes: ~150m radial resolution, 4-10 min cadence,
per-station (~160 WSR-88D sites across CONUS). They're the foundation
for industry storm-cell tracking (SCIT) and hydrometeor classification
(HCA) — what HailTrace / IHM / CoreLogic chain together to produce
their cell-track polygons.

Bucket layout (default: `unidata-nexrad-level2`):
    s3://unidata-nexrad-level2/{YYYY}/{MM}/{DD}/{Station}/
        {Station}{YYYYMMDD}_{HHMMSS}_V06[_MDM]

Each file is ONE volume scan (one station, one timestamp). A
"Station" is a 4-letter ICAO code (KOKC, KFWS, KDDC, etc.). Multiple
stations cover the same hail event — we'd typically pick the closest
station to a candidate cell and use that scan.

Why Unidata's mirror instead of the official `noaa-nexrad-level2`:
the official NOAA bucket revoked anonymous LIST permission, which
breaks `boto3.UNSIGNED` calls the moment we try to enumerate scans
for a station. The Unidata mirror has the same key layout AND
allows anonymous LIST. Trade-off: Unidata keeps ~7 days of recent
data — deeper history needs a different access path (NCEI HDSS or
requester-pays against the NOAA bucket).

This module is a thin S3 client; the SCIT / HCA processing lives in
`extraction.nexrad_scit`. We split them so the client is testable
without bringing in radar-processing dependencies.
"""
from __future__ import annotations
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from tempfile import gettempdir
from typing import Iterable

import boto3
import botocore
import structlog
from botocore.client import Config

log = structlog.get_logger()

# Filename pattern: KOKC20240615_180000_V06 or KOKC20240615_180000_V06_MDM
NEXRAD_PATTERN = re.compile(
    r"^(?P<station>[A-Z]{4})(?P<date>\d{8})_(?P<time>\d{6})_V0(?P<level>\d)"
    r"(?P<mdm>_MDM)?$"
)


@dataclass
class VolumeScanKey:
    """Reference to a single NEXRAD Level II volume scan in S3."""
    station: str
    timestamp: datetime
    s3_key: str
    is_mdm: bool  # True for "Message Down Match" partial volumes


class NexradClient:
    """Anonymous client for the public NOAA NEXRAD Level II S3 bucket."""

    def __init__(self, bucket_name: str = "unidata-nexrad-level2") -> None:
        self.bucket_name = bucket_name
        self.s3 = boto3.client(
            "s3",
            config=Config(signature_version=botocore.UNSIGNED),
        )

    def _prefix_for(self, dt: datetime, station: str) -> str:
        return (
            f"{dt.strftime('%Y')}/{dt.strftime('%m')}/{dt.strftime('%d')}/"
            f"{station.upper()}/"
        )

    def list_volume_scans(
        self,
        dt: datetime,
        station: str,
    ) -> list[VolumeScanKey]:
        """List all volume scans for one station on one UTC date.

        Returns parsed VolumeScanKey entries sorted by timestamp.
        Skips MDM ("Message Down Match") partial volumes by default —
        they're patch files, not full scans.
        """
        prefix = self._prefix_for(dt, station)
        keys: list[VolumeScanKey] = []
        paginator = self.s3.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=self.bucket_name, Prefix=prefix):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                name = key.rsplit("/", 1)[-1]
                m = NEXRAD_PATTERN.match(name)
                if not m:
                    continue
                try:
                    ts = datetime.strptime(
                        f"{m['date']}{m['time']}", "%Y%m%d%H%M%S"
                    ).replace(tzinfo=timezone.utc)
                except ValueError:
                    continue
                keys.append(VolumeScanKey(
                    station=m["station"],
                    timestamp=ts,
                    s3_key=key,
                    is_mdm=bool(m["mdm"]),
                ))
        keys.sort(key=lambda v: v.timestamp)
        return keys

    def list_volume_scans_window(
        self,
        start: datetime,
        end: datetime,
        station: str,
    ) -> list[VolumeScanKey]:
        """List all full-volume scans for one station between two UTC ts.

        Spans the date boundary as needed. Filters out MDM partials.
        """
        out: list[VolumeScanKey] = []
        cur = start.replace(hour=0, minute=0, second=0, microsecond=0)
        end_floor = end.replace(hour=0, minute=0, second=0, microsecond=0)
        while cur <= end_floor:
            for scan in self.list_volume_scans(cur, station):
                if scan.is_mdm:
                    continue
                if start <= scan.timestamp <= end:
                    out.append(scan)
            cur = cur.replace(day=cur.day) + (
                # Add 1 day; care for month rollover via timedelta
                datetime(2000, 1, 2) - datetime(2000, 1, 1)
            )
        return out

    def download(self, key: VolumeScanKey) -> str:
        """Download one volume scan to /tmp. Returns the local path.

        Volume scan files are typically 5-15 MB each, gzip-compressed
        internally; py-ART / wradlib can parse them directly without
        prior decompression.
        """
        name = key.s3_key.rsplit("/", 1)[-1]
        local = Path(gettempdir()) / name
        log.info("nexrad_download", key=key.s3_key, local=str(local),
                 station=key.station, ts=key.timestamp.isoformat())
        self.s3.download_file(self.bucket_name, key.s3_key, str(local))
        log.info("nexrad_downloaded", key=key.s3_key,
                 size=local.stat().st_size)
        return str(local)


# CONUS NEXRAD stations grouped by region. Used to pick which stations
# to ingest for a given storm bbox. Coordinates are the radar site
# locations (lat, lng); radar useful range is ~250 km.
CONUS_NEXRAD_STATIONS: dict[str, tuple[float, float]] = {
    # Plains / hail-alley priority
    "KFWS": (32.573, -97.303),    # Dallas / Fort Worth
    "KOKC": (35.333, -97.278),    # Oklahoma City
    "KTLX": (35.333, -97.278),    # Twin Lakes OK (same coords, OKC area)
    "KICT": (37.654, -97.443),    # Wichita
    "KDDC": (37.761, -99.969),    # Dodge City
    "KFDR": (34.362, -98.977),    # Frederick OK
    "KSGF": (37.235, -93.401),    # Springfield MO
    "KTWX": (38.997, -96.232),    # Topeka
    "KEAX": (38.810, -94.264),    # Pleasant Hill MO / Kansas City
    "KARX": (43.823, -91.191),    # La Crosse WI
    "KFSD": (43.588, -96.729),    # Sioux Falls
    "KOAX": (41.320, -96.367),    # Omaha
    "KDMX": (41.731, -93.723),    # Des Moines
    "KAMA": (35.234, -101.709),   # Amarillo
    "KLBB": (33.654, -101.814),   # Lubbock
    "KMAF": (31.943, -102.189),   # Midland
    "KFTG": (39.787, -104.546),   # Denver
    "KPUX": (38.460, -104.181),   # Pueblo
    # SE for late-season hail
    "KBMX": (33.172, -86.770),    # Birmingham
    "KFFC": (33.364, -84.566),    # Atlanta
    "KOHX": (36.247, -86.563),    # Nashville
    "KMRX": (36.169, -83.402),    # Knoxville
    "KGWX": (33.897, -88.329),    # Columbus MS
    "KHTX": (34.931, -86.084),    # Huntsville
    # Midwest
    "KILX": (40.150, -89.337),    # Lincoln IL
    "KIND": (39.708, -86.280),    # Indianapolis
    "KLOT": (41.604, -88.085),    # Chicago
    "KMKX": (42.968, -88.551),    # Milwaukee
    "KIWX": (41.359, -85.700),    # Northern IN
    "KLVX": (37.975, -85.944),    # Louisville
    "KLSX": (38.699, -90.683),    # St Louis
}


def nearest_stations(
    lat: float, lng: float, k: int = 3,
) -> list[tuple[str, float]]:
    """Return the k nearest NEXRAD stations to a point, with distances
    (degrees). Used to pick which volume scans to ingest for a cell."""
    out = []
    for station, (slat, slng) in CONUS_NEXRAD_STATIONS.items():
        dlat = lat - slat
        dlng = lng - slng
        d = (dlat * dlat + dlng * dlng) ** 0.5
        out.append((station, d))
    out.sort(key=lambda x: x[1])
    return out[:k]
