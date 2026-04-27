"""
AWS Lambda handler for MRMS MESH ingestion.

Orchestrates one full cycle: fetch GRIB2 → parse → extract swaths → upsert DB.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any

import structlog

from hailscout_pipeline.config import settings
from hailscout_pipeline.db.session import SessionLocal
from hailscout_pipeline.db.upsert import upsert_swaths
from hailscout_pipeline.extraction.polygonize import extract_swath_polygons
from hailscout_pipeline.ingestion.grib_to_geotiff import grib_to_geotiff
from hailscout_pipeline.ingestion.mrms_client import MRMSClient
from hailscout_pipeline.storage.s3 import S3Manager

# Configure structlog
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer(),
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

log = structlog.get_logger()


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """
    Lambda handler for MRMS ingestion.

    Args:
        event: Lambda event (from EventBridge cron, mostly empty)
        context: Lambda context object

    Returns:
        HTTP-style response with statusCode and body
    """
    try:
        log.info(
            "mrms_ingestion_start",
            function_name=context.function_name,
            request_id=context.request_id,
        )

        # 1. Fetch latest MESH GRIB2 from NOAA
        mrms_client = MRMSClient(settings.noaa_mrms_bucket)
        grib_path, grib_key, grib_timestamp = mrms_client.fetch_latest_mesh()
        log.info(
            "mesh_fetched",
            s3_key=grib_key,
            local_path=grib_path,
            timestamp=grib_timestamp.isoformat(),
        )

        # 2. Parse GRIB2, convert to GeoTIFF
        s3_manager = S3Manager(settings.hailscout_raw_bucket)
        geotiff_path, s3_geotiff_key = grib_to_geotiff(grib_path, grib_timestamp)
        log.info("geotiff_converted", local_path=geotiff_path, s3_key=s3_geotiff_key)

        s3_manager.upload_geotiff(geotiff_path, s3_geotiff_key)
        log.info("geotiff_uploaded", s3_key=s3_geotiff_key)

        # 3. Extract swath polygons by hail size category
        swaths = extract_swath_polygons(geotiff_path, grib_timestamp)
        log.info("swaths_extracted", count=len(swaths))

        # 4. Upsert to PostGIS
        session = SessionLocal()
        try:
            upsert_swaths(session, swaths)
            log.info("swaths_upserted", count=len(swaths))
        finally:
            session.close()

        return {
            "statusCode": 200,
            "body": json.dumps(
                {
                    "message": "MRMS ingestion complete",
                    "mesh_timestamp": grib_timestamp.isoformat(),
                    "swaths_ingested": len(swaths),
                }
            ),
        }

    except Exception as e:
        log.exception("mrms_ingestion_failed", error=str(e))
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)}),
        }


# Local testing entrypoint
if __name__ == "__main__":
    logging.basicConfig(level=settings.log_level)

    class MockContext:
        function_name = "hailscout-mrms-ingestion-local"
        request_id = "local-test"

    result = handler({}, MockContext())
    print(result)
