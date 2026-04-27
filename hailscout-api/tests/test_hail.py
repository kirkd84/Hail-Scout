"""Hail impact query endpoint tests."""

from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_hail_at_address_with_address_string() -> None:
    """Test /hail-at-address with address parameter."""
    # TODO(Week 1): Test geocoding and swath query with Nominatim mock
    pytest.skip("Hail query tests require geocoder mock setup")


@pytest.mark.asyncio
async def test_hail_at_address_with_coordinates() -> None:
    """Test /hail-at-address with lat/lng parameters."""
    # TODO(Week 1): Test spatial swath query
    pytest.skip("Hail query tests require sample swath data")


@pytest.mark.asyncio
async def test_hail_at_address_requires_address_or_coords() -> None:
    """Test that /hail-at-address requires address or coords."""
    # TODO(Week 1): Test validation
    pytest.skip("Validation tests require client setup")
