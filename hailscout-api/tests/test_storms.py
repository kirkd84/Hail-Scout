"""Storm query endpoint tests."""

from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_list_storms_requires_bbox() -> None:
    """Test that /storms endpoint requires bbox parameter."""
    # TODO(Week 1): Test storms endpoint with sample data
    pytest.skip("Storm tests require sample data setup")


@pytest.mark.asyncio
async def test_list_storms_pagination() -> None:
    """Test storms pagination with cursor."""
    # TODO(Week 1): Test cursor-based pagination
    pytest.skip("Pagination tests require sample data setup")
