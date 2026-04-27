"""Schemas for monitored address alerts (M3)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class MonitoredAddressCreate(BaseModel):
    """Create monitored address (M3)."""

    parcel_id: str
    label: str = Field(..., description="Display name (e.g., 'HQ building')")
    alert_threshold_in: float = Field(..., description="Hail size to trigger alert")


class MonitoredAddressResponse(BaseModel):
    """Monitored address (M3)."""

    id: int
    org_id: str
    parcel_id: str
    label: str
    alert_threshold_in: float
    created_at: datetime

    model_config = {"from_attributes": True}
