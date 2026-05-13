"""Schemas for storm endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class GeoPoint(BaseModel):
    type: str = "Point"
    coordinates: list[float] = Field(..., min_length=2, max_length=2)


class GeoPolygon(BaseModel):
    type: str = "Polygon"
    coordinates: list[list[list[float]]]


class GeoMultiPolygon(BaseModel):
    type: str = "MultiPolygon"
    coordinates: list[list[list[list[float]]]]


class StormResponse(BaseModel):
    id: str
    start_time: datetime
    end_time: datetime
    max_hail_size_in: float
    centroid: GeoPoint | None = None
    bbox: GeoPolygon | None = None
    source: str = "MESH"
    swaths: list["HailSwathResponse"] | None = None  # only when include=swaths

    model_config = {"from_attributes": True}


class StormsListResponse(BaseModel):
    storms: list[StormResponse]
    cursor: str | None = None
    total: int


class HailSwathResponse(BaseModel):
    id: str
    hail_size_category: str
    geometry: GeoMultiPolygon | None = None
    updated_at: datetime


class StormDetailResponse(BaseModel):
    id: str
    start_time: datetime
    end_time: datetime
    max_hail_size_in: float
    source: str = "MESH"
    centroid: GeoPoint | None = None
    bbox: GeoPolygon | None = None
    swaths: list[HailSwathResponse] = Field(default_factory=list)


class HailAtPointResponse(BaseModel):
    id: str
    start_time: datetime
    end_time: datetime
    max_hail_size_in: float
    source: str = "MESH"
    category_at_point: str = Field(
        ..., description="Largest hail-size category whose polygon contains the point"
    )


class HailAtPointListResponse(BaseModel):
    lat: float
    lng: float
    hits: list[HailAtPointResponse]
    total: int


# ---- Hail Replay (M4 stub, kept for shape continuity) ----

class NexradFrameResponse(BaseModel):
    id: str
    timestamp: datetime
    radar_site: str
    tile_url_pattern: str


class StormReplayResponse(BaseModel):
    storm_id: str
    frames: list[NexradFrameResponse] = Field(default_factory=list)


# ---- Public stats rollup (Phase 17.11) ----

class StormsStatsResponse(BaseModel):
    """Aggregate counts for the /v1/storms/stats endpoint."""
    total_cells: int
    cells_last_24h: int
    cells_last_7d: int
    cells_last_30d: int
    peak_hail_in: float
    earliest: datetime | None = None
    latest: datetime | None = None
    sources: dict[str, int] = Field(default_factory=dict)


# Resolve the forward reference on StormResponse.swaths so Pydantic v2
# can validate the field. `from __future__ import annotations` makes
# every annotation a string, so we need an explicit rebuild here.
StormResponse.model_rebuild()
