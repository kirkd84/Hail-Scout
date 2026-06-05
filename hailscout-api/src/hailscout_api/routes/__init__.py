"""API route modules."""

from __future__ import annotations

from hailscout_api.routes import (
    audit,
    auth,
    contacts_crm,
    public,
    territories,
    integrations,
    team,
    admin,
    ai,
    contacts,
    hail,
    health,
    markers,
    me,
    monitored,
    parcels,
    reports,
    storms,
    tiles,
)

__all__ = [
    "health",
    "auth",
    "me",
    "storms",
    "hail",
    "tiles",
    "reports",
    "markers",
    "monitored",
    "parcels",
    "contacts",
    "ai",
    "admin",
    "audit",
    "contacts_crm",
    "public",
    "territories",
    "integrations",
    "team",
]
