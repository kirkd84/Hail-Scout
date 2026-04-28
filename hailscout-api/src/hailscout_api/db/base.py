"""SQLAlchemy declarative base and common utilities."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """SQLAlchemy declarative base class."""

    pass


def now_utc() -> datetime:
    """Get current UTC datetime."""
    return datetime.now(timezone.utc)


# ── Column FACTORIES ─────────────────────────────────────────────────
# IMPORTANT: each model needs its OWN Column instance. SQLAlchemy refuses
# to attach a single Column object to two different Tables, raising
# ``ArgumentError: Column object 'created_at' already assigned to Table``.
# Module-level shared instances looked tidy but blew up the schema build
# the moment a second table referenced one of them. The factories below
# return a fresh Column on every call.

def id_column() -> Mapped[int]:
    """Surrogate integer primary key (autoincrement)."""
    return mapped_column(primary_key=True)


def created_at_column() -> Mapped[datetime]:
    """``created_at`` timestamp column. Defaults to UTC now both client- and server-side."""
    return mapped_column(
        DateTime(timezone=True),
        default=now_utc,
        server_default=func.now(),
        nullable=False,
    )


def updated_at_column() -> Mapped[datetime]:
    """``updated_at`` timestamp column. Bumps on every UPDATE."""
    return mapped_column(
        DateTime(timezone=True),
        default=now_utc,
        onupdate=now_utc,
        server_default=func.now(),
        nullable=False,
    )
