"""Contact enrichment via a pluggable third-party provider (e.g. Cole X-Dates).

OFF by default. With no provider configured, :func:`enrich_parcel` raises
:class:`EnrichmentNotConfigured`, which the route surfaces as a clean 503 — the
same gating pattern as Photo-AI (Anthropic) and SMS/push (Twilio/VAPID).

We deliberately never *fabricate* homeowner phone/email: that is a
TCPA/DNC-regulated surface where an un-sourced guess is worse than an honest
"not available". Adding a real provider is a single function — implement its
branch in :func:`_dispatch` and set ``ENRICHMENT_PROVIDER`` + ``ENRICHMENT_API_KEY``.
"""

from __future__ import annotations

from typing import Any

from hailscout_api.config import get_settings
from hailscout_api.core import get_logger

logger = get_logger(__name__)


class EnrichmentNotConfigured(Exception):
    """No enrichment provider/key configured."""


class EnrichmentError(Exception):
    """The provider call failed or returned something unusable."""


def enrichment_configured() -> bool:
    s = get_settings()
    return bool(s.enrichment_provider.strip() and s.enrichment_api_key.strip())


def configured_provider() -> str | None:
    return get_settings().enrichment_provider.strip().lower() or None


async def enrich_parcel(parcel_id: str) -> dict[str, Any]:
    """Return ``{phone, email, owner_name}`` for a parcel, or raise.

    Raises :class:`EnrichmentNotConfigured` if no provider is set, or
    :class:`EnrichmentError` if the configured provider's call fails.
    """
    if not enrichment_configured():
        raise EnrichmentNotConfigured("No contact-enrichment provider configured")
    settings = get_settings()
    return await _dispatch(
        settings.enrichment_provider.strip().lower(),
        settings.enrichment_api_key.strip(),
        parcel_id,
    )


async def _dispatch(provider: str, api_key: str, parcel_id: str) -> dict[str, Any]:
    if provider == "cole":
        return await _enrich_cole(api_key, parcel_id)
    # Unknown provider name set in config — treat as misconfiguration, not a 502.
    logger.warning("enrichment.unknown_provider", provider=provider)
    raise EnrichmentNotConfigured(f"Unknown enrichment provider: {provider!r}")


async def _enrich_cole(api_key: str, parcel_id: str) -> dict[str, Any]:
    """Cole X-Dates reverse-address adapter.

    Stub adapter: wiring this is a matter of calling Cole's reverse-address API
    with ``api_key`` and the parcel's situs address, then mapping their response
    onto ``{phone, email, owner_name}``. We have no Cole account yet, so this
    raises rather than returning placeholder data.
    """
    raise EnrichmentError("Cole provider adapter is not yet implemented")
