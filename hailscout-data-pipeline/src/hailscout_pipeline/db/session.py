"""
SQLAlchemy engine and session factory.

Provides centralized database connection management.
"""

from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from hailscout_pipeline.config import settings

# Create engine
engine = create_engine(
    settings.database_url,
    echo=settings.db_echo,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,  # Verify connections before use
)

# Session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False,
)


def get_session() -> Session:
    """Get a new database session (context manager style)."""
    return SessionLocal()
