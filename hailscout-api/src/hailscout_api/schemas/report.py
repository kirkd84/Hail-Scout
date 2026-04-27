"""Schemas for impact reports (M2)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class BrandingInfo(BaseModel):
    """Company branding for report."""

    logo_url: str | None = None
    company: str
    phone: str


class HailImpactReportCreate(BaseModel):
    """Generate Hail Impact Report (M2)."""

    parcel_id: str
    storm_ids: list[str] | None = None
    branding: BrandingInfo = Field(..., description="Company branding")


class HailImpactReportResponse(BaseModel):
    """Generated report (M2)."""

    id: str
    org_id: str
    parcel_id: str
    pdf_s3_key: str
    generated_at: str
    download_url: str | None = None
