"""Live radar frames + SPC hail-probability outlooks.

`RadarFrame` holds a rendered MRMS raster (PNG with alpha) for one product at
one valid time. Three products matter to a roofer, in increasing order of
"do I care":

    reflectivity — where the storm is (context)
    posh         — Probability of Severe Hail: hail is LIKELY here
    mesh         — estimated hail SIZE: hail is falling here, this big

`HailOutlook` holds SPC's day-1/2/3 hail probability polygons — the daily
"35% hail risk in your area" forecast — and `HailOutlookAlert` records that we
already told a given zone about a given outlook period, so re-running the job
can't spam the customer base.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from geoalchemy2 import Geometry
from sqlalchemy import (
    DateTime,
    Float,
    Integer,
    LargeBinary,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from hailscout_api.db.base import Base, created_at_column

# Product ids used across the pipeline, API and clients.
RADAR_PRODUCTS = ("reflectivity", "posh", "mesh")


class RadarFrame(Base):
    """One rendered MRMS raster frame."""

    __tablename__ = "radar_frames"
    __table_args__ = (
        UniqueConstraint("product", "valid_time", name="uq_radar_frame_product_time"),
    )

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    product: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    valid_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    # Geographic extent of the image, for a MapLibre `image` source.
    min_lat: Mapped[float] = mapped_column(Float, nullable=False)
    min_lng: Mapped[float] = mapped_column(Float, nullable=False)
    max_lat: Mapped[float] = mapped_column(Float, nullable=False)
    max_lng: Mapped[float] = mapped_column(Float, nullable=False)
    width: Mapped[int] = mapped_column(Integer, nullable=False)
    height: Mapped[int] = mapped_column(Integer, nullable=False)
    # Peak value in-frame (inches for mesh, % for posh, dBZ for reflectivity)
    # so clients can caption a frame without decoding the PNG.
    peak_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    png: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    created_at: Mapped[datetime] = created_at_column()

    def __repr__(self) -> str:
        return f"<RadarFrame({self.product} @ {self.valid_time})>"


class HailOutlook(Base):
    """One SPC hail-probability contour for a forecast day."""

    __tablename__ = "hail_outlooks"
    __table_args__ = (
        UniqueConstraint(
            "day", "kind", "probability", "valid_from", name="uq_hail_outlook_slice"
        ),
    )

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    day: Mapped[int] = mapped_column(Integer, nullable=False)
    kind: Mapped[str] = mapped_column(String(16), nullable=False)  # hail | sighail
    probability: Mapped[float] = mapped_column(Float, nullable=False)
    label: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    valid_from: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    valid_to: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    issued_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    geom: Mapped[str] = mapped_column(Geometry("MULTIPOLYGON", srid=4326), nullable=False)
    created_at: Mapped[datetime] = created_at_column()

    def __repr__(self) -> str:
        return f"<HailOutlook(day={self.day}, {self.probability:.0%})>"


class HailOutlookAlert(Base):
    """Dedupe record: this zone was told about this outlook period."""

    __tablename__ = "hail_outlook_alerts"
    __table_args__ = (
        UniqueConstraint(
            "zone_id", "kind", "valid_from", name="uq_hail_outlook_alert_zone_period"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    org_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    zone_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    day: Mapped[int] = mapped_column(Integer, nullable=False)
    probability: Mapped[float] = mapped_column(Float, nullable=False)
    valid_from: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    sent_at: Mapped[datetime] = created_at_column()
