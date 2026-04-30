"""Saved Hail Impact Report endpoints + per-org branding."""

from __future__ import annotations

import secrets

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.auth.clerk import ClerkVerifier
from hailscout_api.config import get_settings
from hailscout_api.core import AuthenticationError, get_logger
from hailscout_api.db.models.canvass import SavedReport
from hailscout_api.db.models.org import Organization, User
from hailscout_api.db.session import get_db_session
from hailscout_api.schemas.saved_report import (
    OrgBranding,
    OrgBrandingResponse,
    SavedReportCreate,
    SavedReportResponse,
)

logger = get_logger(__name__)
router = APIRouter(prefix="/reports")


async def _resolve_user(request: Request, session: AsyncSession) -> User:
    settings = get_settings()
    verifier = ClerkVerifier(settings.clerk_jwks_endpoint, settings.clerk_secret_key)

    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise AuthenticationError("Missing Authorization header")
    try:
        scheme, token = auth_header.split(" ", 1)
    except ValueError as exc:
        raise AuthenticationError("Invalid Authorization header format") from exc
    if scheme.lower() != "bearer":
        raise AuthenticationError("Only Bearer tokens supported")

    claims = await verifier.verify_token(token)
    clerk_user_id = claims.get("sub")
    if not clerk_user_id:
        raise AuthenticationError("JWT missing sub claim")

    user = (
        await session.execute(select(User).where(User.clerk_user_id == clerk_user_id))
    ).scalars().first()
    if not user:
        raise AuthenticationError("User not found")
    return user


def _report_id() -> str:
    return f"rpt_{secrets.token_urlsafe(10)}"


# ── Reports ───────────────────────────────────────────────────────────


@router.get("", response_model=list[SavedReportResponse])
async def list_reports(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> list[SavedReport]:
    user = await _resolve_user(request, session)
    rows = (
        await session.execute(
            select(SavedReport)
            .where(SavedReport.org_id == user.org_id)
            .order_by(SavedReport.created_at.desc()),
        )
    ).scalars().all()
    return list(rows)


@router.post("", response_model=SavedReportResponse, status_code=201)
async def create_report(
    request: Request,
    body: SavedReportCreate,
    session: AsyncSession = Depends(get_db_session),
) -> SavedReport:
    user = await _resolve_user(request, session)
    rpt = SavedReport(
        id=_report_id(),
        org_id=user.org_id,
        user_id=user.id,
        storm_id=body.storm_id,
        storm_city=body.storm_city,
        address=body.address,
        address_lat=body.address_lat,
        address_lng=body.address_lng,
        peak_size_in=body.peak_size_in,
        storm_started_at=body.storm_started_at,
        title=body.title,
        notes=body.notes,
    )
    session.add(rpt)
    await session.commit()
    await session.refresh(rpt)
    return rpt


@router.delete("/{report_id}", status_code=204)
async def delete_report(
    request: Request,
    report_id: str,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    user = await _resolve_user(request, session)
    rpt = (
        await session.execute(
            select(SavedReport).where(
                and_(SavedReport.id == report_id, SavedReport.org_id == user.org_id),
            ),
        )
    ).scalars().first()
    if rpt is None:
        raise HTTPException(status_code=404, detail="Report not found")
    await session.delete(rpt)
    await session.commit()


# ── Org branding ──────────────────────────────────────────────────────


@router.get("/branding", response_model=OrgBrandingResponse)
async def get_branding(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> OrgBrandingResponse:
    user = await _resolve_user(request, session)
    org = (
        await session.execute(
            select(Organization).where(Organization.id == user.org_id),
        )
    ).scalars().first()
    if org is None:
        raise HTTPException(status_code=404, detail="Org not found")
    return OrgBrandingResponse(
        org_id=org.id,
        company_name=org.brand_company_name,
        primary=org.brand_primary,
        accent=org.brand_accent,
        logo_url=org.brand_logo_url,
    )


@router.patch("/branding", response_model=OrgBrandingResponse)
async def update_branding(
    request: Request,
    body: OrgBranding,
    session: AsyncSession = Depends(get_db_session),
) -> OrgBrandingResponse:
    user = await _resolve_user(request, session)
    if user.role not in {"admin", "owner"} and not user.is_super_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    org = (
        await session.execute(
            select(Organization).where(Organization.id == user.org_id),
        )
    ).scalars().first()
    if org is None:
        raise HTTPException(status_code=404, detail="Org not found")

    if body.company_name is not None:
        org.brand_company_name = body.company_name
    if body.primary is not None:
        org.brand_primary = body.primary
    if body.accent is not None:
        org.brand_accent = body.accent
    if body.logo_url is not None:
        org.brand_logo_url = body.logo_url

    await session.commit()
    await session.refresh(org)
    return OrgBrandingResponse(
        org_id=org.id,
        company_name=org.brand_company_name,
        primary=org.brand_primary,
        accent=org.brand_accent,
        logo_url=org.brand_logo_url,
    )
