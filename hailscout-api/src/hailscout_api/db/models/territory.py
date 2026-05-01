"""Territory zone model."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from hailscout_api.db.base import Base, created_at_column, updated_at_column


class Territory(Base):
    """Named polygon zone, assignable to a teammate."""

    __tablename__ = "territories"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    org_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    color: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    polygon_json: Mapped[str] = mapped_column(Text, nullable=False)
    assignee_user_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by_user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )
    created_at: Mapped[datetime] = created_at_column()
    updated_at: Mapped[datetime] = updated_at_column()
