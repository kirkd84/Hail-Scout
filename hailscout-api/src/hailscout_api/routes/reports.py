"""Hail Impact Report endpoints (Month 2+)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from hailscout_api.schemas.report import (
    HailImpactReportCreate,
    HailImpactReportResponse,
)

router = APIRouter()


@router.post("/reports/hail-impact")
async def generate_hail_impact_report(
    request: HailImpactReportCreate,
) -> HailImpactReportResponse:
    """Generate branded Hail Impact Report PDF (Month 2).

    TODO(M2): Implement PDF generation with React-PDF
    """
    raise HTTPException(status_code=501, detail="Not implemented (Month 2)")


@router.get("/reports/{report_id}")
async def get_report(report_id: str) -> dict:
    """Retrieve generated PDF (Month 2).

    TODO(M2): Implement report retrieval and S3 presigned URL generation
    """
    raise HTTPException(status_code=501, detail="Not implemented (Month 2)")
