"""SQLAlchemy ORM models — must mirror hailscout-api schema EXACTLY.

Both this pipeline and the API write to the same Postgres tables.
The canonical schema lives in:
    hailscout-api/migrations/versions/001_initial_schema.py
    hailscout-api/src/hailscout_api/db/models/storm.py
    hailscout-api/migrations/versions/012_hail_swath_uniq.py
    hailscout-api/migrations/versions/015_dualpol_persistence.py

Note: this model only needs to declare the columns the PIPELINE
reads or writes. The API has added several columns the pipeline
doesn't touch (lsr_*, confidence, suspect, screened_at) — those are
intentionally omitted here; SQLAlchemy simply leaves them at their
DB defaults on insert. The dual-pol columns below ARE declared
because the NEXRAD upsert writes them.
"""
from __future__ import annotations
from geoalchemy2 import Geometry
from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey, String, UniqueConstraint,
)
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.sql import func

Base = declarative_base()


class Storm(Base):
    __tablename__ = "storms"
    id = Column(String(255), primary_key=True)
    start_time = Column(DateTime(timezone=True), nullable=False, index=True)
    end_time = Column(DateTime(timezone=True), nullable=False)
    max_hail_size_in = Column(Float, nullable=False)  # NOT NULL
    centroid_geom = Column(Geometry("POINT", srid=4326), nullable=False)
    bbox_geom = Column(Geometry("POLYGON", srid=4326), nullable=False)
    source = Column(String(50), nullable=False, default="MESH")
    # Dual-pol hail confirmation (persisted via API migration 015).
    # Written by upsert_nexrad_cell; MRMS/LSR paths leave them defaulted.
    hail_confirmed = Column(Boolean, nullable=False, server_default="false")
    hail_gate_fraction = Column(Float, nullable=True)
    peak_dbz = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False,
                        server_default=func.now(), onupdate=func.now())
    hail_swaths = relationship("HailSwath", back_populates="storm",
                               cascade="all, delete-orphan")


class HailSwath(Base):
    __tablename__ = "hail_swaths"
    id = Column(String(255), primary_key=True)
    storm_id = Column(String(255), ForeignKey("storms.id"), nullable=False, index=True)
    hail_size_category = Column(String(10), nullable=False, index=True)
    geom_multipolygon = Column(Geometry("MULTIPOLYGON", srid=4326), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=False,
                        server_default=func.now(), onupdate=func.now())
    storm = relationship("Storm", back_populates="hail_swaths")
    __table_args__ = (
        UniqueConstraint("storm_id", "hail_size_category", name="uq_storm_category"),
    )
