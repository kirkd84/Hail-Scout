"""Contact enrichment endpoints.

Provider-pluggable and OFF by default. With no enrichment provider configured
(``ENRICHMENT_PROVIDER`` + ``ENRICHMENT_API_KEY``), these answer 503 rather than
fabricate TCPA/DNC-regulated homeowner contact data. See ``services.enrichment``.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, status

from hailscout_api.auth.middleware import extract_auth_context
from hailscout_api.core import get_logger
from hailscout_api.schemas.contact import (
    BulkContactExportRequest,
    BulkContactExportResponse,
    ContactEnrichRequest,
    ContactEnrichResponse,
)
from hailscout_api.services.enrichment import (
    EnrichmentError,
    EnrichmentNotConfigured,
    enrich_parcel,
    enrichment_configured,
)

logger = get_logger(__name__)
router = APIRouter()

_NOT_CONFIGURED = (
    "Contact enrichment isn't enabled for this workspace. Configure an "
    "enrichment provider (ENRICHMENT_PROVIDER + ENRICHMENT_API_KEY) to turn it on."
)


@router.post("/contacts/enrich", response_model=ContactEnrichResponse)
async def enrich_contact(
    body: ContactEnrichRequest, request: Request
) -> ContactEnrichResponse:
    """Enrich a parcel with homeowner contact data via the configured provider."""
    await extract_auth_context(request)
    try:
        data = await enrich_parcel(body.parcel_id)
    except EnrichmentNotConfigured as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, _NOT_CONFIGURED) from exc
    except EnrichmentError as exc:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, "Contact lookup failed. Please try again."
        ) from exc
    return ContactEnrichResponse(
        parcel_id=body.parcel_id,
        phone=data.get("phone"),
        email=data.get("email"),
        owner_name=data.get("owner_name"),
    )


@router.post("/contacts/bulk-export", response_model=BulkContactExportResponse)
async def bulk_export_contacts(
    body: BulkContactExportRequest, request: Request
) -> BulkContactExportResponse:
    """Export contacts from a polygon/storm with a TCPA-compliance audit row."""
    await extract_auth_context(request)
    if not body.consent_acknowledgment:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "consent_acknowledgment must be true to export contacts.",
        )
    # The export pipeline (polygon → contacts → CSV → audit row) sources its rows
    # from the enrichment provider, so it's gated on the same configuration.
    if not enrichment_configured():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, _NOT_CONFIGURED)
    raise HTTPException(
        status.HTTP_501_NOT_IMPLEMENTED,
        "Bulk export adapter for the configured provider is not yet implemented.",
    )
