FROM python:3.12-slim

# Install system dependencies: GDAL, tippecanoe, mbutil
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    gdal-bin \
    libgdal-dev \
    libsqlite3-dev \
    zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

# Build tippecanoe from source
RUN git clone https://github.com/mapbox/tippecanoe.git /tmp/tippecanoe && \
    cd /tmp/tippecanoe && \
    make && \
    make install && \
    rm -rf /tmp/tippecanoe

# Install mbutil for tile splitting
RUN pip install --no-cache-dir mbutil

# Set working directory
WORKDIR /app

# Copy pyproject.toml and poetry.lock
COPY pyproject.toml poetry.lock* ./

# Install Poetry and Python dependencies
RUN pip install --no-cache-dir poetry && \
    poetry config virtualenvs.create false && \
    poetry install --no-dev --no-interaction --no-ansi

# Copy source code
COPY src/ src/
COPY tests/ tests/

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Default command
CMD ["python", "-m", "hailscout_tiles.cli"]
