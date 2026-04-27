"""
S3 storage utilities for GeoTIFF uploads.

Wrapper around boto3 for hailscout-raw bucket operations.
"""

from __future__ import annotations

from pathlib import Path

import boto3
import structlog

log = structlog.get_logger()


class S3Manager:
    """Manager for S3 bucket operations."""

    def __init__(self, bucket_name: str) -> None:
        """
        Initialize S3 manager.

        Args:
            bucket_name: Target S3 bucket name
        """
        self.bucket_name = bucket_name
        self.s3_client = boto3.client("s3")

    def upload_geotiff(self, local_path: str, s3_key: str) -> None:
        """
        Upload a GeoTIFF file to S3.

        Args:
            local_path: Path to local GeoTIFF file
            s3_key: S3 object key (path within bucket)

        Raises:
            RuntimeError: If upload fails
        """
        try:
            file_size = Path(local_path).stat().st_size
            log.info(
                "s3_upload_start",
                bucket=self.bucket_name,
                key=s3_key,
                size_bytes=file_size,
            )

            self.s3_client.upload_file(local_path, self.bucket_name, s3_key)

            log.info("s3_upload_complete", bucket=self.bucket_name, key=s3_key)

        except Exception as e:
            log.exception("s3_upload_failed", key=s3_key, error=str(e))
            raise RuntimeError(f"S3 upload failed: {e}") from e

    def download_geotiff(self, s3_key: str, local_path: str) -> None:
        """
        Download a GeoTIFF file from S3.

        Args:
            s3_key: S3 object key
            local_path: Path to save locally

        Raises:
            RuntimeError: If download fails
        """
        try:
            log.info("s3_download_start", bucket=self.bucket_name, key=s3_key)

            self.s3_client.download_file(self.bucket_name, s3_key, local_path)

            file_size = Path(local_path).stat().st_size
            log.info("s3_download_complete", key=s3_key, size_bytes=file_size)

        except Exception as e:
            log.exception("s3_download_failed", key=s3_key, error=str(e))
            raise RuntimeError(f"S3 download failed: {e}") from e
