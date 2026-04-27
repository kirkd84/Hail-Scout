"""Health check endpoint."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.core import get_logger
from hailscout_api.db.session import get_db_session

logger = get_logger(__name__)
router = APIRouter()


@router.get("/health")
async def health_check(session: AsyncSession = Depends(get_db_session)) -> dict[str, str]:
    """Health check with database connectivity status."""
    try:
        # Test database connection
        await session.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception as e:
        logger.error("Database health check failed", error=str(e))
        db_status = "error"

    return {
        "status": "ok" if db_status == "ok" else "degraded",
        "db": db_status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
