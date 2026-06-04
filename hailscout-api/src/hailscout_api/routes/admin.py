"""Super-admin routes: cross-tenant org management.

Mounted under ``/v1/admin/*``. Every route requires the caller to have
``is_super_admin = true`` via the ``require_super_admin`` dependency.

These endpoints are how Kirk (or any future super-admin) manages tenants:
list every org, create a new one, see per-tenant usage, grant/revoke
super-admin to other users.
"""

from __future__ import annotations

import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.auth.super_admin import require_super_admin
from hailscout_api.db.models.org import Organization, Seat, User
from hailscout_api.db.models.storm import Storm
from hailscout_api.db.session import get_db_session
from hailscout_api.schemas.admin import (
    OrgCreate,
    OrgSummary,
    OrgUsage,
    SetSuperAdmin,
    UserSummary,
)
from hailscout_api.services.calibration import (
    compute_calibration,
    marketing_headline,
)
from hailscout_api.services.lsr_linker import link_recent_lsrs
from hailscout_api.services.storm_screener import screen_recent_storms

router = APIRouter(prefix="/admin")


def _generate_org_id() -> str:
    """Org IDs are URL-safe random strings (24 chars). Stable; not derived."""
    return f"org_{secrets.token_urlsafe(16)}"


@router.get("/orgs", response_model=list[OrgSummary])
async def list_orgs(
    _: User = Depends(require_super_admin),
    session: AsyncSession = Depends(get_db_session),
) -> list[OrgSummary]:
    """List every tenant org with a user count.

    Sorted newest-first. Used by the super-admin web UI.
    """
    stmt = (
        select(
            Organization,
            func.count(User.id).label("user_count"),
        )
        .outerjoin(User, User.org_id == Organization.id)
        .group_by(Organization.id)
        .order_by(Organization.created_at.desc())
    )
    rows = (await session.execute(stmt)).all()

    return [
        OrgSummary(
            id=org.id,
            name=org.name,
            plan_tier=org.plan_tier,
            user_count=int(user_count),
            created_at=org.created_at,
        )
        for org, user_count in rows
    ]


@router.post(
    "/orgs",
    response_model=OrgSummary,
    status_code=status.HTTP_201_CREATED,
)
async def create_org(
    payload: OrgCreate,
    _: User = Depends(require_super_admin),
    session: AsyncSession = Depends(get_db_session),
) -> OrgSummary:
    """Create a new tenant org.

    Creates the row in ``organizations``. If ``admin_email`` is provided, a
    ``users`` row is pre-staged with role=admin and a placeholder
    ``auth_subject`` — the row is linked to a real OAuth identity the first
    time that email signs in with Google/Microsoft.
    """
    # Reject duplicate org names — cheap collision guard at the application
    # layer. The DB has no unique constraint on name, but UX is much nicer
    # if super-admins don't accidentally create five "Acme Roofing" orgs.
    existing = (
        await session.execute(
            select(Organization).where(Organization.name == payload.name)
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An org named {payload.name!r} already exists.",
        )

    org = Organization(
        id=_generate_org_id(),
        name=payload.name,
        plan_tier=payload.plan_tier,
    )
    session.add(org)
    await session.flush()  # populate org.id / org.created_at

    if payload.admin_email:
        # Pre-stage the admin user row with a placeholder auth_subject. It gets
        # linked to the real OAuth identity (matched by email) the first time
        # that address signs in with Google/Microsoft.
        admin = User(
            id=f"usr_{secrets.token_urlsafe(16)}",
            email=str(payload.admin_email).lower(),
            org_id=org.id,
            role="admin",
            is_super_admin=False,
            auth_subject=f"pending_{secrets.token_urlsafe(8)}",
        )
        session.add(admin)
        await session.flush()
        # Allocate a seat so the user can immediately access the workspace
        # once their OAuth identity is linked on first sign-in.
        session.add(Seat(org_id=org.id, user_id=admin.id))

    await session.commit()
    await session.refresh(org)

    return OrgSummary(
        id=org.id,
        name=org.name,
        plan_tier=org.plan_tier,
        user_count=1 if payload.admin_email else 0,
        created_at=org.created_at,
    )


@router.get("/orgs/{org_id}/usage", response_model=OrgUsage)
async def org_usage(
    org_id: str,
    _: User = Depends(require_super_admin),
    session: AsyncSession = Depends(get_db_session),
) -> OrgUsage:
    """Per-tenant usage stats for the super-admin detail page."""
    org = (
        await session.execute(select(Organization).where(Organization.id == org_id))
    ).scalar_one_or_none()
    if org is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Organization {org_id} not found.",
        )

    user_count = (
        await session.execute(
            select(func.count()).select_from(User).where(User.org_id == org_id)
        )
    ).scalar_one()

    seat_count = (
        await session.execute(
            select(func.count()).select_from(Seat).where(Seat.org_id == org_id)
        )
    ).scalar_one()

    # ``storms`` is global (not org-scoped) — every tenant sees the same NOAA
    # data. We count "storms touched by this tenant" via a join through
    # markers/monitored_addresses in a future iteration. For now report 0.
    storms_in_period = 0
    # TODO(M3): join Storm <-> markers <-> users.org_id for per-tenant counts.
    _ = Storm  # silence unused import

    monitored_addresses = 0  # TODO(M3): COUNT(monitored_addresses WHERE org_id=...)
    impact_reports_generated = 0  # TODO(M3): COUNT(impact_reports WHERE org_id=...)

    return OrgUsage(
        org_id=org.id,
        name=org.name,
        plan_tier=org.plan_tier,
        user_count=int(user_count),
        seat_count=int(seat_count),
        storms_in_period=storms_in_period,
        monitored_addresses=monitored_addresses,
        impact_reports_generated=impact_reports_generated,
        last_active_at=None,  # TODO(M3): track via auth events
    )


