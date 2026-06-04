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
    # LSR confirmation (Phase 23). When `lsr_confirmed` is true, an SPC
    # Local Storm Report fell inside this cell within ±30 min and the
    # observed size is in `lsr_observed_size_in`. The UI surfaces a
    # "ground-truth confirmed" badge on these.
    lsr_confirmed: bool = False
    lsr_observed_size_in: float | None = None
    lsr_observed_at: datetime | None = None
    # False-positive screening (Phase 23.5). `confidence` is in [0, 1];
    # `suspect` is true when confidence < SUSPECT_THRESHOLD; reasons
    # are explanatory tags ('implausibly_small_for_size', etc.).
    confidence: float = 1.0
    suspect: bool = False
    suspect_reasons: list[str] = Field(default_factory=list)
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
    lsr_confirmed: bool = False
    lsr_observed_size_in: float | None = None
    lsr_observed_at: datetime | None = None
    confidence: float = 1.0
    suspect: bool = False
    suspect_reasons: list[str] = Field(default_factory=list)
    swaths: list[HailSwathResponse] = Field(default_factory=list)


class VerificationSignal(BaseModel):
    key: str
    label: str
    present: bool
    detail: str = ""


class VerificationResponse(BaseModel):
    """Multi-source verification: the competitive differentiator.

    tier ∈ {ground_truth_confirmed, dual_pol_confirmed, multi_source,
    radar_indicated, unverified}. `defensibility` is the adjuster-facing
    paragraph; `signals` is the itemized evidence checklist.
    """
    tier: str
    tier_label: str
    tier_rank: int
    confidence: float
    headline: str
    defensibility: str
    signals: list[VerificationSignal] = Field(default_factory=list)


class HailAtPointResponse(BaseModel):
    id: str
    start_time: datetime
    end_time: datetime
    max_hail_size_in: float
    source: str = "MESH"
    category_at_point: str = Field(
        ..., description="Largest hail-size category whose polygon contains the point"
    )
    size_at_point: float | None = Field(
        None,
        description="Numeric hail size AT this point (inches) — the size "
                    "that actually fell here, not the storm's global peak. "
                    "This is the number to show for an address lookup.",
    )
    # Phase 24 multi-source verification (always present).
    lsr_confirmed: bool = False
    lsr_observed_size_in: float | None = None
    hail_confirmed: bool = False
    peak_dbz: float | None = None
    confidence: float = 1.0
    suspect: bool = False
    verification: VerificationResponse | None = None


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
