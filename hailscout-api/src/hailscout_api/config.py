"""Pydantic settings for HailScout API.

Pydantic v2 / pydantic-settings v2 syntax: env-var name comes from the field
name (case-insensitive) by default, NOT from a deprecated `env="..."` kwarg
on Field. Configure via ``model_config`` instead.
"""

from __future__ import annotations

from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables.

    Field name maps to the env var of the same name (uppercased).
    e.g. ``database_url`` reads ``DATABASE_URL``.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="ignore",
    )

    # Core
    env: Literal["development", "staging", "production"] = "development"
    debug: bool = False
    port: int = 8000
    log_level: str = "INFO"

    # Database
    database_url: str = (
        "postgresql+asyncpg://hailscout:hailscout@localhost:5432/hailscout"
    )
    database_pool_size: int = 20
    database_pool_recycle: int = 3600

    # ------------------------------------------------------------------
    # Authentication — HailScout is its own identity authority.
    #
    # The browser runs the Google/Microsoft OAuth code-exchange in the web
    # tier (Arctic) and hands us the provider-signed OIDC id_token. We verify
    # that token, resolve the user by email, and mint our OWN session tokens.
    # ------------------------------------------------------------------

    # HS256 signing secret for our access tokens. MUST be set in production
    # (a startup check rejects the default empty value when env=production).
    session_jwt_secret: str = ""
    session_jwt_issuer: str = "hailscout"
    # Short-lived bearer the browser attaches to API calls.
    session_access_ttl_seconds: int = 3600  # 1 hour
    # Long-lived, server-stored, revocable refresh/session lifetime.
    session_refresh_ttl_days: int = 30

    # ------------------------------------------------------------------
    # External HR provisioning API (X-API-Key). Lets an outside HR system
    # create / disable rep accounts via /api/provision/*. When
    # ``hr_provision_api_key`` is empty the whole router answers 503 (feature
    # off). The key maps to exactly ONE org: ``hr_provision_org_id``. Callers
    # MAY also pass ``org_id`` in the request body, but it must equal the
    # configured org — we never let one key provision into a different tenant.
    # ------------------------------------------------------------------
    hr_provision_api_key: str = ""
    hr_provision_org_id: str = ""

    # OAuth provider PUBLIC client IDs only. The client *secrets* live in the
    # web tier (Arctic does the token exchange) — never here. We only need the
    # client IDs to validate the `aud` claim of the provider id_token.
    google_oauth_client_id: str = ""
    # Extra accepted Google audiences — the mobile app's iOS/Android native
    # client IDs differ from the web client ID, and a token's `aud` is its own
    # client. List them here so mobile sign-in passes audience validation.
    google_oauth_audiences: list[str] = []
    microsoft_oauth_client_id: str = ""
    # Microsoft tenant: "common" (work + personal), "organizations",
    # "consumers", or a specific tenant GUID. Controls the accepted issuer.
    microsoft_oauth_tenant: str = "common"
    # JWKS cache TTL (seconds) for provider signing keys. They rotate rarely,
    # so one fetch is reused across requests for this long.
    oidc_jwks_cache_ttl_seconds: int = 3600

    # Parcel-Service — shared county-parcel microservice. Powers draw-area lead
    # lists + business-type prospecting. When unset, those endpoints return 503.
    # Mint a "hailscout" consumer token on the Parcel-Service and set both.
    parcel_service_url: str = ""
    parcel_service_token: str = ""
    parcel_service_timeout_s: float = 20.0

    # ── Real-time alert channels (beyond email/Slack) ──
    # SMS via Twilio REST API (HTTP Basic auth: account SID : auth token).
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_from_number: str = ""  # E.164, e.g. "+15551234567"
    # Web push (VAPID). Generate a keypair once; private key stays secret.
    vapid_public_key: str = ""
    vapid_private_key: str = ""
    vapid_subject: str = "mailto:alerts@hailscout.net"

    # Geocoding
    geocoder_provider: Literal["nominatim", "mapbox"] = "nominatim"
    nominatim_user_agent: str = "HailScout/0.1.0 (+https://hailscout.com)"
    mapbox_api_key: str = ""

    # Monitoring
    sentry_dsn: str | None = None
    sentry_environment: str = "development"

    # AWS / object storage (used by future S3/R2 integrations)
    aws_region: str = "us-east-1"
    aws_access_key_id: str | None = None
    aws_secret_access_key: str | None = None

    # CORS — list of allowed origins. Accepts CSV in the env var, e.g.
    # CORS_ORIGINS="http://localhost:3000,https://app.hailscout.com"
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        # Production custom domain (Vercel).
        "https://hailscout.net",
        "https://www.hailscout.net",
        # Legacy Vercel domain (still resolves; kept for previews/links).
        "https://hail-scout.vercel.app",
    ]


def get_settings() -> Settings:
    """Get application settings."""
    return Settings()
