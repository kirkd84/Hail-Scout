"""Schemas for canvassing markers."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

VALID_STATUSES = {"lead", "knocked", "no_answer", "appt", "contract", "not_interested"}


class MarkerCreate(BaseModel):
    """Create a canvassing marker."""

    lat: float = Field(..., description="Latitude")
    lng: float = Field(..., description="Longitude")
    status: str = Field(default="lead")
    notes: Optional[str] = None
    storm_id: Optional[str] = None
    parcel_id: Optional[str] = None
    assignee_user_id: Optional[str] = None
    client_id: Optional[str] = Field(
        default=None,
        description="Optional client-supplied id for idempotent upsert (used by localStorage->API migration).",
    )


class MarkerUpdate(BaseModel):
    """Update marker status / notes / assignee."""

    status: Optional[str] = None
    notes: Optional[str] = None
    assignee_user_id: Optional[str] = None


class MarkerResponse(BaseModel):
    """Canvassing marker response."""

    id: str
    user_id: str
    org_id: str
    lat: Optional[float]
    lng: Optional[float]
    status: str
    notes: Optional[str] = None
    storm_id: Optional[str] = None
    parcel_id: Optional[str] = None
    assignee_user_id: Optional[str] = None
    client_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MarkerBulkCreate(BaseModel):
    """Bulk create markers (used for localStorage->API migration on first sign-in)."""

    markers: list[MarkerCreate]
