"""API route modules."""

from __future__ import annotations

from hailscout_api.routes import ai, contacts, health, hail, markers, me, monitored, reports, storms, tiles

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
]
