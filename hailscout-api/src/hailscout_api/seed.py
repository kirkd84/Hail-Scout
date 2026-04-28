"""Initial-data seeding for HailScout.

Idempotent. Runs on container start (after `alembic upgrade head`) and creates
the bootstrap orgs + users that make the demo deployment usable out of the box:

- ``HailScout Demo``  — public-facing demo tenant (used for prospect demos).
- ``Roof Technologies`` — Kirk's production tenant. Admin: kirk@rooftechnologies.com.
- ``kirk@copayee.com`` — system super-admin (cross-tenant). Belongs to the demo
  org by default but can manage every tenant.

Re-running is safe: every insert is gated by an existence check.

Invoke via the CLI: ``python -m hailscout_api.seed`` (or it runs at boot via
the Dockerfile CMD chain — see Dockerfile).
"""

from __future__ import annotations

import asyncio
import secrets
import sys
from typing import Final

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.config import get_settings
from hailscout_api.core.logging import get_logger, setup_logging
from hailscout_api.db.models.org import Organization, Seat, User
from hailscout_api.db.session import _normalize_async_url
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

logger = get_logger(__name__)


# ── Configuration: bootstrap data ────────────────────────────────────
DEMO_ORG_ID: Final = "org_hailscout_demo"
DEMO_ORG_NAME: Final = "HailScout Demo"

ROOF_TECH_ORG_ID: Final = "org_roof_technologies"
ROOF_TECH_ORG_NAME: Final = "Roof Technologies"

SUPER_ADMIN_EMAIL: Final = "kirk@copayee.com"
ROOF_TECH_ADMIN_EMAIL: Final = "kirk@rooftechnologies.com"


def _placeholder_clerk_id(label: str) -> str:
    """Placeholder clerk_user_id reconciled when the user signs in for real."""
    return f"pending_{label}_{secrets.token_urlsafe(6)}"


async def _ensure_org(
    session: AsyncSession,
    org_id: str,
    name: str,
    plan_tier: str = "internal",
) -> Organization:
    """Idempotently create an org. Returns the row (existing or new)."""
    existing = (
        await session.execute(select(Organization).where(Organization.id == org_id))
    ).scalar_one_or_none()
    if existing is not None:
        return existing

    org = Organization(id=org_id, name=name, plan_tier=plan_tier)
    session.add(org)
    await session.flush()
    logger.info("seed.org.created", org_id=org_id, name=name)
    return org


async def _ensure_user(
    session: AsyncSession,
    email: str,
    org_id: str,
    role: str,
    is_super_admin: bool = False,
) -> User:
    """Idempotently create a user. Updates super-admin flag if changed."""
    email = email.lower()
    existing = (
        await session.execute(select(User).where(User.email == email))
    ).scalar_one_or_none()
    if existing is not None:
        # Reconcile super-admin status if seed config changed it.
        if existing.is_super_admin != is_super_admin:
            existing.is_super_admin = is_super_admin
            logger.info(
                "seed.user.super_admin_updated",
                email=email,
                is_super_admin=is_super_admin,
            )
        return existing

    user = User(
        id=f"usr_{secrets.token_urlsafe(16)}",
        email=email,
        org_id=org_id,
        role=role,
        is_super_admin=is_super_admin,
        clerk_user_id=_placeholder_clerk_id(email.split("@")[0]),
    )
    session.add(user)
    await session.flush()
    logger.info(
        "seed.user.created",
        email=email,
        org_id=org_id,
        role=role,
        is_super_admin=is_super_admin,
    )

    # Allocate a seat so the user has workspace access on first sign-in.
    session.add(Seat(org_id=org_id, user_id=user.id))
    await session.flush()
    return user


async def seed() -> None:
    """Run the full seed sequence. Idempotent."""
    setup_logging("INFO")
    settings = get_settings()
    engine = create_async_engine(_normalize_async_url(settings.database_url))
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async with factory() as session:
        try:
            demo = await _ensure_org(session, DEMO_ORG_ID, DEMO_ORG_NAME)
            roof = await _ensure_org(
                session, ROOF_TECH_ORG_ID, ROOF_TECH_ORG_NAME, plan_tier="internal"
            )

            await _ensure_user(
                session,
                email=SUPER_ADMIN_EMAIL,
                org_id=demo.id,
                role="admin",
                is_super_admin=True,
            )
            await _ensure_user(
                session,
                email=ROOF_TECH_ADMIN_EMAIL,
                org_id=roof.id,
                role="admin",
                is_super_admin=False,
            )

            await session.commit()
            logger.info("seed.complete")
        except Exception as exc:
            await session.rollback()
            logger.error("seed.failed", error=str(exc), exc_info=True)
            raise
        finally:
            await engine.dispose()


def main() -> int:
    """CLI entry. Returns process exit code."""
    try:
        asyncio.run(seed())
        return 0
    except Exception:
        return 1


if __name__ == "__main__":
    sys.exit(main())
