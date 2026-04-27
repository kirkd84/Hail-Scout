"""Custom exceptions and error handling."""

from __future__ import annotations

from fastapi import HTTPException, status


class HailScoutError(Exception):
    """Base exception for HailScout API."""

    pass


class AuthenticationError(HailScoutError):
    """User is not authenticated."""

    pass


class AuthorizationError(HailScoutError):
    """User lacks permission for this action."""

    pass


class NotFoundError(HailScoutError):
    """Resource not found."""

    pass


class ValidationError(HailScoutError):
    """Input validation failed."""

    pass


class GeocoderError(HailScoutError):
    """Geocoding service failed."""

    pass


class DatabaseError(HailScoutError):
    """Database operation failed."""

    pass


def http_exception_from_error(error: HailScoutError) -> HTTPException:
    """Convert HailScout error to HTTP exception."""
    error_map = {
        AuthenticationError: (status.HTTP_401_UNAUTHORIZED, "Authentication failed"),
        AuthorizationError: (status.HTTP_403_FORBIDDEN, "Access denied"),
        NotFoundError: (status.HTTP_404_NOT_FOUND, "Resource not found"),
        ValidationError: (status.HTTP_422_UNPROCESSABLE_ENTITY, "Validation error"),
        GeocoderError: (status.HTTP_502_BAD_GATEWAY, "Geocoding service error"),
        DatabaseError: (status.HTTP_503_SERVICE_UNAVAILABLE, "Database error"),
    }

    status_code, detail = error_map.get(type(error), (status.HTTP_500_INTERNAL_SERVER_ERROR, str(error)))
    return HTTPException(status_code=status_code, detail=detail)
