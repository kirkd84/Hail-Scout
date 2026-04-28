# Multi-stage build for HailScout API
# Stage 1: Builder
FROM python:3.12-slim as builder

WORKDIR /build

# Install Poetry
RUN pip install --no-cache-dir poetry==1.7.1 && \
    poetry config virtualenvs.in-project true

# Copy Poetry files
COPY pyproject.toml poetry.lock* ./

# Install dependencies (--no-root: skip the project itself; source isn't copied yet)
RUN poetry install --no-interaction --no-ansi --only main --no-root

# Stage 2: Runtime
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies for PostGIS/GDAL
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Copy virtual environment from builder
COPY --from=builder /build/.venv /app/.venv

# Copy application code
COPY src/ /app/src/
COPY alembic.ini /app/
COPY migrations/ /app/migrations/

# Add /app/src to PYTHONPATH so uvicorn can find the hailscout_api package
ENV PYTHONPATH="/app/src:$PYTHONPATH"

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Set environment
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8000/health', timeout=5)"

# Run app — shell form so $PORT (set by Railway) is honored at runtime
CMD uvicorn hailscout_api.main:app --host 0.0.0.0 --port ${PORT:-8000}
