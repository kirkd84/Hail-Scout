"""Schemas for territory zones."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class TerritoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    polygon: list[list[float]] = Field(..., description="List of [lng,lat] pairs")
    color: Optional[str] = None
    assignee_user_id: Optional[str] = None
    notes: Optional[str] = None


class TerritoryUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    assignee_user_id: Optional[str] = None
    notes: Optional[str] = None
    polygon: Optional[list[list[float]]] = None


class TerritoryResponse(BaseModel):
    id: str
    org_id: str
    name: str
    color: Optional[str] = None
    polygon: list[list[float]]
    assignee_user_id: Optional[str] = None
    assignee_email: Optional[str] = None
    notes: Optional[str] = None
    created_by_user_id: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
