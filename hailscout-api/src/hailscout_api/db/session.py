"""Database engine and session configuration."""

from __future__ import annotations

from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from hailscout_api.config import Settings

# Global session factory (will be initialized in app startup)
_async_session_factory: async_sessionmaker[AsyncSession] | None = None


def _normalize_async_url(url: str) -> str:
    """Coerce a Postgres URL to the asyncpg dialect SQLAlchemy expects.

    Railway / Heroku / many managed providers expose ``DATABASE_URL`` as
    ``postgresql://...`` or ``postgres://...`` (the latter is deprecated by
    SQLAlchemy 2.x). ``create_async_engine`` requires an async driver, so
    we rewrite the scheme to ``postgresql+asyncpg://``.
    """
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]
    if url.startswith("postgresql://"):
        url = "postgresql+asyncpg://" + url[len("postgresql://") :]
    return url


def init_db(settings: Settings) -> None:
    """Initialize database engine and session factory."""
    global _async_session_factory

    engine = create_async_engine(
        _normalize_async_url(settings.database_url),
        echo=settings.debug,
        pool_size=settings.database_pool_size,
        max_overflow=10,
        pool_recycle=settings.database_pool_recycle,
        pool_pre_ping=True,
    )

    _async_session_factory = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
    )


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Get async database session."""
    if _async_session_factory is None:
        raise RuntimeError("Database not initialized. Call init_db() first.")

    async with _async_session_factory() as session:
        try:
            yield session
        finally:
            await session.close()
