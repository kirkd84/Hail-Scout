# Railway worker image for HailScout MRMS pipeline.
# Includes GDAL, PROJ, and ecCodes (needed by rasterio + cfgrib).

FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    DEBIAN_FRONTEND=noninteractive

# System dependencies for cfgrib (ecCodes) + rasterio (GDAL/PROJ)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgdal-dev gdal-bin \
    libeccodes0 libeccodes-tools \
    libproj-dev proj-data proj-bin \
    libgeos-dev \
    build-essential \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install requirements first (better layer caching)
COPY requirements.txt /app/requirements.txt
RUN pip install -r requirements.txt

# Copy source
COPY src /app/src
ENV PYTHONPATH=/app/src

# Default command: live loop every 5 minutes.
# Override with `python -m hailscout_pipeline backfill --since ... --until ...`
CMD ["python", "-m", "hailscout_pipeline", "loop", "--interval-seconds", "300"]
