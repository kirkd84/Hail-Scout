"""User profile endpoint tests."""

from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_me_endpoint_requires_auth() -> None:
    """Test that /me endpoint requires authentication."""
    # TODO(Week 1): Test auth middleware with mocked Clerk JWT
    # This requires setting up a mock Clerk verifier
    pytest.skip("Auth tests require Clerk mock setup")
