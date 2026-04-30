"""Schemas for monitored address subscriptions."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class MonitoredAddressCreate(BaseModel):
    """Create a monitored address."""

    address: str = Field(..., description="Pretty-formatted full address")
    lat: float
    lng: float
    label: Optional[str] = None
    alert_threshold_in: Optional[float] = Field(default=0.75, ge=0.5, le=4.0)
    # Cached snapshot at save time
    last_storm_at: Optional[datetime] = None
    last_storm_size_in: Optional[float] = None


class MonitoredAddressUpdate(BaseModel):
    """Update label / alert threshold / cached storm meta."""

    label: Optional[str] = None
    alert_threshold_in: Optional[float] = None
    last_storm_at: Optional[datetime] = None
    last_storm_size_in: Optional[float] = None


class MonitoredAddressResponse(BaseModel):
    """Monitored address response."""

    id: int
    org_id: str
    user_id: Optional[str] = None
    address: Optional[str] = None
    label: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    alert_threshold_in: Optional[float] = None
    last_storm_at: Optional[datetime] = None
    last_storm_size_in: Optional[float] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MonitoredAddressBulkCreate(BaseModel):
    """Bulk create monitored addresses (used for localStorage->API migration)."""

    addresses: list[MonitoredAddressCreate]
