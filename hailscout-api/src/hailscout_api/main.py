"""FastAPI application factory."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from hailscout_api.config import get_settings
from hailscout_api.core import setup_logging
from hailscout_api.db import init_db
from hailscout_api.routes import (
    admin,
    ai,
    contacts,
    health,
    hail,
    markers,
    me,
    monitored,
    reports,
    storms,
    tiles,
)


def create_app() -> FastAPI:
    """Create and configure FastAPI application."""
    settings = get_settings()

    # Setup logging
    setup_logging(settings.log_level)

    # Initialize database
    init_db(settings)

    # Create app
    app = FastAPI(
        title="HailScout API",
        description="Storm intelligence platform for roofing contractors",
        version="0.1.0",
        docs_url="/docs",
        openapi_url="/openapi.json",
    )

    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include routers under /v1 prefix
    api_router = FastAPI()
    api_router.include_router(health.router, tags=["health"])
    api_router.include_router(me.router, tags=["user"])
    api_router.include_router(storms.router, tags=["storms"])
    api_router.include_router(hail.router, tags=["hail"])
    api_router.include_router(tiles.router, tags=["tiles"])
    api_router.include_router(reports.router, tags=["reports"])
    api_router.include_router(markers.router, tags=["markers"])
    api_router.include_router(monitored.router, tags=["monitoring"])
    api_router.include_router(contacts.router, tags=["contacts"])
    api_router.include_router(ai.router, tags=["ai"])
    # Super-admin (cross-tenant) routes — guarded by require_super_admin
    api_router.include_router(admin.router, tags=["super-admin"])

    # Mount v1 API under /v1
    app.mount("/v1", api_router)

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
