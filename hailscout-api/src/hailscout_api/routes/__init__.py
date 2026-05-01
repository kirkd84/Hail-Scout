"""API route modules."""

from __future__ import annotations

from hailscout_api.routes import (
    audit,
    integrations,
    team,
    webhooks,
    admin,
    ai,
    contacts,
    hail,
    health,
    markers,
    me,
    monitored,
    reports,
    storms,
    tiles,
)

__all__ = [
    "health",
    "me",
    "storms",
    "hail",
    "tiles",
    "reports",
    "markers",
    "monitored",
    "contacts",
    "ai",
    "admin",
    "audit",
    "integrations",
    "team",
    "webhooks",
]
