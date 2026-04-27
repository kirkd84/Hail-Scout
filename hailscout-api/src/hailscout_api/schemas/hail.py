"""Schemas for hail impact queries."""

from __future__ import annotations

from pydantic import BaseModel, Field


class AddressInfo(BaseModel):
    """Geocoded address information."""

    query: str = Field(..., description="Original query string")
    formatted: str = Field(..., description="Formatted address")
    lat: float = Field(..., description="Latitude (WGS84)")
    lng: float = Field(..., description="Longitude (WGS84)")


class HailImpactRecord(BaseModel):
    """Historical hail impact at a location."""

    storm_id: str
    date: str = Field(..., description="ISO 8601 date")
    max_hail_size_in: float
    category: str = Field(..., description="Hail size category (e.g., '1.5\"')")
    distance_miles: float = Field(..., description="Distance from query point")
    impact_probability: float = Field(
        ..., description="Probability (0.0-1.0) point was impacted"
    )


class HailAtAddressResponse(BaseModel):
    """Historical hail impact at an address."""

    address: AddressInfo
    hail_history: list[HailImpactRecord] = Field(
        default_factory=list, description="Chronological hail history"
    )
