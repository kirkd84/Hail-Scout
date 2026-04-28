"""FastAPI application factory."""

from __future__ import annotations

import logging

from fastapi import APIRouter, FastAPI
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
    log.info("hailscout.boot.create_app", extra={"env": settings.env})

    # Initialize DB engine. Don't crash the whole API if it fails — `/healthz`
    # at the root will keep responding 200 so Railway's edge can register the
    # service while we debug.
    try:
        init_db(settings)
        log.info("hailscout.boot.db_initialized")
    except Exception as exc:  # pragma: no cover
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

    # Root-level liveness probe. Doesn't touch the DB. Always returns 200 if
    # the Python process is alive — used as the Railway and Dockerfile health
    # check so the proxy can register the service even before migrations run.
    @app.get("/healthz", include_in_schema=False)
    async def healthz() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/", include_in_schema=False)
    async 