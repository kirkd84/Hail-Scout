"""Unit tests for HailScout's own session-token core (no DB needed).

These cover the security-critical primitives: access-token round-trip, tamper
rejection, wrong-secret rejection, expiry, token-type enforcement, and the
refresh-token hashing. DB-backed flows (exchange/refresh/logout) are covered
by integration tests.
"""

from __future__ import annotations

import asyncio

import jwt
import pytest

from hailscout_api.auth import session as S
from hailscout_api.auth.oidc import verify_oidc_id_token
from hailscout_api.core import AuthenticationError

_SECRET = "test-secret-please-ignore-0123456789"


@pytest.fixture(autouse=True)
def _set_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SESSION_JWT_SECRET", _SECRET)
    monkeypatch.setenv("SESSION_ACCESS_TTL_SECONDS", "3600")


def test_access_token_roundtrip() -> None:
    token, ttl = S.mint_access_token(
        user_id="usr_abc", email="a@b.com", org_id="org_1"
    )
    assert ttl == 3600
    claims = S.verify_access_token(token)
    assert claims["sub"] == "usr_abc"
    assert claims["email"] == "a@b.com"
    assert claims["org_id"] == "org_1"
    assert claims["typ"] == "access"


def test_tampered_token_rejected() -> None:
    token, _ = S.mint_access_token(user_id="u", email="a@b.com", org_id="o")
    # Flip a character in the signature segment.
    head, payload, sig = token.split(".")
    bad = f"{head}.{payload}.{sig[:-2]}xx"
    with pytest.raises(AuthenticationError):
        S.verify_access_token(bad)


def test_wrong_secret_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    token, _ = S.mint_access_token(user_id="u", email="a@b.com", org_id="o")
    monkeypatch.setenv("SESSION_JWT_SECRET", "a-totally-different-secret-value")
    with pytest.raises(AuthenticationError):
        S.verify_access_token(token)


def test_expired_token_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SESSION_ACCESS_TTL_SECONDS", "-5")  # already expired
    token, _ = S.mint_access_token(user_id="u", email="a@b.com", org_id="o")
    with pytest.raises(AuthenticationError):
        S.verify_access_token(token)


def test_non_access_token_type_rejected() -> None:
    # A validly-signed token that isn't typ=access must be refused.
    forged = jwt.encode(
        {"sub": "u", "typ": "refresh", "iss": "hailscout", "iat": 1, "exp": 9999999999},
        _SECRET,
        algorithm="HS256",
    )
    with pytest.raises(AuthenticationError):
        S.verify_access_token(forged)


def test_missing_secret_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SESSION_JWT_SECRET", "")
    with pytest.raises(AuthenticationError):
        S.mint_access_token(user_id="u", email="a@b.com", org_id="o")


def test_refresh_token_hashing() -> None:
    raw = S.generate_refresh_token()
    assert len(raw) >= 40
    assert S.generate_refresh_token() != raw  # high entropy / unique
    h = S.hash_refresh_token(raw)
    assert len(h) == 64  # sha256 hex
    assert h == S.hash_refresh_token(raw)  # stable


def test_oidc_unsupported_provider() -> None:
    with pytest.raises(AuthenticationError):
        asyncio.run(verify_oidc_id_token("facebook", "x.y.z"))
