"""Live MRMS client — fetches from the public NOAA MRMS S3 bucket.

The bucket `noaa-mrms-pds` is anonymous-access; we configure boto3
with botocore.UNSIGNED so no AWS creds are needed.

Live products keep ~24-72h history. For older data, use IowaArchiveClient.

Bucket layout (CONUS, instantaneous MESH — what the cell-tracking
pipeline ingests, Phase 17):
    s3://noaa-mrms-pds/CONUS/MESH_00.50/{YYYYMMDD}/
        MRMS_MESH_00.50_{YYYYMMDD}-{HHMMSS}.grib2.gz

Files publish every ~2 minutes; matching the radar volume-scan cadence.
"""
from __future__ import annotations
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from tempfile import gettempdir

import boto3
import botocore
import structlog
from botocore.client import Config

log = structlog.get_logger()


# Filename: MRMS_MESH_00.50_YYYYMMDD-HHMMSS.grib2[.gz]
# Pattern matches both the instantaneous product (Phase 17) and the
# legacy daily-max product (so a redeploy with the new config doesn't
# choke on lingering files in a temp dir).
MESH_PATTERN = re.compile(
    r"^MRMS_MESH(?:_Max_\d+min)?_00\.50_(?P<date>\d{8})-(?P<time>\d{6})"
    r"\.grib2(?:\.gz)?$"
)


class MRMSClient:
    """Anonymous client for the public NOAA MRMS S3 bucket."""

    def __init__(self, bucket_name: str = "noaa-mrms-pds",
                 product: str = "MESH_00.50") -> None:
        self.bucket_name = bucket_name
        self.product = product
        # Anonymous access — no creds needed for public bucket
        self.s3 = boto3.client(
            "s3",
            config=Config(signature_version=botocore.UNSIGNED),
        )

    def _list_prefix(self, prefix: str) -> list[str]:
        """Return all object keys under a prefix (paginated)."""
        keys: list[str] = []
        paginator = self.s3.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=self.bucket_name, Prefix=prefix):
            for obj in page.get("Contents", []):
                keys.append(obj["Key"])
        return keys

    def _prefix_for_date(self, dt: datetime) -> str:
        return f"CONUS/{self.product}/{dt.strftime('%Y%m%d')}/"

    def list_keys_for_date(self, dt: datetime) -> list[str]:
        """List MESH files for a single UTC date."""
        return self._list_prefix(self._prefix_for_date(dt))

    def fetch_latest(self) -> tuple[str, str, datetime]:
        """Download the newest available MESH file (today or yesterday).

        Returns: (local_path, s3_key, timestamp_utc)
        """
        now = datetime.now(timezone.utc)
        keys: list[str] = []
        for dt in [now, now - timedelta(days=1)]:
            keys.extend(self.list_keys_for_date(dt))

        if not keys:
            raise RuntimeError(
                f"No MESH files found in s3://{self.bucket_name} for "
                f"{now.date()} or {(now - timedelta(days=1)).date()}"
            )

        latest_key = None
        latest_dt = None
        for key in keys:
            name = key.rsplit("/", 1)[-1]
            m = MESH_PATTERN.match(name)
            if not m:
                continue
            try:
                dt = datetime.strptime(
                    f"{m['date']}{m['time']}", "%Y%m%d%H%M%S"
                ).replace(tzinfo=timezone.utc)
            except ValueError:
                continue
            if latest_dt is None or dt > latest_dt:
                latest_dt = dt
                latest_key = key

        if latest_key is None:
            raise RuntimeError("No MESH timestamps parsed")

        return self.download_key(latest_key, latest_dt)

    def download_key(self, key: str, ts: datetime) -> tuple[str, str, datetime]:
        """Download a specific S3 key to a temp file."""
        name = key.rsplit("/", 1)[-1]
        local = Path(gettempdir()) / name
        log.info("mrms_download", key=key, local=str(local))
        self.s3.download_file(self.bucket_name, key, str(local))
        log.info("mrms_downloaded", key=key, size=local.stat().st_size)
        return str(local), key, ts


# ---- Iowa State MtArchive (older history) ----

import urllib.request
from urllib.error import HTTPError, URLError


class IowaArchiveClient:
    """Pulls historical MRMS MESH from Iowa State's MtArchive (HTTPS).

    URL pattern (Phase 17 instantaneous product):
        https://mtarchive.geol.iastate.edu/{YYYY}/{MM}/{DD}/mrms/ncep/
            MESH/MESH_00.50_{YYYYMMDD}-{HHMMSS}.grib2.gz

    Files publish every 2 minutes (00:00:00, 00:02:00, 00:04:00, ...).
    The directory is `MESH` (no resolution suffix); the filename
    inside includes `_00.50`. NOAA's S3 has the suffix at both levels.

    This is the standard public archive going back ~10+ years, used when
    the live `noaa-mrms-pds` bucket no longer has the file.
    """

    BASE = "https://mtarchive.geol.iastate.edu"

    def __init__(
        self,
        archive_subdir: str = "MESH",
        file_prefix: str = "MESH_00.50",
    ) -> None:
        self.archive_subdir = archive_subdir
        self.file_prefix = file_prefix

    def url_for(self, ts: datetime) -> str:
        ymd = ts.strftime("%Y%m%d")
        hms = ts.strftime("%H%M%S")
        y, m, d = ts.strftime("%Y"), ts.strftime("%m"), ts.strftime("%d")
        return (f"{self.BASE}/{y}/{m}/{d}/mrms/ncep/{self.archive_subdir}/"
                f"{self.file_prefix}_{ymd}-{hms}.grib2.gz")

    def download(self, ts: datetime) -> tuple[str, str, datetime]:
        """Download a specific timestamp's MESH file. Returns (path, url, ts)."""
        url = self.url_for(ts)
        name = url.rsplit("/", 1)[-1]
        local = Path(gettempdir()) / name
        log.info("iowa_download", url=url, local=str(local))
        try:
            urllib.request.urlretrieve(url, str(local))
        except (HTTPError, URLError) as e:
            raise RuntimeError(f"Iowa archive fetch failed: {url} ({e})") from e
        log.info("iowa_downloaded", url=url, size=local.stat().st_size)
        return str(local), url, ts
