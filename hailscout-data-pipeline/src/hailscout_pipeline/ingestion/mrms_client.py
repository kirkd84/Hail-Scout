"""
MRMS client for fetching latest MESH GRIB2 from S3.

NOAA MRMS updates every 2 minutes. This client lists the bucket
and downloads the most recent MESH_Max_1440min_00.50 file.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path
from tempfile import gettempdir

import boto3
import structlog

log = structlog.get_logger()


class MRMSClient:
    """Client for NOAA MRMS MESH data."""

    # Pattern for MESH filename: MESH_Max_1440min_00.50_{YYYYMMDD}-{HHMMSS}.grib2
    MESH_PATTERN = re.compile(
        r"^MESH_Max_1440min_00\.50_(?P<date>\d{8})-(?P<time>\d{6})\.grib2$"
    )

    def __init__(self, bucket_name: str) -> None:
        """
        Initialize MRMS client.

        Args:
            bucket_name: S3 bucket name (usually 'noaa-mrms-pds')
        """
        self.bucket_name = bucket_name
        self.s3_client = boto3.client("s3")

    def fetch_latest_mesh(self) -> tuple[str, str, datetime]:
        """
        Fetch latest MESH GRIB2 file from NOAA MRMS bucket.

        Returns:
            Tuple of (local_path, s3_key, timestamp_utc)

        Raises:
            RuntimeError: If no MESH files found or download fails
        """
        # List objects matching MESH pattern
        log.info("mrms_listing", bucket=self.bucket_name)
        response = self.s3_client.list_objects_v2(
            Bucket=self.bucket_name,
            Prefix="MESH_Max_1440min_00.50_",
        )

        if "Contents" not in response:
            raise RuntimeError("No MESH files found in NOAA MRMS bucket")

        # Parse timestamps and find latest
        latest_key = None
        latest_dt = None

        for obj in response["Contents"]:
            key = obj["Key"]
            match = self.MESH_PATTERN.match(key)
            if not match:
                continue

            date_str = match.group("date")
            time_str = match.group("time")

            try:
                dt = datetime.strptime(f"{date_str}{time_str}", "%Y%m%d%H%M%S").replace(
                    tzinfo=timezone.utc
                )
                if latest_dt is None or dt > latest_dt:
                    latest_dt = dt
                    latest_key = key
            except ValueError as e:
                log.warning("mrms_parse_error", key=key, error=str(e))
                continue

        if latest_key is None or latest_dt is None:
            raise RuntimeError("No valid MESH timestamps parsed")

        log.info("mrms_latest_found", key=latest_key, timestamp=latest_dt.isoformat())

        # Download to temp directory
        local_path = Path(gettempdir()) / latest_key
        log.info("mrms_downloading", key=latest_key, local_path=str(local_path))

        self.s3_client.download_file(self.bucket_name, latest_key, str(local_path))

        log.info("mrms_downloaded", key=latest_key, size_bytes=local_path.stat().st_size)

        return str(local_path), latest_key, latest_dt
