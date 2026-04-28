"""FastAPI application factory."""

from __future__ import annotations

import logging

from fastapi import APIRouter, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from hailscout_api.config import get_settings
from hailscout_api.core import setup_logging
from hailscout_api.db import init_db
from hailscout_api.routes import (
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

log = logging.getLogger(__name__)


def create_app() -> FastAPI:
    """Create and configure FastAPI application."""
    settings = get_settings()

    setup_logging(settings.log_level)
    log.info("hailscout.boot.create_app env=%s", settings.env)

    # Initialize DB engine. Don't crash the whole API if it fails — /healthz
    # at the root will keep responding 200 so Railway's edge can register the
    # service while we debug.
    try:
        init_db(settings)
        log.info("hailscout.boot.db_initialized")
    except Exception as exc:
        log.exception("hailscout.boot.db_init_failed: %s", exc)

    app = FastAPI(
        title="HailScout API",
        description="Storm intelligence platform for roofing contractors",
        version="0.1.0",
        docs_url="/docs",
        openapi_url="/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/healthz", include_in_schema=False)
    async def healthz() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/", include_in_schema=False)
    async def root() -> dict[str, str]:
        return {"name": "HailScout API", "version": "0.1.0", "docs": "/docs"}

    v1 = APIRouter(prefix="/v1")
    v1.include_router(health.router, tags=["health"])
    v1.include_router(me.router, tags=["user"])
    v1.include_router(storms.router, tags=["storms"])
    v1.include_router(hail.router, tags=["hail"])
    v1.include_router(tiles.router, tags=["tiles"])
    v1.include_router(reports.router, tags=["reports"])
    v1.include_router(markers.router, tags=["markers"])
    v1.include_router(monitored.router, tags=["monitoring"])
    v1.include_router(contacts.router, tags=["contacts"])
    v1.include_router(ai.router, tags=["ai"])
    v1.include_router(admin.router, tags=["super-admin"])

    app.include_router(v1)

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        log.exception("hailscout.unhandled_exception")
        return JSONResponse(
            status_code=500,
            content={"error": "internal_server_error", "detail": str(exc)},
        )

    log.info("hailscout.boot.app_ready")
    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
