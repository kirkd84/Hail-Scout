"""Schemas for /me endpoint."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class SeatResponse(BaseModel):
    """User seat in organization."""

    id: int
    user_id: str
    assigned_at: datetime

    model_config = {"from_attributes": True}


class OrganizationResponse(BaseModel):
    """Organization details."""

    id: str
    name: str
    plan_tier: str
    created_at: datetime

    model_config = {"from_attributes": True}


class UserResponse(BaseModel):
    """User details."""

    id: str
    email: str
    role: str
    is_super_admin: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class MeResponse(BaseModel):
    """Complete user profile with org and seats."""

    user: UserResponse = Field(..., description="Current user")
    organization: OrganizationResponse = Field(..., description="Primary organization")
    seats: list[SeatResponse] = Field(
        default_factory=list, description="Allocated seats"
    )
