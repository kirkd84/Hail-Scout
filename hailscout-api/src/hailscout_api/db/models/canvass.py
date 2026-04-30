"""Canvassing marker and monitored address models.

After migration 003, both models support a 'lite' (no parcel) shape where
the API stores lat/lng/address directly. The PostGIS geom column on
markers remains for future spatial queries; new rows from the API path
leave it null.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from geoalchemy2 import Geometry
from sqlalchemy import ForeignKey, String, Text, Float, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from hailscout_api.db.base import Base, created_at_column, updated_at_column


class MonitoredAddress(Base):
    """Address subscribed for hail alerts."""

    __tablename__ = "monitored_addresses"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    org_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    user_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )
    # Legacy parcel-based linkage (unused until parcel ingest ships)
    parcel_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("parcels.id"), nullable=True, index=True
    )
    # Free-text fields used by the current API path
    address: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    label: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    lat: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    lng: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    alert_threshold_in: Mapped[Optional[float]] = mapped_column(
        Float, nullable=True, server_default="0.75"
    )
    last_storm_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_storm_size_in: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    created_at: Mapped[datetime] = created_at_column()
    updated_at: Mapped[datetime] = updated_at_column()

    def __repr__(self) -> str:
        return f"<MonitoredAddress(id={self.id}, address={self.address})>"


class Marker(Base):
    """Canvassing marker placed by user."""

    __tablename__ = "markers"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    org_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    storm_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("storms.id"), nullable=True, index=True
    )
    parcel_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("parcels.id"), nullable=True, index=True
    )
    # Optional client-supplied id used for idempotent bulk-create on first
    # sign-in (lets us migrate existing localStorage markers without dupes).
    client_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    geom_point: Mapped[Optional[str]] = mapped_column(
        Geometry("POINT", srid=4326), nullable=True
    )
    lat: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    lng: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(
        String(50),
        default="lead",
        nullable=False,
        index=True,
    )  # lead, knocked, no_answer, appt, contract, not_interested
    notes: Mapped[Optional[str]] = mapped_column(Text)
    photos: Mapped[Optional[str]] = mapped_column(Text)  # JSON-serialized list of S3 keys

    created_at: Mapped[datetime] = created_at_column()
    updated_at: Mapped[datetime] = updated_at_column()

    def __repr__(self) -> str:
        return f"<Marker(id={self.id}, status={self.status})>"


class StormAlert(Base):
    """Alert generated when a storm touches a monitored address."""

    __tablename__ = "storm_alerts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    org_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    monitored_address_id: Mapped[int] = mapped_column(
        ForeignKey("monitored_addresses.id"), nullable=False, index=True
    )
    # Storm identity. We don't FK to storms.id since fixture storms aren't
    # in the DB yet — store the id as a free string so the alert generator
    # can dedupe by (storm_id, address_id) across fetches.
    storm_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    storm_city: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    peak_size_in: Mapped[float] = mapped_column(Float, nullable=False)
    storm_started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    read_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    dismissed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = created_at_column()

    def __repr__(self) -> str:
        return f"<StormAlert(id={self.id}, storm={self.storm_id}, addr={self.monitored_address_id})>"
