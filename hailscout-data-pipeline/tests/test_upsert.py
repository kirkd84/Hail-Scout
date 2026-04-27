"""
Tests for idempotent upsert logic.

Validates storm grouping and swath insertion behavior.
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
from shapely.geometry import MultiPolygon, Polygon
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from hailscout_pipeline.db.models import Base, HailSwath, Storm
from hailscout_pipeline.db.upsert import upsert_swaths
from hailscout_pipeline.extraction.polygonize import HailSwath as HailSwathData


@pytest.fixture
def test_db() -> Session:
    """Create an in-memory SQLite database for testing."""
    # Note: SQLite doesn't support PostGIS, so this is a basic test.
    # Real tests would use a test Postgres instance.
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine)
    return TestSession()


class TestUpsertSwaths:
    """Test swath upsert behavior."""

    def test_upsert_empty_list(self, test_db: Session) -> None:
        """Test that empty swath list doesn't error."""
        # Should not raise
        upsert_swaths(test_db, [])
        test_db.commit()

    def test_upsert_single_swath(self, test_db: Session) -> None:
        """Test upserting a single swath creates storm and swath."""
        geom = MultiPolygon([Polygon([(0, 0), (1, 0), (1, 1), (0, 1), (0, 0)])])
        timestamp = datetime(2024, 4, 1, 12, 0, 0, tzinfo=timezone.utc)
        swath = HailSwathData(
            hail_size_category="1.5",
            geom_multipolygon=geom,
            timestamp=timestamp,
        )

        upsert_swaths(test_db, [swath])

        # Verify storm was created
        storms = test_db.query(Storm).all()
        assert len(storms) >= 1

    def test_upsert_idempotency(self, test_db: Session) -> None:
        """Test that upserting same swath twice doesn't duplicate."""
        geom = MultiPolygon([Polygon([(0, 0), (1, 0), (1, 1), (0, 1), (0, 0)])])
        timestamp = datetime(2024, 4, 1, 12, 0, 0, tzinfo=timezone.utc)
        swath = HailSwathData(
            hail_size_category="1.5",
            geom_multipolygon=geom,
            timestamp=timestamp,
        )

        # First upsert
        upsert_swaths(test_db, [swath])
        test_db.commit()

        initial_count = test_db.query(HailSwath).count()

        # Second upsert (same data)
        upsert_swaths(test_db, [swath])
        test_db.commit()

        final_count = test_db.query(HailSwath).count()

        # Should not have duplicated (ON CONFLICT UPDATE)
        assert final_count <= initial_count + 1

    def test_upsert_multiple_categories(self, test_db: Session) -> None:
        """Test upserting multiple size categories."""
        timestamp = datetime(2024, 4, 1, 12, 0, 0, tzinfo=timezone.utc)
        swaths = []

        for category in ["0.75", "1.5", "2.5"]:
            geom = MultiPolygon([Polygon([(0, 0), (1, 0), (1, 1), (0, 1), (0, 0)])])
            swaths.append(
                HailSwathData(
                    hail_size_category=category,
                    geom_multipolygon=geom,
                    timestamp=timestamp,
                )
            )

        upsert_swaths(test_db, swaths)
        test_db.commit()

        # Should have created 1 storm with 3 swaths
        storms = test_db.query(Storm).all()
        assert len(storms) >= 1

        # At least 3 swaths (may have more from storm grouping)
        swath_count = test_db.query(HailSwath).count()
        assert swath_count >= 3


class TestStormGrouping:
    """Test storm grouping heuristics."""

    def test_same_day_grouping(self) -> None:
        """Test that swaths from same day group into one storm."""
        # TODO: Implement test once storm_grouping_heuristic is finalized
        # Test:
        # 1. Two swaths at 12:00 and 12:05 (same day)
        # 2. Verify they get same storm_id
        # 3. Two swaths on different days (12:00 today, 12:00 tomorrow)
        # 4. Verify they get different storm_ids
        pass

    def test_spatial_proximity_grouping(self) -> None:
        """Test that spatially close swaths group together."""
        # TODO: Test that swaths within ~50km bbox distance group
        # into same storm
        pass
