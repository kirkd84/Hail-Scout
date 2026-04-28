# HailScout API — Dockerfile
# Plain pip-based build. Single stage. Predictable, no venv-copy quirks.

FROM python:3.12-slim

WORKDIR /app

# System packages: libpq for psycopg2, build tools for asyncpg/cryptography wheels
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 \
        libpq-dev \
        build-essential \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Python runtime tweaks
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