"""Contact enrichment endpoints (Month 3+, Cole-gated)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from hailscout_api.schemas.contact import (
    BulkContactExportRequest,
    BulkContactExportResponse,
    ContactEnrichRequest,
    ContactEnrichResponse,
)

router = APIRouter()


@router.post("/contacts/enrich", response_model=ContactEnrichResponse)
async def enrich_contact(request: ContactEnrichRequest) -> ContactEnrichResponse:
    """Enrich parcel with Cole contact data (Month 3).

    TODO(M3): Integrate Cole API, handle license restrictions
    """
    raise HTTPException(status_code=501, detail="Not implemented (Month 3)")


@router.post("/contacts/bulk-export", response_model=BulkContactExportResponse)
async def bulk_export_contacts(
    request: BulkContactExportRequest,
) -> BulkContactExportResponse:
    """Export contacts from polygon/storm with TCPA audit (Month 3).

    TODO(M3): Implement bulk export, logging for compliance
    """
    raise HTTPException(status_code=501, detail="Not implemented (Month 3)")
