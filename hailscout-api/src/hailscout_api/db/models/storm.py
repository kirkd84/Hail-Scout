"""Storm, hail swath, and NEXRAD models."""

from __future__ import annotations

from datetime import datetime

from typing import Optional

from geoalchemy2 import Geometry
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from hailscout_api.db.base import Base, created_at_column, id_column, updated_at_column


class Storm(Base):
    """Storm event with MESH sourcing."""

    __tablename__ = "storms"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    start_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    end_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    max_hail_size_in: Mapped[float] = mapped_column(Float, nullable=False)
    centroid_geom: Mapped[str] = mapped_column(
        Geometry("POINT", srid=4326), nullable=False
    )
    bbox_geom: Mapped[str] = mapped_column(
        Geometry("POLYGON", srid=4326), nullable=False
    )
    source: Mapped[str] = mapped_column(String(50), default="MESH", nullable=False)
    # LSR↔NEXRAD confirmation (Phase 23 bonus). The lsr_linker service
    # stamps these when a SPC Local Storm Report falls inside a NEXRAD
    # cell's footprint within ±30 min. Alerts and the UI prefer
    # confirmed cells.
    lsr_confirmed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false",
        index=True,
    )
    lsr_observed_size_in: Mapped[Optional[float]] = mapped_column(
        Float, nullable=True,
    )
    lsr_observed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    # Quality / false-positive screening (Phase 23.5). `confidence` is
    # in [0, 1]; `suspect` is a cheap-to-index derivation
    # (suspect = confidence < SUSPECT_THRESHOLD). `suspect_reasons`
    # is a comma-separated tag list — bird_bloom, single_pixel,
    # no_lsr_in_metro, no_cross_source, etc.
    confidence: Mapped[float] = mapped_column(
        Float, nullable=False, default=1.0, server_default="1.0",
    )
    suspect: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false",
        index=True,
    )
    suspect_reasons: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True,
    )
    screened_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    # Dual-pol hail confirmation (Phase 18/19, persisted in migration 015).
    # `hail_confirmed` = polarimetric ZDR+RhoHV hail signature present;
    # `hail_gate_fraction` = share of cell gates carrying that signature;
    # `peak_dbz` = composite peak reflectivity. NEXRAD-only (MRMS/LSR
    # rows leave these at default/null).
    hail_confirmed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false",
        index=True,
    )
    hail_gate_fraction: Mapped[Optional[float]] = mapped_column(
        Float, nullable=True,
    )
    peak_dbz: Mapped[Optional[float]] = mapped_column(
        Float, nullable=True,
    )
    created_at: Mapped[datetime] = created_at_column()
    updated_at: Mapped[datetime] = updated_at_column()

    def __repr__(self) -> str:
        return f"<Storm(id={self.id}, max_hail_size={self.max_hail_size_in})>"


class HailSwath(Base):
    """Hail swath polygon by size category."""

    __tablename__ = "hail_swaths"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    storm_id: Mapped[str] = mapped_column(
        ForeignKey("storms.id"), nullable=False, index=True
    )
    hail_size_category: Mapped[str] = mapped_column(
        String(10), nullable=False, index=True
    )  # e.g., "0.75", "1.0", "1.25", "1.5", "1.75", "2.0", "2.5", "3.0+"
    geom_multipolygon: Mapped[str] = mapped_column(
        Geometry("MULTIPOLYGON", srid=4326), nullable=False
    )
    updated_at: Mapped[datetime] = updated_at_column()

    def __repr__(self) -> str:
        return f"<HailSwath(id={self.id}, category={self.hail_size_category})>"


class NexradFrame(Base):
    """NEXRAD Level II metadata for Hail Replay."""

    __tablename__ = "nexrad_frames"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    storm_id: Mapped[str] = mapped_column(
        ForeignKey("storms.id"), nullable=False, index=True
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    radar_site: Mapped[str] = mapped_column(String(10), nullable=False)
    tile_url_pattern: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = created_at_column()

    def __repr__(self) -> str:
        return f"<NexradFrame(storm_id={self.storm_id}, radar_site={self.radar_site})>"
