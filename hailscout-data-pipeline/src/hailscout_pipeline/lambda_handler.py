"""Legacy Lambda entry point — kept for compatibility but the pipeline now
runs as a Railway worker (see __main__.py). This handler is a thin shim
that calls the same `live` cycle so an EventBridge cron could still
trigger it if needed.
"""
from __future__ import annotations
import json
from typing import Any

from hailscout_pipeline.config import settings  # noqa: F401
from hailscout_pipeline.db.session import SessionLocal
from hailscout_pipeline.db.upsert import upsert_swaths
from hailscout_pipeline.extraction.polygonize import extract_swaths_from_grid
from hailscout_pipeline.ingestion.grib_to_geotiff import parse_mesh_grib
from hailscout_pipeline.ingestion.mrms_client import MRMSClient


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """AWS Lambda handler — fetch latest MESH and ingest."""
    client = MRMSClient()
    grib_path, key, ts = client.fetch_latest()
    grid = parse_mesh_grib(grib_path, ts)
    swaths = extract_swaths_from_grid(grid)
    if not swaths:
        return {"statusCode": 200, "body": json.dumps({"swath_count": 0})}
    with SessionLocal() as session:
        summary = upsert_swaths(session, swaths)
    return {"statusCode": 200, "body": json.dumps(summary)}
