"""FastAPI application factory."""

from __future__ import annotations

import logging
import os

from fastapi import APIRouter, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from hailscout_api.config import get_settings
from hailscout_api.core import setup_logging
from hailscout_api.db import init_db
from hailscout_api.routes import (
    audit,
    auth,
    contacts_crm,
    mfa,
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
    provision,
    reports,
    storms,
    tiles,
    tokens,
)

log = logging.getLogger(__name__)


def create_app() -> FastAPI:
    """Create and configure FastAPI application."""
    settings = get_settings()

    setup_logging(settings.log_level)
    log.info("hailscout.boot.create_app env=%s", settings.env)

    # Auth requires a signing secret. Warn loudly in production rather than
    # crash the boot (so /healthz still answers), but every auth call will
    # 401 until SESSION_JWT_SECRET is set.
    if settings.env == "production" and not settings.session_jwt_secret:
        log.error(
            "hailscout.boot.missing_session_jwt_secret — set SESSION_JWT_SECRET "
            "or all authentication will fail"
        )

    # Production error monitoring. Gated on SENTRY_DSN so local/dev runs
    # without a DSN are unaffected. Captures unhandled exceptions across
    # the API AND the in-process worker. traces_sample_rate is low to
    # keep performance overhead negligible.
    if settings.sentry_dsn:
        try:
            import sentry_sdk

            sentry_sdk.init(
                dsn=settings.sentry_dsn,
                environment=settings.sentry_environment,
                traces_sample_rate=0.1,
                # Don't ship PII (addresses, emails) to Sentry by default.
                send_default_pii=False,
            )
            log.info("hailscout.boot.sentry_initialized env=%s",
                     settings.sentry_environment)
        except Exception as exc:  # pragma: no cover
            log.warning("hailscout.boot.sentry_init_failed: %s", exc)

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
    v1.include_router(auth.router, tags=["auth"])
    v1.include_router(mfa.router, tags=["mfa"])
    v1.include_router(me.router, tags=["user"])
    v1.include_router(tokens.router, tags=["tokens"])
    v1.include_router(storms.router, tags=["storms"])
    v1.include_router(hail.router, tags=["hail"])
    v1.include_router(tiles.router, tags=["tiles"])
    v1.include_router(reports.router, tags=["reports"])
    v1.include_router(markers.router, tags=["markers"])
    v1.include_router(monitored.router, tags=["monitoring"])
    v1.include_router(parcels.router, tags=["parcels"])
    v1.include_router(contacts.router, tags=["contacts"])
    v1.include_router(ai.router, tags=["ai"])
    v1.include_router(admin.router, tags=["super-admin"])
    v1.include_router(audit.router, tags=["super-admin"])
    v1.include_router(team.router, tags=["team"])
    v1.include_router(integrations.router, tags=["integrations"])
    v1.include_router(territories.router, tags=["territories"])
    v1.include_router(public.router, tags=["public"])
    v1.include_router(contacts_crm.router, tags=["customers"])

    app.include_router(v1)

    # External HR provisioning API. Mounted at its own ``/api/provision`` prefix
    # (NOT under /v1) and authenticated by a static X-API-Key — separate from the
    # first-party OAuth/JWT surface. The router itself returns 503 when
    # HR_PROVISION_API_KEY is unset, so mounting it unconditionally is safe.
    app.include_router(provision.router)

    # Map domain auth errors to 401/403 instead of falling through to 500.
    from hailscout_api.core import AuthenticationError, AuthorizationError

    @app.exception_handler(AuthenticationError)
    async def _auth_error(_request: Request, exc: AuthenticationError) -> JSONResponse:
        return JSONResponse(status_code=401, content={"error": "unauthorized", "detail": str(exc)})

    @app.exception_handler(AuthorizationError)
    async def _authz_error(_request: Request, exc: AuthorizationError) -> JSONResponse:
        return JSONResponse(status_code=403, content={"error": "forbidden", "detail": str(exc)})

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        log.exception("hailscout.unhandled_exception")
        # Generic detail only — str(exc) on a DB/driver error can leak SQL,
        # column names, or connection details to the caller. The full
        # exception is in the server log above.
        return JSONResponse(
            status_code=500,
            content={"error": "internal_server_error",
                     "detail": "Internal server error."},
        )

    # Optional in-process alert/screen/link/sweep worker. When
    # RUN_ALERT_WORKER_INPROC=1, the API hosts the worker loop itself —
    # screening + LSR-linking + a periodic full-history sweep (which
    # lights up verification tiers + accuracy calibration across the
    # whole backfill) + alert fan-out — so we don't need a separate
    # Railway service. Single-replica deployments only; the work is
    # idempotent so duplicate runs across replicas are wasteful, not
    # incorrect.
    if os.environ.get("RUN_ALERT_WORKER_INPROC", "").strip() == "1":
        @app.on_event("startup")
        async def _start_inproc_worker() -> None:
            import asyncio
            from hailscout_api.workers.alert_worker import run_worker_loop

            log.warning("hailscout.boot.inproc_worker_starting")
            asyncio.create_task(run_worker_loop())

    log.info("hailscout.boot.app_ready")
    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
