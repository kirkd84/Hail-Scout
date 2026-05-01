"""Schemas for the CRM-lite HsContact."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field

VALID_STATUSES = {"prospect", "customer", "lost"}


class ContactCreate(BaseModel):
    monitored_address_id: Optional[int] = None
    name: str = Field(..., min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    status: str = "prospect"
    notes: Optional[str] = None
    follow_up_at: Optional[datetime] = None


class ContactUpdate(BaseModel):
    monitored_address_id: Optional[int] = None
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    follow_up_at: Optional[datetime] = None


class ContactResponse(BaseModel):
    id: str
    org_id: str
    monitored_address_id: Optional[int]
    name: str
    email: Optional[str]
    phone: Optional[str]
    status: str
    notes: Optional[str]
    follow_up_at: Optional[datetime]
    created_by_user_id: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
