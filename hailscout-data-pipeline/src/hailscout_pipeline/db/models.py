"""SQLAlchemy ORM models — must mirror hailscout-api schema EXACTLY.

Both this pipeline and the API write to the same Postgres tables.
The canonical schema lives in:
    hailscout-api/migrations/versions/001_initial_schema.py
    hailscout-api/src/hailscout_api/db/models/storm.py
    hailscout-api/migrations/versions/012_hail_swath_uniq.py
"""
from __future__ import annotations
from geoalchemy2 import Geometry
from sqlalchemy import (
    Column, DateTime, Float, ForeignKey, String, UniqueConstraint,
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
