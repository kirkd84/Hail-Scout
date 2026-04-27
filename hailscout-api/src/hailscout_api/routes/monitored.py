"""Monitored address alert endpoints (Month 3+)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from hailscout_api.schemas.monitored_address import (
    MonitoredAddressCreate,
    MonitoredAddressResponse,
)

router = APIRouter()


@router.post("/monitored-addresses", response_model=MonitoredAddressResponse)
async def create_monitored_address(
    request: MonitoredAddressCreate,
) -> MonitoredAddressResponse:
    """Create monitored address (Month 3).

    TODO(M3): Implement address monitoring and alert threshold config
    """
    raise HTTPException(status_code=501, detail="Not implemented (Month 3)")


@router.get("/monitored-addresses")
async def list_monitored_addresses() -> dict:
    """List monitored addresses (Month 3).

    TODO(M3): Implement listing with pagination
    """
    raise HTTPException(status_code=501, detail="Not implemented (Month 3)")


@router.delete("/monitored-addresses/{address_id}")
async def delete_monitored_address(address_id: int) -> dict:
    """Remove monitored address (Month 3).

    TODO(M3): Implement deletion and alert cleanup
    """
    raise HTTPException(status_code=501, detail="Not implemented (Month 3)")


@router.get("/alerts")
async def list_alerts(from_date: str | None = None, to_date: str | None = None) -> dict:
    """List triggered alerts (Month 3).

    TODO(M3): Implement alert history with date filtering
    """
    raise HTTPException(status_code=501, detail="Not implemented (Month 3)")
