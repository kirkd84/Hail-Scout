"""
SQLAlchemy ORM models for PostGIS.

Matches the schema defined in PRD §1.6 exactly.
Uses geoalchemy2 for PostGIS Geometry types.
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from geoalchemy2 import Geometry
from sqlalchemy import Column, DateTime, Float, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.sql import func

Base = declarative_base()


class Storm(Base):
    """Storm event (groups multiple hail swaths together)."""

    __tablename__ = "storms"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=True)
    max_hail_size_in = Column(Float, nullable=True)
    centroid_geom = Column(Geometry("POINT", srid=4326), nullable=False)
    bbox_geom = Column(Geometry("POLYGON", srid=4326), nullable=False)
    source = Column(String(50), nullable=False, default="MRMS")  # e.g., 'MRMS', 'MYRORSS'
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    # Relationship
    hail_swaths = relationship("HailSwath", back_populates="storm", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Storm {self.id} start={self.start_time}>"


class HailSwath(Base):
    """Hail swath polygon for a given size category within a storm."""

    __tablename__ = "hail_swaths"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    storm_id = Column(UUID(as_uuid=True), ForeignKey("storms.id"), nullable=False)
    hail_size_category = Column(String(10), nullable=False)  # e.g., '0.75', '1.0', '3.0+'
    geom_multipolygon = Column(Geometry("MULTIPOLYGON", srid=4326), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    # Relationship
    storm = relationship("Storm", back_populates="hail_swaths")

    # Unique constraint: one swath per storm per category (idempotent upsert)
    __table_args__ = (
        UniqueConstraint("storm_id", "hail_size_category", name="uq_storm_category"),
    )

    def __repr__(self) -> str:
        return f"<HailSwath {self.id} category={self.hail_size_category}>"
