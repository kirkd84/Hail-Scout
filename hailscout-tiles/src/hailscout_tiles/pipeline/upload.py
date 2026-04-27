"""Upload tiles to S3 with correct headers."""

import logging
from pathlib import Path

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)


def upload_tiles_to_s3(
    tiles_dir: str,
    s3_prefix: str,
    s3_bucket: str,
) -> int:
    """Upload tile directory tree to S3.

    Args:
        tiles_dir: Local directory tree (e.g., /tmp/tiles/) with structure z/x/y.pbf
        s3_prefix: S3 prefix (e.g., "swaths" or "historical/2023-05-15")
        s3_bucket: S3 bucket name

    Returns:
        Number of files uploaded

    Headers set for each file:
    - Content-Type: application/x-protobuf
    - Content-Encoding: gzip
    - Cache-Control: Varies by prefix
        - swaths/*: max-age=60, must-revalidate
        - historical/*: max-age=31536000, immutable
    """
    s3_client = boto3.client("s3")
    tiles_path = Path(tiles_dir)

    if not tiles_path.is_dir():
        raise FileNotFoundError(f"Tiles directory not found: {tiles_dir}")

    # Walk directory tree and upload .pbf files
    pbf_files = list(tiles_path.glob("**/*.pbf"))
    logger.info(f"Found {len(pbf_files)} .pbf files to upload")

    if len(pbf_files) == 0:
        logger.warning(f"No .pbf files found in {tiles_dir}")
        return 0

    uploaded_count = 0

    for pbf_path in pbf_files:
        # Calculate S3 key from local path
        # e.g., z/x/y.pbf -> swaths/z/x/y.pbf
        relative_path = pbf_path.relative_to(tiles_path)
        s3_key = f"{s3_prefix}/{relative_path}".replace("\\", "/")

        # Determine cache control based on prefix
        if s3_prefix.startswith("swaths"):
            cache_control = "max-age=60, must-revalidate"
        elif s3_prefix.startswith("historical"):
            cache_control = "max-age=31536000, immutable"
        else:
            cache_control = "max-age=3600"

        # Upload with correct content-type and encoding
        try:
            s3_client.upload_file(
                str(pbf_path),
                s3_bucket,
                s3_key,
                ExtraArgs={
                    "ContentType": "application/x-protobuf",
                    "ContentEncoding": "gzip",
                    "CacheControl": cache_control,
                },
            )
            logger.debug(f"Uploaded {s3_key}")
            uploaded_count += 1
        except ClientError as e:
            logger.error(f"Failed to upload {s3_key}: {e}")
            raise

    logger.info(f"Uploaded {uploaded_count} tiles to s3://{s3_bucket}/{s3_prefix}")
    return uploaded_count
