"""Alert-zone request/response schemas (Phase 33 — storm alarms)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

ZoneKind = Literal["radius", "states", "nationwide"]

# 50 states + DC + PR — matches the us_states matching table.
VALID_STATES = {
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI",
    "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN",
    "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH",
    "OK", "OR", "PA", "PR", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA",
    "WA", "WV", "WI", "WY",
}


class AlertZoneBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    kind: ZoneKind
    center_lat: Optional[float] = Field(None, ge=-90, le=90)
    center_lng: Optional[float] = Field(None, ge=-180, le=180)
    radius_mi: Optional[float] = Field(None, gt=0, le=500)
    states: Optional[list[str]] = None
    min_hail_in: Optional[float] = Field(None, ge=0.5, le=6.0)
    min_wind_mph: Optional[float] = Field(None, ge=40, le=250)
    enabled: bool = True


class AlertZoneCreate(AlertZoneBase):
    pass


class AlertZoneUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    kind: Optional[ZoneKind] = None
    center_lat: Optional[float] = Field(None, ge=-90, le=90)
    center_lng: Optional[float] = Field(None, ge=-180, le=180)
    radius_mi: Optional[float] = Field(None, gt=0, le=500)
    states: Optional[list[str]] = None
    min_hail_in: Optional[float] = Field(None, ge=0.5, le=6.0)
    min_wind_mph: Optional[float] = Field(None, ge=40, le=250)
    enabled: Optional[bool] = None


class AlertZoneResponse(AlertZoneBase):
    id: str
    org_id: str
    user_id: str
    created_at: datetime
    updated_at: datetime
