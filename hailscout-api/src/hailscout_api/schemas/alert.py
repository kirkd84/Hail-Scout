"""Schemas for storm alerts."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class StormAlertResponse(BaseModel):
    id: int
    org_id: str
    monitored_address_id: int
    storm_id: str
    storm_city: Optional[str] = None
    peak_size_in: float
    storm_started_at: datetime
    read_at: Optional[datetime] = None
    dismissed_at: Optional[datetime] = None
    created_at: datetime
    # Joined-in convenience fields (set by the route handler)
    address: Optional[str] = None
    address_label: Optional[str] = None

    model_config = {"from_attributes": True}


class StormAlertList(BaseModel):
    alerts: list[StormAlertResponse]
    unread_count: int
    new_in_this_fetch: int
