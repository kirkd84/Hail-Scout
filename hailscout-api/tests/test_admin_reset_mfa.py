"""Integration tests for admin-initiated MFA reset (break-glass un-enroll).

Covers the security-sensitive endpoint ``POST /v1/admin/users/{id}/reset-mfa``:
the happy path (clears the secret, revokes sessions + trusted devices, writes
an audit row, idempotent) and the authz matrix (normal users blocked,
same-tenant scoping, no resetting a super-admin, no self-reset).

Uses an in-memory SQLite DB wired in via a ``get_db_session`` dependency
override, and mints a real HailScout access token so the endpoint's own
verify-and-lookup runs end to end.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from hailscout_api.auth.session import mint_access_token
from hailscout_api.db.base import Base
from hailscout_api.db.models.audit import AuditEvent
from hailscout_api.db.models.mfa import TrustedDevice, UserMfaSecret
from hailscout_api.db.models.org import Organization, User, UserSession
from hailscout_api.db.session import get_db_session
from hailscout_api.main import create_app

_SECRET = "test-secret-please-ignore-0123456789"


@pytest.fixture(autouse=True)
def _set_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    # mint/verify_access_token need a signing secret + non-negative TTL.
    # get_settings() is lru_cached, so clear it after setting env (and after
    # the test) to pick up these values regardless of import-time caching.
    from hailscout_api.config import get_settings

    monkeypatch.setenv("SESSION_JWT_SECRET", _SECRET)
    monkeypatch.setenv("SESSION_ACCESS_TTL_SECONDS", "3600")
    monkeypatch.setenv("SESSION_JWT_ISSUER", "hailscout")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
async def app_and_session():
    """Build the app with an in-memory SQLite DB bound to get_db_session."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )
    # Create only the tables this endpoint touches. The full metadata
    # includes GeoAlchemy2/PostGIS geometry tables (parcels) that can't be
    # created on plain SQLite (no SpatiaLite); we don't need them here.
    tables = [
        Organization.__table__,
        User.__table__,
        UserSession.__table__,
        UserMfaSecret.__table__,
        TrustedDevice.__table__,
        AuditEvent.__table__,
    ]
    async with engine.begin() as conn:
        await conn.run_sync(lambda c: Base.metadata.create_all(c, tables=tables))
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    app = create_app()

    async def _override_get_db_session():
        async with factory() as s:
            yield s

    app.dependency_overrides[get_db_session] = _override_get_db_session
    try:
        yield app, factory
    finally:
        app.dependency_overrides.clear()
        await engine.dispose()


async def _seed(
    factory: async_sessionmaker[AsyncSession],
    *,
    actor_role: str = "owner",
    actor_super: bool = False,
    actor_org: str = "org_a",
    target_org: str = "org_a",
    target_super: bool = False,
    target_enrolled: bool = True,
) -> tuple[str, str]:
    """Seed two orgs, an actor, and a target (optionally enrolled in 2FA).

    Returns ``(actor_id, target_id)``.
    """
    async with factory() as s:
        for org_id in {actor_org, target_org}:
            s.add(Organization(id=org_id, name=f"Org {org_id}"))
        actor = User(
            id="usr_actor",
            email="actor@example.com",
            org_id=actor_org,
            role=actor_role,
            is_super_admin=actor_super,
            auth_subject="sub_actor",
        )
        target = User(
            id="usr_target",
            email="target@example.com",
            org_id=target_org,
            role="member",
            is_super_admin=target_super,
            auth_subject="sub_target",
        )
        s.add_all([actor, target])
        now = datetime.now(timezone.utc)
        if target_enrolled:
            s.add(
                UserMfaSecret(
                    user_id=target.id,
                    phone_e164="+15551234567",
                    recovery_codes_encrypted="dormant-ciphertext",
                    enabled_at=now,
                )
            )
            s.add(
                UserSession(
                    id="sess_target",
                    user_id=target.id,
                    refresh_token_hash="hash_target",
                    expires_at=now + timedelta(days=7),
                )
            )
            s.add(
                TrustedDevice(
                    id="tdv_target",
                    user_id=target.id,
                    token_hash="tdv_hash",
                    expires_at=now + timedelta(days=90),
                )
            )
        await s.commit()
    return actor.id, target.id


