"""Unit tests for Sign in with Apple id_token verification (ES256).

Apple is the one provider that (a) signs with ES256 rather than RS256 and
(b) omits ``email`` on every login after the first consent. These tests mint a
local P-256 keypair, publish it as Apple's JWKS (monkeypatched), and drive
:func:`verify_oidc_id_token` end to end so the EC-key path, issuer/audience
checks, and the email-optional behaviour are all exercised without a network.
"""

from __future__ import annotations

import asyncio
import json
import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec

from hailscout_api.auth import oidc
from hailscout_api.auth.oidc import verify_oidc_id_token
from hailscout_api.core import AuthenticationError

_APPLE_ISSUER = "https://appleid.apple.com"
_SERVICES_ID = "com.rooftechnologies.hailscout.web"  # the Apple Services ID (aud)
_KID = "test-apple-kid"


@pytest.fixture(autouse=True)
def _configure_apple(monkeypatch: pytest.MonkeyPatch) -> None:
    """Point the Apple verifier at our Services ID and a local JWKS."""
    monkeypatch.setenv("APPLE_OAUTH_CLIENT_ID", _SERVICES_ID)
    # Settings is lru_cached — clear it so the env above takes effect.
    from hailscout_api.config import get_settings

    get_settings.cache_clear()
    # Reset the module JWKS cache so our fake fills it (not a real fetch).
    oidc._jwks_cache = None


def _keypair() -> ec.EllipticCurvePrivateKey:
    return ec.generate_private_key(ec.SECP256R1())


def _jwks_for(private_key: ec.EllipticCurvePrivateKey) -> dict:
    """Publish the public half of an EC key as a single-entry JWK set."""
    pub_jwk = json.loads(
        jwt.algorithms.ECAlgorithm.to_jwk(private_key.public_key())
    )
    pub_jwk["kid"] = _KID
    pub_jwk["alg"] = "ES256"
    pub_jwk["use"] = "sig"
    return {"keys": [pub_jwk]}


def _mint(private_key: ec.EllipticCurvePrivateKey, claims: dict) -> str:
    now = int(time.time())
    payload = {
        "iss": _APPLE_ISSUER,
        "aud": _SERVICES_ID,
        "iat": now,
        "exp": now + 300,
        **claims,
    }
    return jwt.encode(payload, private_key, algorithm="ES256", headers={"kid": _KID})


def _patch_jwks(monkeypatch: pytest.MonkeyPatch, jwks: dict) -> None:
    """Make the module's JWKS cache return `jwks` instead of fetching Apple."""

    class _FakeCache:
        async def get(self, _url: str) -> dict:
            return jwks

    monkeypatch.setattr(oidc, "_get_jwks_cache", lambda: _FakeCache())


def test_apple_first_consent_carries_verified_email(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    key = _keypair()
    _patch_jwks(monkeypatch, _jwks_for(key))
    token = _mint(
        key,
        {"sub": "001234.abcd", "email": "Rep@Example.com", "email_verified": "true"},
    )
    identity = asyncio.run(verify_oidc_id_token("apple", token))
    assert identity.provider == "apple"
    assert identity.subject == "apple:001234.abcd"
    assert identity.email == "rep@example.com"  # lower-cased


def test_apple_returning_login_omits_email(monkeypatch: pytest.MonkeyPatch) -> None:
    """Later logins carry only sub — email is None so the caller resolves by sub."""
    key = _keypair()
    _patch_jwks(monkeypatch, _jwks_for(key))
    token = _mint(key, {"sub": "001234.abcd"})
    identity = asyncio.run(verify_oidc_id_token("apple", token))
    assert identity.subject == "apple:001234.abcd"
    assert identity.email is None


def test_apple_unverified_email_is_dropped(monkeypatch: pytest.MonkeyPatch) -> None:
    """An unverified email is treated as absent (fall back to sub resolution)."""
    key = _keypair()
    _patch_jwks(monkeypatch, _jwks_for(key))
    token = _mint(
        key,
        {"sub": "001234.abcd", "email": "rep@example.com", "email_verified": "false"},
    )
    identity = asyncio.run(verify_oidc_id_token("apple", token))
    assert identity.email is None


def test_apple_wrong_audience_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    """A token minted for a different relying party (aud) must fail."""
    key = _keypair()
    _patch_jwks(monkeypatch, _jwks_for(key))
    now = int(time.time())
    token = jwt.encode(
        {
            "iss": _APPLE_ISSUER,
            "aud": "com.someone.else",  # not our Services ID
            "sub": "001234.abcd",
            "iat": now,
            "exp": now + 300,
        },
        key,
        algorithm="ES256",
        headers={"kid": _KID},
    )
    with pytest.raises(AuthenticationError):
        asyncio.run(verify_oidc_id_token("apple", token))


def test_apple_wrong_issuer_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    key = _keypair()
    _patch_jwks(monkeypatch, _jwks_for(key))
    now = int(time.time())
    token = jwt.encode(
        {
            "iss": "https://evil.example.com",
            "aud": _SERVICES_ID,
            "sub": "001234.abcd",
            "iat": now,
            "exp": now + 300,
        },
        key,
        algorithm="ES256",
        headers={"kid": _KID},
    )
    with pytest.raises(AuthenticationError):
        asyncio.run(verify_oidc_id_token("apple", token))


def test_apple_bad_signature_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    """A token signed by a DIFFERENT key than the published JWKS must fail."""
    published = _keypair()
    attacker = _keypair()
    _patch_jwks(monkeypatch, _jwks_for(published))  # we publish `published`...
    token = _mint(attacker, {"sub": "001234.abcd"})  # ...but sign with `attacker`
    with pytest.raises(AuthenticationError):
        asyncio.run(verify_oidc_id_token("apple", token))


def test_apple_dark_when_unconfigured(monkeypatch: pytest.MonkeyPatch) -> None:
    """With no Services ID configured, Apple verification refuses (stays dark)."""
    monkeypatch.setenv("APPLE_OAUTH_CLIENT_ID", "")
    from hailscout_api.config import get_settings

    get_settings.cache_clear()
    with pytest.raises(AuthenticationError):
        asyncio.run(verify_oidc_id_token("apple", "a.b.c"))
