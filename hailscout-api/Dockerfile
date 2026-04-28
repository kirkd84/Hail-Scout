# HailScout API — Dockerfile
# Plain pip-based build. Single stage. Predictable, no venv-copy quirks.
# Cache-bust marker: 2026-04-28-v3-diagnostic

FROM python:3.12-slim

WORKDIR /app

# System packages: libpq for psycopg2, build tools for asyncpg/cryptography wheels
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 \
        libpq-dev \
        build-essential \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Python runtime tweaks. -u (PYTHONUNBUFFERED) is critical for Railway log
# streaming: without it, uvicorn / print output sits in stdio buffers and
# disappears when the process dies.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install dependencies. Pinned ranges match pyproject.toml — keep in sync.
RUN pip install \
        'fastapi>=0.104,<0.106' \
        'uvicorn[standard]>=0.24,<0.30' \
        'sqlalchemy>=2.0,<2.1' \
        'asyncpg>=0.29,<0.31' \
        'psycopg2-binary>=2.9,<3.0' \
        'alembic>=1.13,<2.0' \
        'pydantic[email]>=2.5,<3.0' \
        'pydantic-settings>=2.1,<3.0' \
        'geoalchemy2>=0.14,<0.16' \
        'shapely>=2.0,<3.0' \
        'requests>=2.31,<3.0' \
        'httpx>=0.25,<0.28' \
        'python-jose[cryptography]>=3.3,<4.0' \
        'cryptography>=41,<44' \
        'structlog>=24,<25' \
        'python-json-logger>=2.0,<3.0' \
        'PyJWT>=2.8,<3.0' \
        'sentry-sdk>=1.40,<3.0' \
        'tenacity>=8.2,<9.0'

# Application code
COPY src/ /app/src/
COPY alembic.ini /app/
COPY migrations/ /app/migrations/

# Make src/ importable so `hailscout_api.main:app` resolves
ENV PYTHONPATH=/app/src

# Run as non-root
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Diagnostic boot wrapper. Every line is echoed so Railway logs surface
# exactly where things crash. ``set -x`` traces commands, ``2>&1`` merges
# stderr into stdout so nothing gets dropped on container death.
HEALTHCHECK NONE
CMD set -x \
 && echo "[boot] >>> hailscout-api starting at $(date -u +%Y-%m-%dT%H:%M:%SZ)" \
 && echo "[boot] PORT=${PORT:-<unset>} (will use ${PORT:-8000})" \
 && echo "[boot] PYTHONPATH=$PYTHONPATH" \
 && echo "[boot] python -V:" && python -V \
 && echo "[boot] pwd: $(pwd) ; ls /app/src/hailscout_api:" && ls /app/src/hailscout_api \
 && echo "[boot] step 0/4: import smoke test" \
 && python -u -c "import hailscout_api.main as m; print('[boot] import ok -- app type=' + type(m.app).__name__)" \
 && echo "[boot] step 1/4: alembic upgrade head" \
 && (alembic upgrade head 2>&1 || echo "[boot] alembic FAILED but continuing") \
 && echo "[boot] step 2/4: seed orgs+users" \
 && (python -u -m hailscout_api.seed 2>&1 || echo "[boot] seed FAILED but continuing") \
 && echo "[boot] step 3/4: launching uvicorn on 0.0.0.0:${PORT:-8000}" \
 && exec python -u -m uvicorn hailscout_api.main:app --host 0.0.0.0 --port ${PORT:-8000} --log-level info --access-log