def _auth(user_id: str, org_id: str) -> dict[str, str]:
    token, _ = mint_access_token(
        user_id=user_id, email="actor@example.com", org_id=org_id
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_owner_resets_member_mfa_clears_everything(app_and_session) -> None:
    app, factory = app_and_session
    actor_id, target_id = await _seed(factory, actor_role="owner")

    async with AsyncClient(app=app, base_url="http://test") as ac:
        res = await ac.post(
            f"/v1/admin/users/{target_id}/reset-mfa",
            headers=_auth(actor_id, "org_a"),
        )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["ok"] is True
    assert body["was_enrolled"] is True
    assert body["sessions_revoked"] == 1
    assert body["trusted_devices_revoked"] == 1

    # The MFA row (incl. the dormant recovery column) is gone; sessions and
    # trusted devices are revoked; an append-only audit row was written.
    async with factory() as s:
        assert await s.get(UserMfaSecret, target_id) is None
        sess = await s.get(UserSession, "sess_target")
        assert sess is not None and sess.revoked_at is not None
        tdv = await s.get(TrustedDevice, "tdv_target")
        assert tdv is not None and tdv.revoked_at is not None
        events = (await s.execute(__import__("sqlalchemy").select(AuditEvent))).scalars().all()
        reset_events = [e for e in events if e.action == "admin.mfa_reset"]
        assert len(reset_events) == 1
        assert reset_events[0].user_id == actor_id  # actor
        assert reset_events[0].subject_id == target_id  # target


@pytest.mark.asyncio
async def test_reset_is_idempotent_for_unenrolled_user(app_and_session) -> None:
    app, factory = app_and_session
    actor_id, target_id = await _seed(factory, target_enrolled=False)

    async with AsyncClient(app=app, base_url="http://test") as ac:
        res = await ac.post(
            f"/v1/admin/users/{target_id}/reset-mfa",
            headers=_auth(actor_id, "org_a"),
        )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["ok"] is True
    assert body["was_enrolled"] is False
    assert body["sessions_revoked"] == 0
    assert body["trusted_devices_revoked"] == 0


@pytest.mark.asyncio
async def test_normal_member_cannot_reset(app_and_session) -> None:
    app, factory = app_and_session
    actor_id, target_id = await _seed(factory, actor_role="member")

    async with AsyncClient(app=app, base_url="http://test") as ac:
        res = await ac.post(
            f"/v1/admin/users/{target_id}/reset-mfa",
            headers=_auth(actor_id, "org_a"),
        )
    assert res.status_code == 403, res.text


@pytest.mark.asyncio
async def test_admin_cannot_reset_other_tenant(app_and_session) -> None:
    app, factory = app_and_session
    # Actor is an owner in org_a; target lives in org_b.
    actor_id, target_id = await _seed(
        factory, actor_role="owner", actor_org="org_a", target_org="org_b"
    )

    async with AsyncClient(app=app, base_url="http://test") as ac:
        res = await ac.post(
            f"/v1/admin/users/{target_id}/reset-mfa",
            headers=_auth(actor_id, "org_a"),
        )
    # Cross-tenant target is hidden as 404, and the secret must survive.
    assert res.status_code == 404, res.text
    async with factory() as s:
        assert await s.get(UserMfaSecret, target_id) is not None


@pytest.mark.asyncio
async def test_org_admin_cannot_reset_super_admin(app_and_session) -> None:
    app, factory = app_and_session
    actor_id, target_id = await _seed(
        factory, actor_role="owner", target_super=True
    )

    async with AsyncClient(app=app, base_url="http://test") as ac:
        res = await ac.post(
            f"/v1/admin/users/{target_id}/reset-mfa",
            headers=_auth(actor_id, "org_a"),
        )
    assert res.status_code == 403, res.text


@pytest.mark.asyncio
async def test_super_admin_can_reset_cross_tenant(app_and_session) -> None:
    app, factory = app_and_session
    actor_id, target_id = await _seed(
        factory,
        actor_role="member",  # role irrelevant when super-admin
        actor_super=True,
        actor_org="org_a",
        target_org="org_b",
    )

    async with AsyncClient(app=app, base_url="http://test") as ac:
        res = await ac.post(
            f"/v1/admin/users/{target_id}/reset-mfa",
            headers=_auth(actor_id, "org_a"),
        )
    assert res.status_code == 200, res.text
    assert res.json()["was_enrolled"] is True


@pytest.mark.asyncio
async def test_cannot_reset_self(app_and_session) -> None:
    app, factory = app_and_session
    actor_id, _ = await _seed(factory, actor_role="owner")

    async with AsyncClient(app=app, base_url="http://test") as ac:
        res = await ac.post(
            f"/v1/admin/users/{actor_id}/reset-mfa",
            headers=_auth(actor_id, "org_a"),
        )
    assert res.status_code == 400, res.text


@pytest.mark.asyncio
async def test_requires_authentication(app_and_session) -> None:
    app, factory = app_and_session
    _, target_id = await _seed(factory)

    async with AsyncClient(app=app, base_url="http://test") as ac:
        res = await ac.post(f"/v1/admin/users/{target_id}/reset-mfa")
    assert res.status_code == 401, res.text
