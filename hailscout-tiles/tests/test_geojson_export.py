"""Tests for GeoJSON export pipeline."""

import json
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import geopandas as gpd
import pytest
from shapely.geometry import MultiPolygon, Polygon

from hailscout_tiles.pipeline.geojson_export import geodataframe_to_ndjson


@pytest.fixture
def sample_gdf() -> gpd.GeoDataFrame:
    """Create a sample GeoDataFrame with swath features."""
    # Create simple test geometries
    poly1 = Polygon([(-95.5, 26.0), (-95.4, 26.0), (-95.4, 26.1), (-95.5, 26.1)])
    multi_poly = MultiPolygon([poly1])

    data = {
        "hail_size": ["1.75", "2.5"],
        "category": [4.0, 6.0],
        "storm_id": ["550e8400-e29b-41d4-a716-446655440000", "550e8400-e29b-41d4-a716-446655440001"],
        "start_time": [
            datetime(2023, 5, 15, 14, 30, tzinfo=timezone.utc),
            datetime(2023, 5, 15, 15, 0, tzinfo=timezone.utc),
        ],
        "end_time": [
            datetime(2023, 5, 15, 16, 45, tzinfo=timezone.utc),
            datetime(2023, 5, 15, 17, 30, tzinfo=timezone.utc),
        ],
        "max_size_in": [2.0, 2.75],
        "geometry": [multi_poly, multi_poly],
    }

    return gpd.GeoDataFrame(data, crs="EPSG:4326")


def test_geodataframe_to_ndjson(sample_gdf: gpd.GeoDataFrame) -> None:
    """Test exporting GeoDataFrame to NDJSON."""
    with tempfile.TemporaryDirectory() as tmpdir:
        output_path = Path(tmpdir) / "test.ndjson"

        geodataframe_to_ndjson(sample_gdf, str(output_path))

        # Verify file was created
        assert output_path.exists()

        # Read and verify lines
        lines = output_path.read_text().strip().split("\n")
        assert len(lines) == 2

        # Verify each line is valid GeoJSON
        for line in lines:
            feature = json.loads(line)
            assert feature["type"] == "Feature"
            assert "geometry" in feature
            assert "properties" in feature

        # Verify properties
        feature1 = json.loads(lines[0])
        assert feature1["properties"]["hail_size"] == "1.75"
        assert feature1["properties"]["category"] == 4.0
        assert "550e8400" in feature1["properties"]["storm_id"]
        assert feature1["properties"]["max_size_in"] == 2.0

        # Verify ISO 8601 timestamps
        assert "2023-05-15T14:30:00" in feature1["properties"]["start_time"]
        assert "2023-05-15T16:45:00" in feature1["properties"]["end_time"]


def test_ndjson_round_trip(sample_gdf: gpd.GeoDataFrame) -> None:
    """Test that exported NDJSON can be read back."""
    with tempfile.TemporaryDirectory() as tmpdir:
        output_path = Path(tmpdir) / "test.ndjson"
        geodataframe_to_ndjson(sample_gdf, str(output_path))

        # Read back and verify geometry is preserved
        features = []
        for line in output_path.read_text().strip().split("\n"):
            features.append(json.loads(line))

        assert len(features) == 2
        assert all(f["type"] == "Feature" for f in features)
        assert all("geometry" in f and f["geometry"]["type"] == "MultiPolygon" for f in features)


def test_ndjson_geometry_types(sample_gdf: gpd.GeoDataFrame) -> None:
    """Test that various geometry types are preserved."""
    with tempfile.TemporaryDirectory() as tmpdir:
        output_path = Path(tmpdir) / "test.ndjson"
        geodataframe_to_ndjson(sample_gdf, str(output_path))

        for line in output_path.read_text().strip().split("\n"):
            feature = json.loads(line)
            # Swaths should all be MultiPolygons (per PRD)
            assert feature["geometry"]["type"] == "MultiPolygon"
            assert "coordinates" in feature["geometry"]
