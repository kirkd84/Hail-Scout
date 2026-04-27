"""Query hail_swaths from PostGIS into a GeoDataFrame."""

import logging
from datetime import datetime
from typing import Optional

import geopandas as gpd
import pandas as pd
from sqlalchemy import create_engine, text

from hailscout_tiles.colors import HAIL_CATEGORY_ORDER
from hailscout_tiles.config import get_settings

logger = logging.getLogger(__name__)


def query_swaths_by_date_range(
    start_date: datetime,
    end_date: datetime,
    bbox: Optional[tuple[float, float, float, float]] = None,
) -> gpd.GeoDataFrame:
    """Query hail_swaths from PostGIS by date range.

    Args:
        start_date: Start of date range (inclusive)
        end_date: End of date range (inclusive)
        bbox: Optional bounding box (minx, miny, maxx, maxy) to limit query

    Returns:
        GeoDataFrame with swaths, with the following columns:
        - geometry: MultiPolygon
        - hail_size: str (one of "0.75", "1.0", "1.25", "1.5", "1.75", "2.0", "2.5", "3.0+")
        - category: float (numeric order for sorting)
        - storm_id: str (UUID)
        - start_time: datetime
        - end_time: datetime
        - max_size_in: float
    """
    settings = get_settings()
    engine = create_engine(settings.database_url)

    # Build WHERE clause
    where_conditions = [
        f"hs.updated_at >= '{start_date.isoformat()}'",
        f"hs.updated_at <= '{end_date.isoformat()}'",
    ]

    if bbox is not None:
        minx, miny, maxx, maxy = bbox
        where_clause_bbox = (
            f"ST_Intersects(hs.geom_multipolygon, "
            f"ST_MakeEnvelope({minx}, {miny}, {maxx}, {maxy}, 4326))"
        )
        where_conditions.append(where_clause_bbox)

    where_clause = " AND ".join(where_conditions)

    # SQL query: join hail_swaths with storms for temporal context
    query_str = f"""
    SELECT
        hs.id,
        hs.hail_size_category as hail_size,
        hs.geom_multipolygon as geometry,
        s.id as storm_id,
        s.start_time,
        s.end_time,
        s.max_hail_size_in as max_size_in,
        hs.updated_at
    FROM hail_swaths hs
    JOIN storms s ON hs.storm_id = s.id
    WHERE {where_clause}
    ORDER BY hs.updated_at DESC
    """

    logger.info(f"Executing query: {query_str[:100]}...")

    # Execute and load into GeoDataFrame
    gdf = gpd.read_postgis(query_str, con=engine, geom_col="geometry", crs="EPSG:4326")

    # Add computed columns
    gdf["category"] = gdf["hail_size"].apply(
        lambda x: HAIL_CATEGORY_ORDER.get(x, -1.0)
    )

    logger.info(f"Loaded {len(gdf)} swaths from database")

    return gdf
