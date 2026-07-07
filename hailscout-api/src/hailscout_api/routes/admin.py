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

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.auth.invite import issue_and_send_set_password_invite
from hailscout_api.auth.middleware import bearer_token
from hailscout_api.auth.session import verify_access_token
from hailscout_api.auth.super_admin import require_super_admin
from hailscout_api.core import AuthenticationError
from hailscout_api.db.models.canvass import Marker, MonitoredAddress
from hailscout_api.db.models.mfa import TrustedDevice, UserMfaSecret
from hailscout_api.db.models.ops import ImpactReport
from hailscout_api.db.models.org import Organization, Seat, User, UserSession
from hailscout_api.db.session import get_db_session
from hailscout_api.schemas.admin import (
    OrgCreate,
    OrgSummary,
    OrgUsage,
    ResetMfaResponse,
    SetSuperAdmin,
    UserSummary,
)
from hailscout_api.services.audit import write_event
from hailscout_api.services.calibration import (
    compute_calibration,
    marketing_headline,
)
from hailscout_api.services.lsr_linker import link_recent_lsrs
from hailscout_api.services.storm_screener import screen_recent_storms

router = APIRouter(prefix="/admin")


async def require_org_admin(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> User:
    """Resolve the caller and require admin-grade authority over a tenant.

    Authorized when the caller is a super-admin (cross-tenant) OR holds an
    org ``owner`` / ``admin`` role. This is the same authority model the
    ``/v1/team`` write endpoints use; routes that span tenants must still
    scope by ``org_id`` against the resolved caller (see ``reset_user_mfa``).

    401 if there's no valid authenticated user; 403 if the user lacks an
    admin-grade role and is not a super-admin.
    """
    try:
        token = bearer_token(request)
        claims = verify_access_token(token)
    except AuthenticationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc

    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing sub claim.",
        )

    user = (
        await session.execute(select(User).where(User.id == user_id))
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found in database.",
        )

    if not user.is_super_admin and user.role not in {"owner", "admin"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Owner or admin role required for this operation.",
        )

    return user


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
        # Email the new org admin a one-click set-password link (additive; they
        # may instead sign in with Google/Microsoft). Token staged in the same
        # transaction; a mail failure never raises.
        await issue_and_send_set_password_invite(session, admin)

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

    # Storms are global NOAA data, so a raw storm count is identical for every
    # tenant and meaningless here. The useful per-tenant number is "storms this
    # tenant has actually worked" — distinct storms referenced by its markers.
    storms_in_period = (
        await session.execute(
            select(func.count(func.distinct(Marker.storm_id))).where(
                Marker.org_id == org_id, Marker.storm_id.is_not(None)
            )
        )
    ).scalar_one()

    monitored_addresses = (
        await session.execute(
            select(func.count())
            .select_from(MonitoredAddress)
            .where(MonitoredAddress.org_id == org_id)
        )
    ).scalar_one()

    impact_reports_generated = (
        await session.execute(
            select(func.count())
            .select_from(ImpactReport)
            .where(ImpactReport.org_id == org_id)
        )
    ).scalar_one()

    # Last-activity proxy: the most recent canvassing-marker touch for the org.
    last_active_at = (
        await session.execute(
            select(func.max(Marker.updated_at)).where(Marker.org_id == org_id)
        )
    ).scalar_one_or_none()

    return OrgUsage(
        org_id=org.id,
        name=org.name,
        plan_tier=org.plan_tier,
        user_count=int(user_count),
        seat_count=int(seat_count),
        storms_in_period=int(storms_in_period or 0),
        monitored_addresses=int(monitored_addresses or 0),
        impact_reports_generated=int(impact_reports_generated or 0),
        last_active_at=last_active_at,
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


@router.post("/users/{user_id}/reset-mfa", response_model=ResetMfaResponse)
async def reset_user_mfa(
    user_id: str,
    request: Request,
    actor: User = Depends(require_org_admin),
    session: AsyncSession = Depends(get_db_session),
) -> ResetMfaResponse:
    """Break-glass: clear another user's SMS 2FA so they can re-enroll.

    The rescue path for a teammate who is locked out of their second factor
    (recovery codes were retired fleet-wide; the enrolled phone is
    unreachable). This is intentionally NON-destructive — unlike
    ``DELETE /team/{user_id}`` it does not remove the account; it only
    un-enrolls 2FA:

    * deletes the ``user_mfa_secrets`` row (clearing ``phone_e164`` and the
      dormant ``recovery_codes_encrypted`` column with it),
    * revokes every live refresh session (so any in-flight session that
      already cleared 2FA is logged out and must re-authenticate),
    * revokes every remembered ("trusted") device (a stale trusted browser
      must not skip the second factor after the reset).

    The user re-enrolls from Settings on their next privileged login.

    Authz (account-takeover sensitive — gated strictly):
    * super-admins may reset any user (cross-tenant, consistent with the
      rest of ``/v1/admin``);
    * an org owner/admin may reset ONLY users in their OWN org, and may NOT
      reset a super-admin (no resetting a higher privilege than the app
      already lets you manage);
    * resetting yourself is refused — fix self-lockout via the normal
      texted-code disable in Settings, not this break-glass lever.

    Idempotent: resetting a user who isn't enrolled still revokes any
    lingering sessions/trusted devices and returns 200 (``was_enrolled``
    is false).
    """
    target = (
        await session.execute(select(User).where(User.id == user_id))
    ).scalar_one_or_none()
    if target is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    # Self-lockout guard: this lever is for rescuing OTHER people. An admin
    # who can still authenticate should disable 2FA the normal way.
    if target.id == actor.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "You can't reset your own two-factor here. Disable it from "
                "Settings with a texted code instead."
            ),
        )

    # Tenant + privilege scoping for non-super-admins. Super-admins manage
    # every org (same as the rest of this router) so they skip both checks.
    if not actor.is_super_admin:
        if target.org_id != actor.org_id:
            # Don't reveal cross-tenant existence — 404, not 403.
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found.",
            )
        if target.is_super_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can't reset two-factor for a super-admin.",
            )

    now = datetime.now(timezone.utc)

    # 1) Drop the MFA enrollment row entirely. Deleting it clears phone_e164
    #    AND the dormant recovery_codes_encrypted column in one shot, leaving
    #    the user fully un-enrolled (mfa_status → enrolled=false).
    mfa_row = (
        await session.execute(
            select(UserMfaSecret).where(UserMfaSecret.user_id == target.id)
        )
    ).scalar_one_or_none()
    was_enrolled = bool(mfa_row and mfa_row.enabled_at)
    if mfa_row is not None:
        await session.delete(mfa_row)

    # 2) Revoke every live refresh session (same idiom as provision.disable):
    #    a session that already passed 2FA must not survive the reset.
    sessions_result = await session.execute(
        update(UserSession)
        .where(UserSession.user_id == target.id, UserSession.revoked_at.is_(None))
        .values(revoked_at=now)
    )
    sessions_revoked = int(sessions_result.rowcount or 0)

    # 3) Revoke remembered devices so a trusted browser can't skip the
    #    second factor after re-enrollment (LOGIN-STANDARD §4).
    devices_result = await session.execute(
        update(TrustedDevice)
        .where(
            TrustedDevice.user_id == target.id,
            TrustedDevice.revoked_at.is_(None),
        )
        .values(revoked_at=now)
    )
    trusted_devices_revoked = int(devices_result.rowcount or 0)

    # 4) Append-only audit row (actor, target, action, ts) — the app's
    #    standard write_event shape, matching auth.mfa_disabled etc.
    await write_event(
        session,
        action="admin.mfa_reset",
        org_id=target.org_id,
        user_id=actor.id,
        subject_type="user",
        subject_id=target.id,
        metadata={
            "target_email": target.email,
            "was_enrolled": was_enrolled,
            "by_super_admin": bool(actor.is_super_admin),
        },
        commit=False,
    )
    await session.commit()

    return ResetMfaResponse(
        ok=True,
        user_id=target.id,
        was_enrolled=was_enrolled,
        sessions_revoked=sessions_revoked,
        trusted_devices_revoked=trusted_devices_revoked,
    )


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
