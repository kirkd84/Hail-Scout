"""Core utilities and configuration."""

from __future__ import annotations

from hailscout_api.core.errors import (
    AuthenticationError,
    AuthorizationError,
    DatabaseError,
    GeocoderError,
    HailScoutError,
    NotFoundError,
    ValidationError,
    http_exception_from_error,
)
from hailscout_api.core.logging import get_logger, setup_logging

__all__ = [
    "setup_logging",
    "get_logger",
    "HailScoutError",
    "AuthenticationError",
    "AuthorizationError",
    "NotFoundError",
    "ValidationError",
    "GeocoderError",
    "DatabaseError",
    "http_exception_from_error",
]
