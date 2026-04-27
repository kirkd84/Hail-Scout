"""SQLAlchemy declarative base and common utilities."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """SQLAlchemy declarative base class."""

    pass


def now_utc() -> datetime:
    """Get current UTC datetime."""
    return datetime.now(timezone.utc)


# Common column definitions for reuse
id_column: Mapped[int] = mapped_column(primary_key=True)
created_at_column: Mapped[datetime] = mapped_column(
    DateTime(timezone=True),
    default=now_utc,
    server_default=func.now(),
    nullable=False,
)
updated_at_column: Mapped[datetime] = mapped_column(
    DateTime(timezone=True),
    default=now_utc,
    onupdate=now_utc,
    server_default=func.now(),
    nullable=False,
)
