"""Schemas for super-admin endpoints (cross-tenant management)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class OrgCreate(BaseModel):
    """Payload to create a new tenant org from super-admin UI."""

    name: str = Field(..., min_length=1, max_length=255, description="Display name")
    plan_tier: str = Field(default="free", description="Billing plan tier")
    admin_email: EmailStr | None = Field(
        default=None,
        description=(
            "Optional. If provided, an invite to that email will be created so "
            "they become the org's admin on first sign-in."
        ),
    )


class OrgSummary(BaseModel):
    """Org row in the super-admin org list."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    plan_tier: str
    user_count: int
    created_at: datetime


class OrgUsage(BaseModel):
    """Per-org usage stats — what the super-admin sees on the detail page."""

    org_id: str
    name: str
    plan_tier: str
    user_count: int
    seat_count: int
    storms_in_period: int
    monitored_addresses: int
    impact_reports_generated: int
    last_active_at: datetime | None


class UserSummary(BaseModel):
    """User row in super-admin views (cross-tenant)."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    org_id: str
    role: str
    is_super_admin: bool
    created_at: datetime


class SetSuperAdmin(BaseModel):
    """Payload to grant or revoke super-admin status."""

    user_email: EmailStr
    is_super_admin: bool
