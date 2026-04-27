"""
Tests for hail swath polygon extraction.

Tests the rasterio→shapely vectorization pipeline.
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
from shapely.geometry import MultiPolygon, Polygon

from hailscout_pipeline.extraction.polygonize import HailSwath


class TestHailSwath:
    """Test HailSwath data structure."""

    def test_hail_swath_creation(self) -> None:
        """Test creating a HailSwath object."""
        geom = MultiPolygon([Polygon([(0, 0), (1, 0), (1, 1), (0, 1), (0, 0)])])
        timestamp = datetime(2024, 4, 1, 12, 0, 0, tzinfo=timezone.utc)

        swath = HailSwath(
            hail_size_category="1.5",
            geom_multipolygon=geom,
            timestamp=timestamp,
            source="MRMS",
        )

        assert swath.hail_size_category == "1.5"
        assert swath.geom_multipolygon == geom
        assert swath.timestamp == timestamp
        assert swath.source == "MRMS"

    def test_hail_swath_is_named_tuple(self) -> None:
        """Test that HailSwath behaves like a named tuple."""
        geom = MultiPolygon([Polygon([(0, 0), (1, 0), (1, 1), (0, 1), (0, 0)])])
        timestamp = datetime.now(timezone.utc)
        swath = HailSwath("2.0", geom, timestamp)

        # Access by index
        assert swath[0] == "2.0"
        assert swath[1] == geom
        assert swath[2] == timestamp

    def test_hail_swath_unpacking(self) -> None:
        """Test unpacking HailSwath tuple."""
        geom = MultiPolygon([Polygon([(0, 0), (1, 0), (1, 1), (0, 1), (0, 0)])])
        timestamp = datetime.now(timezone.utc)
        swath = HailSwath("1.25", geom, timestamp)

        category, polygon, ts = swath[:3]
        assert category == "1.25"
        assert polygon == geom
        assert ts == timestamp


class TestPolygonExtraction:
    """
    Tests for polygon extraction from raster (integration tests).

    Note: Real tests require GRIB2 fixtures. These are placeholder tests
    for the scaffold phase.
    """

    @pytest.mark.skip(reason="Requires real MRMS fixture data")
    def test_extract_swaths_from_geotiff(self) -> None:
        """Test extracting swaths from a GeoTIFF file."""
        # TODO: Add real GRIB2/GeoTIFF fixture
        # Once available, test:
        # 1. Load fixture GeoTIFF
        # 2. Call extract_swath_polygons()
        # 3. Assert returned list contains expected categories
        # 4. Validate each polygon is valid Shapely geometry
        # 5. Check CRS is WGS84 (EPSG:4326)
        pass

    @pytest.mark.skip(reason="Requires real MRMS fixture data")
    def test_swath_polygon_validity(self) -> None:
        """Test that extracted polygons are valid geometries."""
        # TODO: Validate polygon topology:
        # - is_valid == True
        # - bounds are within US lat/lon
        # - no self-intersections
        pass

    @pytest.mark.skip(reason="Requires real MRMS fixture data")
    def test_swath_multipolygon_merging(self) -> None:
        """Test that adjacent regions merge into MultiPolygon."""
        # TODO: Verify that rasterio.features.shapes() correctly
        # merges adjacent pixels into contiguous regions
        pass