@router.get("/orgs/{org_id}/users", response_model=list[UserSummary])
async def list_org_users(
    org_id: str,
    _: User = Depends(require_super_admin),
    session: AsyncSession = Depends(get_db_session),
) -> list[UserSummary]:
    """List users within a tenant org."""
    rows = (
        await session.execute(
            select(User)
            .where(User.org_id == org_id)
            .order_by(User.created_at.desc())
        )
    ).scalars().all()

    return [UserSummary.model_validate(u) for u in rows]


@router.post("/users/super-admin", response_model=UserSummary)
async def set_super_admin(
    payload: SetSuperAdmin,
    _: User = Depends(require_super_admin),
    session: AsyncSession = Depends(get_db_session),
) -> UserSummary:
    """Grant or revoke super-admin status for a user (by email).

    Idempotent: setting an already-super-admin to true is a no-op.
    Refuses to revoke if the target is the LAST remaining super-admin
    (prevents accidental lock-out).
    """
    target = (
        await session.execute(
            select(User).where(User.email == str(payload.user_email).lower())
        )
    ).scalar_one_or_none()
    if target is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No user with email {payload.user_email}.",
        )

    if not payload.is_super_admin:
        # Lock-out guard: refuse to revoke the last super-admin.
        remaining = (
            await session.execute(
                select(func.count()).select_from(User).where(User.is_super_admin)
            )
        ).scalar_one()
        if int(remaining) <= 1 and target.is_super_admin:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Cannot revoke the last super-admin. Promote another user "
                    "first, then retry."
                ),
            )

    target.is_super_admin = payload.is_super_admin
    target.updated_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(target)

    return UserSummary.model_validate(target)


@router.post("/lsr/link")
async def run_lsr_linker(
    lookback_days: int = 30,
    _: User = Depends(require_super_admin),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Run the LSR ↔ NEXRAD/MRMS confirmation pass on demand.

    Walks every Storm row with `source='SPC-LSR'` from the last
    `lookback_days` and stamps any radar-cell match with
    `lsr_confirmed=true`. Idempotent — re-running just refreshes
    flags. Will become a periodic worker job; this endpoint is the
    manual override for ad-hoc backfill confirmation.

    Cap is 3650 days (10y) so a full historical backfill can be
    confirmed in one pass after the LSR + NEXRAD backfills complete.
    """
    if lookback_days < 1 or lookback_days > 3650:
        raise HTTPException(status_code=422,
                            detail="lookback_days must be 1..3650")
    summary = await link_recent_lsrs(session, lookback_days=lookback_days)
    return {"ok": True, **summary}


@router.post("/storms/screen")
async def run_storm_screener(
    lookback_days: int = 14,
    only_unscreened: bool = False,
    limit: int | None = None,
    _: User = Depends(require_super_admin),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Re-evaluate storm rows against the false-positive screener.

    Stamps `confidence`, `suspect`, and `suspect_reasons` on every
    Storm in the lookback window. Pass `only_unscreened=true` to
    process just rows the live pipeline has added since the last run.
    """
    if lookback_days < 1 or lookback_days > 365:
        raise HTTPException(status_code=422,
                            detail="lookback_days must be 1..365")
    summary = await screen_recent_storms(
        session,
        lookback_days=lookback_days,
        only_unscreened=bool(only_unscreened),
        limit=limit,
    )
    return {"ok": True, **summary}


@router.get("/calibration")
async def get_calibration(
    min_size_in: float = 0.0,
    _: User = Depends(require_super_admin),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Radar-estimate vs. ground-truth accuracy across confirmed pairs.

    Returns error metrics (MAE, bias, RMSE), tolerance-band hit rates,
    a by-size breakdown, and — when the sample is large enough — a
    publishable marketing headline. `min_size_in` restricts to
    claim-relevant sizes.
    """
    calib = await compute_calibration(session, min_size_in=min_size_in)
    headline = marketing_headline(calib)
    return {"ok": True, "headline": headline, **calib}
