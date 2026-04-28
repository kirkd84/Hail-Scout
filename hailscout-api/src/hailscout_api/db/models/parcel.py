"""Parcel and contact models."""

from __future__ import annotations

from datetime import datetime

from geoalchemy2 import Geometry
from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from hailscout_api.db.base import Base, created_at_column, updated_at_column


class Parcel(Base):
    """Property parcel (Regrid source)."""

    __tablename__ = "parcels"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    source_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    geom_polygon: Mapped[str] = mapped_column(
        Geometry("POLYGON", srid=4326), nullable=False
    )
    address: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    state: Mapped[str] = mapped_column(String(2), nullable=False)
    zip: Mapped[str] = mapped_column(String(10), nullable=False)
    owner_name: Mapped[str | None] = mapped_column(String(255))
    mailing_address: Mapped[str | None] = mapped_column(String(255))
    landuse: Mapped[str | None] = mapped_column(String(100))
    building_footprint: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = created_at_column()
    updated_at: Mapped[datetime] = updated_at_column()

    def __repr__(self) -> str:
        return f"<Parcel(id={self.id}, address={self.address})>"


class Contact(Base):
    """Contact info (Cole-sourced, license-bound)."""

    __tablename__ = "contacts"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    parcel_id: Mapped[str] = mapped_column(
        ForeignKey("parcels.id"), nullable=False, index=True
    )
    phone: Mapped[str | None] = mapped_column(String(20))
    email: Mapped[str | None] = mapped_column(String(255))
    owner_full_name: Mapped[str | None] = mapped_column(String(255))
    source: Mapped[str] = mapped_column(String(50), default="cole", nullable=False)
    last_refreshed_at: Mapped[datetime] = updated_at_column()

    def __repr__(self) -> str:
        return f"<Contact(id={self.id}, parcel_id={self.parcel_id})>"
