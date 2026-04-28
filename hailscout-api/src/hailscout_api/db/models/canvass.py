"""Canvassing marker and monitored address models."""

from __future__ import annotations

from datetime import datetime

from geoalchemy2 import Geometry
from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from hailscout_api.db.base import Base, created_at_column, id_column, updated_at_column


class MonitoredAddress(Base):
    """Address subscribed for hail alerts."""

    __tablename__ = "monitored_addresses"

    id: Mapped[int] = id_column()
    org_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    parcel_id: Mapped[str] = mapped_column(
        ForeignKey("parcels.id"), nullable=False, index=True
    )
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    alert_threshold_in: Mapped[float] = mapped_column(nullable=False)
    created_at: Mapped[datetime] = created_at_column()
    updated_at: Mapped[datetime] = updated_at_column()

    def __repr__(self) -> str:
        return f"<MonitoredAddress(id={self.id}, label={self.label})>"


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
    storm_id: Mapped[str] = mapped_column(
        ForeignKey("storms.id"), nullable=True, index=True
    )
    parcel_id: Mapped[str] = mapped_column(
        ForeignKey("parcels.id"), nullable=True, index=True
    )
    geom_point: Mapped[str] = mapped_column(Geometry("POINT", srid=4326), nullable=False)
    status: Mapped[str] = mapped_column(
        String(50),
        default="lead",
        nullable=False,
        index=True,
    )  # lead, knocked, no_answer, appt, contract, not_interested
    notes: Mapped[str | None] = mapped_column(Text)
    photos: Mapped[str | None] = mapped_column(Text)  # JSON-serialized list of S3 keys
    created_at: Mapped[datetime] = created_at_column()
    updated_at: Mapped[datetime] = updated_at_column()

    def __repr__(self) -> str:
        return f"<Marker(id={self.id}, status={self.status})>"
