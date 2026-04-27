"""Operational models: impact reports, contact exports, alerts."""

from __future__ import annotations

from datetime import datetime

from geoalchemy2 import Geometry
from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from hailscout_api.db.base import Base, created_at_column, id_column, updated_at_column


class ImpactReport(Base):
    """Generated Hail Impact Report (PDF metadata)."""

    __tablename__ = "impact_reports"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    org_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    parcel_id: Mapped[str] = mapped_column(
        ForeignKey("parcels.id"), nullable=False, index=True
    )
    pdf_s3_key: Mapped[str] = mapped_column(Text, nullable=False)
    generated_at: Mapped[datetime] = created_at_column
    branded_logo_url: Mapped[str | None] = mapped_column(Text)

    def __repr__(self) -> str:
        return f"<ImpactReport(id={self.id}, org_id={self.org_id})>"


class ContactExport(Base):
    """Audit trail for contact exports (TCPA compliance)."""

    __tablename__ = "contact_exports"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    org_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    storm_id: Mapped[str] = mapped_column(
        ForeignKey("storms.id"), nullable=True, index=True
    )
    polygon_geom: Mapped[str] = mapped_column(
        Geometry("POLYGON", srid=4326), nullable=True
    )
    row_count: Mapped[int] = mapped_column(Integer, nullable=False)
    s3_key: Mapped[str] = mapped_column(Text, nullable=False)
    exported_at: Mapped[datetime] = created_at_column

    def __repr__(self) -> str:
        return f"<ContactExport(id={self.id}, row_count={self.row_count})>"


class Alert(Base):
    """Triggered hail alert log."""

    __tablename__ = "alerts"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    org_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    storm_id: Mapped[str] = mapped_column(
        ForeignKey("storms.id"), nullable=False, index=True
    )
    triggered_at: Mapped[datetime] = created_at_column
    max_size_in: Mapped[float] = mapped_column(nullable=False)
    channel: Mapped[str] = mapped_column(
        String(50), default="email", nullable=False
    )  # email, sms, push

    def __repr__(self) -> str:
        return f"<Alert(id={self.id}, storm_id={self.storm_id})>"
