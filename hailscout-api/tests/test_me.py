"""User profile endpoint tests."""

from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_me_endpoint_requires_auth() -> None:
    """Test that /me endpoint requires authentication."""
    # TODO: integration test /me with a minted access token + seeded user.
    # The token core itself is covered in test_auth_session.py.
    pytest.skip("Integration auth test pending DB fixtures")
