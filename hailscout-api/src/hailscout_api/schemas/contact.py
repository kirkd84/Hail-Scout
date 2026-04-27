"""Schemas for contact enrichment (M3)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ContactEnrichRequest(BaseModel):
    """Enrich single parcel with contact data (M3)."""

    parcel_id: str


class ContactEnrichResponse(BaseModel):
    """Enriched contact (M3)."""

    parcel_id: str
    phone: str | None = None
    email: str | None = None
    owner_name: str | None = None


class BulkContactExportRequest(BaseModel):
    """Export contacts from polygon/storm (M3)."""

    polygon: dict | None = None  # GeoJSON
    storm_id: str | None = None
    consent_acknowledgment: bool = Field(
        ..., description="User acknowledges TCPA compliance"
    )


class BulkContactExportResponse(BaseModel):
    """Contact export audit log (M3)."""

    id: str
    org_id: str
    row_count: int
    s3_key: str
    exported_at: str
