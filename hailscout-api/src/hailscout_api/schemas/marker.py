"""Schemas for canvassing markers (M3)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class MarkerCreate(BaseModel):
    """Create a canvassing marker (M3)."""

    storm_id: str | None = None
    parcel_id: str | None = None
    lat: float = Field(..., description="Latitude")
    lng: float = Field(..., description="Longitude")
    status: str = Field(default="lead", description="lead, knocked, no_answer, appt, contract, not_interested")
    notes: str | None = None


class MarkerUpdate(BaseModel):
    """Update marker status (M3)."""

    status: str | None = None
    notes: str | None = None


class MarkerResponse(BaseModel):
    """Canvassing marker (M3)."""

    id: str
    user_id: str
    org_id: str
    status: str
    notes: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
