"""Canvassing marker endpoints (Month 3+)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from hailscout_api.schemas.marker import MarkerCreate, MarkerResponse, MarkerUpdate

router = APIRouter()


@router.post("/markers", response_model=MarkerResponse)
async def create_marker(request: MarkerCreate) -> MarkerResponse:
    """Drop a canvassing marker (Month 3).

    TODO(M3): Implement marker creation with user location
    """
    raise HTTPException(status_code=501, detail="Not implemented (Month 3)")


@router.patch("/markers/{marker_id}", response_model=MarkerResponse)
async def update_marker(marker_id: str, request: MarkerUpdate) -> MarkerResponse:
    """Update marker status (Month 3).

    TODO(M3): Implement status transitions and audit logging
    """
    raise HTTPException(status_code=501, detail="Not implemented (Month 3)")


@router.get("/markers")
async def list_markers(
    storm_id: str | None = None,
    org_id: str | None = None,
) -> dict:
    """List markers with filters (Month 3).

    TODO(M3): Implement marker listing with pagination
    """
    raise HTTPException(status_code=501, detail="Not implemented (Month 3)")


@router.post("/markers/bulk-export")
async def bulk_export_markers() -> dict:
    """CSV export for offline ops (Month 3).

    TODO(M3): Implement CSV export
    """
    raise HTTPException(status_code=501, detail="Not implemented (Month 3)")
