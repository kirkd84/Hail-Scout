"""Export GeoDataFrame to newline-delimited GeoJSON."""

import json
import logging
from pathlib import Path

import geopandas as gpd
from shapely.geometry import mapping

logger = logging.getLogger(__name__)


def geodataframe_to_ndjson(gdf: gpd.GeoDataFrame, output_path: str) -> None:
    """Export GeoDataFrame to newline-delimited GeoJSON (NDJSON).

    Each line is a complete GeoJSON Feature with properties and geometry.

    Args:
        gdf: GeoDataFrame with geometry column
        output_path: Path to write NDJSON file

    Properties included in output:
    - hail_size: str
    - category: float
    - storm_id: str
    - start_time: ISO 8601 datetime
    - end_time: ISO 8601 datetime
    - max_size_in: float
    """
    logger.info(f"Exporting {len(gdf)} features to {output_path}")

    # Ensure output directory exists
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w") as f:
        for _, row in gdf.iterrows():
            # Build feature properties
            properties = {
                "hail_size": str(row["hail_size"]),
                "category": float(row["category"]),
                "storm_id": str(row["storm_id"]),
                "start_time": row["start_time"].isoformat() if row["start_time"] else None,
                "end_time": row["end_time"].isoformat() if row["end_time"] else None,
                "max_size_in": float(row["max_size_in"])
                if pd.notna(row["max_size_in"])
                else None,
            }

            # Build GeoJSON feature
            feature = {
                "type": "Feature",
                "properties": properties,
                "geometry": mapping(row.geometry),
            }

            # Write as JSON on a single line
            f.write(json.dumps(feature) + "\n")

    logger.info(f"Exported to {output_path}")


# Re-export pandas for use in module
import pandas as pd
