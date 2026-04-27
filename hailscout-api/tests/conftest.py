"""Pytest configuration and fixtures."""

from __future__ import annotations

import asyncio
from typing import AsyncGenerator

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import StaticPool

from hailscout_api.db.base import Base
from hailscout_api.db.session import _async_session_factory, init_db
from hailscout_api.main import create_app
from hailscout_api.config import Settings


@pytest.fixture(scope="session")
def event_loop() -> AsyncGenerator[asyncio.AbstractEventLoop, None]:
    """Create an instance of the default event loop for each test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Create a test database session."""
    # Create in-memory SQLite database for testing
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )

    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Create session
    from sqlalchemy.ext.asyncio import async_sessionmaker

    async_session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session_factory() as session:
        yield session

    await engine.dispose()


@pytest.fixture
def settings() -> Settings:
    """Create test settings."""
    return Settings(
        env="test",
        debug=True,
        database_url="sqlite+aiosqlite:///:memory:",
        clerk_secret_key="sk_test_dummy",
        clerk_jwks_endpoint="https://test.clerk.accounts.com/.well-known/jwks.json",
        geocoder_provider="nominatim",
    )


@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """Create a test client."""
    app = create_app()
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac
