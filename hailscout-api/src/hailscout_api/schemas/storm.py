"""Schemas for storm endpoints."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class GeoPoint(BaseModel):
    """GeoJSON Point."""

    type: str = "Point"
    coordinates: list[float] = Field(..., min_items=2, max_items=2)


class GeoPolygon(BaseModel):
    """GeoJSON Polygon."""

    type: str = "Polygon"
    coordinates: list[list[list[float]]]


class StormResponse(BaseModel):
    """Storm event details."""

    id: str
    start_time: datetime
    end_time: datetime
    max_hail_size_in: float
    centroid: GeoPoint
    bbox: GeoPolygon
    source: str = "MESH"

    model_config = {"from_attributes": True}


class StormsListResponse(BaseModel):
    """List of storms with pagination."""

    storms: list[StormResponse]
    cursor: str | None = Field(default=None, description="Pagination token")
    total: int = Field(..., description="Total matching storms")


class StormDetailResponse(BaseModel):
    """Storm with swaths (M2 stub)."""

    id: str
    start_time: datetime
    end_time: datetime
    max_hail_size_in: float
    centroid: GeoPoint
    swaths: list[dict] = Field(default_factory=list, description="Hail swaths by size")


class NexradFrameResponse(BaseModel):
    """NEXRAD frame metadata (M4 stub)."""

    id: str
    timestamp: datetime
    radar_site: str
    tile_url_pattern: str


class StormReplayResponse(BaseModel):
    """Hail Replay frame list (M4 stub)."""

    storm_id: str
    frames: list[NexradFrameResponse] = Field(default_factory=list)
