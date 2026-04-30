"""Schemas for saved Hail Impact Reports."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class SavedReportCreate(BaseModel):
    storm_id: Optional[str] = None
    storm_city: Optional[str] = None
    address: Optional[str] = None
    address_lat: Optional[float] = None
    address_lng: Optional[float] = None
    peak_size_in: Optional[float] = None
    storm_started_at: Optional[datetime] = None
    title: Optional[str] = Field(default=None, max_length=255)
    notes: Optional[str] = None


class SavedReportResponse(BaseModel):
    id: str
    org_id: str
    user_id: str
    storm_id: Optional[str] = None
    storm_city: Optional[str] = None
    address: Optional[str] = None
    address_lat: Optional[float] = None
    address_lng: Optional[float] = None
    peak_size_in: Optional[float] = None
    storm_started_at: Optional[datetime] = None
    title: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class OrgBranding(BaseModel):
    company_name: Optional[str] = None
    primary: Optional[str] = None  # hex
    accent: Optional[str] = None   # hex
    logo_url: Optional[str] = None


class OrgBrandingResponse(OrgBranding):
    org_id: str
