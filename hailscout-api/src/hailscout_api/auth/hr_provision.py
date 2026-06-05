"""HR provisioning API-key guard.

A FastAPI dependency for the external ``/api/provision/*`` endpoints. Unlike the
rest of the API (first-party OAuth -> our own HS256 bearer), this surface is
called machine-to-machine by an outside HR system, so it authenticates with a
static shared secret in the ``X-API-Key`` header.

Behaviour:

* ``HR_PROVISION_API_KEY`` unset/empty  -> 503 (feature not configured).
* header missing or wrong               -> 401.
* header matches                        -> returns the target org id.

The key maps to exactly ONE tenant: ``HR_PROVISION_ORG_ID``. Routes resolve the
org via :func:`provision_org_id` rather than trusting any caller-supplied value
beyond an equality check, so a single key can never reach across tenants.
"""

from __future__ import annotations

import hmac

from fastapi import Header, HTTPException, status

from hailscout_api.config import get_settings


def _configured() -> tuple[str, str]:
    """Return ``(api_key, org_id)`` or raise 503 if the key is not configured."""
    settings = get_settings()
    api_key = (settings.hr_provision_api_key or "").strip()
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="provisioning not configured",
        )
    return api_key, (settings.hr_provision_org_id or "").strip()


async def require_provision_key(
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
) -> str:
    """Authenticate an HR-provisioning request and return the target org id.

    503 if the feature is unconfigured, 401 if the ``X-API-Key`` header is
    missing or does not match. On success returns the configured target org id
    (``HR_PROVISION_ORG_ID``) for the route to provision into.
    """
    api_key, org_id = _configured()

    # Constant-time compare so we don't leak key length/prefix via timing.
    if not x_api_key or not hmac.compare_digest(x_api_key, api_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key.",
        )

    if not org_id:
        # Key is set but no target org -> misconfiguration, not a client error.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="provisioning not configured",
        )
    return org_id
