# HailScout Data Pipeline

Production-ready Python service for continuous ingestion of NOAA MRMS MESH hail data into PostGIS.

## Overview

This repository scaffolds a real-time data pipeline that:

- **Fetches** latest NOAA MRMS MESH hail-size gridded data (every 2 minutes) from `s3://noaa-mrms-pds/`
- **Parses** GRIB2 format using `cfgrib` + `xarray`
- **Stores** processed GeoTIFFs to `s3://hailscout-raw/mesh/{year}/{month}/{day}/{timestamp}.tif`
- **Extracts** hail-swath polygons by 8 size categories (0.75" through 3.0"+) using `rasterio` + `shapely`
- **Upserts** idempotently into PostGIS `hail_swaths` and `storms` tables via SQLAlchemy
- **Runs** as AWS Lambda on 2-minute EventBridge cron
- **Alarms** CloudWatch if no successful ingest in 10 minutes

**Acceptance Criteria:** `SELECT COUNT(*) FROM hail_swaths WHERE updated_at > NOW() - INTERVAL '5 minutes'` returns non-zero during active US storms.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  EventBridge: 2-minute cron                                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │ AWS Lambda  │
                    │ Handler     │
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
    ┌────────────┐  ┌────────────┐  ┌─────────────┐
    │ S3 (NOAA   │  │ cfgrib     │  │ rasterio    │
    │ MRMS)      │  │ xarray     │  │ shapely     │
    │ MESH_Max   │  │ conversion │  │ polygonize  │
    └────────────┘  └────────────┘  └─────────────┘
                           │                  │
                           └──────────────────┘
                                  │
                    ┌─────────────▼────────────┐
                    │ S3 (hailscout-raw)       │
                    │ GeoTIFF storage          │
                    └─────────────┬────────────┘
                                  │
                    ┌─────────────▼────────────┐
                    │ PostgreSQL + PostGIS     │
                    │ storms, hail_swaths      │
                    └──────────────────────────┘
```

## Local Development Setup

### Prerequisites

- Python 3.12+
- Poetry 1.7+
- PostgreSQL 16 + PostGIS 3.4 (local or Docker)
- AWS credentials (local `~/.aws/credentials` or IAM role on Lambda)
- Git

### Installation

```bash
# Clone repo
git clone https://github.com/hailscout/hailscout-data-pipeline.git
cd hailscout-data-pipeline

# Create virtualenv and install dependencies
poetry install

# Copy environment template and fill in values
cp .env.example .env
# Edit .env with your DB_* and AWS_* credentials
```

### Running Locally

```bash
# Run the ingestion once (fetches latest MESH, extracts, upserts)
poetry run python -m hailscout_pipeline.lambda_handler

# Run tests
poetry run pytest -v

# Lint and format
poetry run ruff check --fix src/ tests/
poetry run ruff format src/ tests/

# Type-check
poetry run mypy src/
```

### Docker Compose (local Postgres + PostGIS)

```bash
docker-compose up -d postgres

# Wait ~5s for startup, then run migrations:
poetry run alembic upgrade head

# Or manually:
psql -h localhost -U hailscout -d hailscout_dev < infra/init.sql
```

## Deployment

### AWS SAM Deploy

```bash
# Build Lambda layer + function
sam build

# Deploy (first time or updates)
sam deploy --guided

# If deploying again without --guided, set in samconfig.toml then:
sam deploy

# View logs
sam logs -n MRMSIngestionFunction --stack-name hailscout-data-pipeline --tail
```

### GitHub Actions CI/CD

On every PR to `main`:
- `ruff check` for linting
- `pytest` for unit tests
- `mypy` for type checking

On merge to `main`:
- Run full test suite
- Build and push Lambda image to ECR
- Deploy via SAM to AWS

## Environment Variables

See `.env.example`. Required:

```
DB_USER=hailscout
DB_PASSWORD=<secure>
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hailscout_dev

AWS_REGION=us-east-1
AWS_ACCOUNT_ID=<your-account>
NOAA_MRMS_BUCKET=noaa-mrms-pds
HAILSCOUT_RAW_BUCKET=hailscout-raw

LOG_LEVEL=INFO
```

## Database Schema (PostGIS)

See `src/hailscout_pipeline/db/models.py` for SQLAlchemy definitions. Key tables:

### `storms`
```
id: UUID PRIMARY KEY
start_time: TIMESTAMP
end_time: TIMESTAMP (nullable)
max_hail_size_in: FLOAT
centroid_geom: GEOMETRY(Point, 4326)
bbox_geom: GEOMETRY(Polygon, 4326)
source: VARCHAR (e.g., 'MRMS')
created_at, updated_at: TIMESTAMP
```

### `hail_swaths`
```
id: UUID PRIMARY KEY
storm_id: UUID FOREIGN KEY -> storms.id
hail_size_category: VARCHAR (0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0+)
geom_multipolygon: GEOMETRY(MultiPolygon, 4326)
updated_at: TIMESTAMP
```

## Data Model & Hail Size Categories

Hail size bins (inches) follow industry standards used by IHM/HailTrace:

| Category | Range | Color (on tiles) |
|----------|-------|-----------------|
| 0.75     | ≥ 0.75, < 1.0  | Green |
| 1.0      | ≥ 1.0, < 1.25  | Yellow |
| 1.25     | ≥ 1.25, < 1.5  | Light Orange |
| 1.5      | ≥ 1.5, < 1.75  | Orange |
| 1.75     | ≥ 1.75, < 2.0  | Dark Orange |
| 2.0      | ≥ 2.0, < 2.5   | Red |
| 2.5      | ≥ 2.5, < 3.0   | Purple |
| 3.0+     | ≥ 3.0          | Black |

## Storm Grouping Heuristic (MVP)

When ingesting new swaths, the pipeline groups them into a single `storms` row by:

1. **Spatial proximity:** Swaths with bounding boxes within ~50 km of each other
2. **Temporal proximity:** Same calendar day (UTC)
3. **Contiguity check:** New swaths touch or overlap existing storm bbox

**TODO:** This heuristic is a MVP stub. Future refinements will use:
- ML clustering on swath centroids
- Storm tracking from NWS Storm Reports (SPC)
- Temporal decay (storms "close" 4+ hours after last swath)

See `src/hailscout_pipeline/db/upsert.py` for implementation notes.

## Module Structure

- **`config.py`** — Pydantic Settings for env vars, secrets
- **`lambda_handler.py`** — Lambda entry point; orchestrates one 2-minute run
- **`ingestion/`**
  - `mrms_client.py` — S3 listing, downloads latest MESH GRIB2
  - `grib_to_geotiff.py` — cfgrib → xarray → rasterio GeoTIFF + S3 upload
- **`extraction/`**
  - `thresholds.py` — Hail size category definitions
  - `polygonize.py` — rasterio.features.rasterize → shapely polygons
- **`db/`**
  - `models.py` — SQLAlchemy ORM + PostGIS types (geoalchemy2)
  - `session.py` — Engine factory, SessionLocal
  - `upsert.py` — Idempotent upsert logic (storm grouping)
- **`storage/`**
  - `s3.py` — S3 wrapper for GeoTIFF upload

## Testing

```bash
poetry run pytest tests/ -v

# Specific test:
poetry run pytest tests/test_thresholds.py::test_hail_size_binning -v

# With coverage:
poetry run pytest --cov=src/ tests/
```

**Note:** Real MRMS fixture data is not committed (binary GRIB2 files are large). See `tests/fixtures/README.md` for how to add them locally.

## Logging & Monitoring

Uses `structlog` for structured logging (JSON output to CloudWatch). Example:

```python
log.info("mesh_fetch", bucket="noaa-mrms-pds", key="path/to/file.grib2", size_mb=45)
```

**CloudWatch Alarm:** Paging if no successful `lambda_invoke` in 10 minutes.
- Metric: `MRMSIngestionFunction` duration > 0 (indicates success)
- Threshold: No invocation in 300 seconds
- Action: SNS → PagerDuty

See `infra/cloudwatch-alarm.yaml` for SAM template.

## AWS IAM & Permissions

Two policies provided:

1. **`infra/iam-policy-mrms-read.json`** — Read-only access to `noaa-mrms-pds` NOAA bucket (ListBucket, GetObject on `MESH_Max_*`)
2. **`infra/iam-policy-hailscout-raw.json`** — Read/write to `hailscout-raw` bucket for GeoTIFF storage

Lambda execution role must assume both. See SAM `template.yaml` for role definition.

## Deferral & Future Work (Not MVP)

- **Historical backfill:** MYRORSS archive (Jan 2011 – present) — deferred to Month 2
- **NEXRAD Level II tiles:** Frame-by-frame replay — deferred to Month 4
- **CNN refinement:** ML-based swath edge detection — deferred to Year 2
- **Multi-source conflict resolution:** How to handle IHM vs. MRMS disagreement — TBD Month 3

## Decisions & Trade-offs

1. **cfgrib for GRIB2 parsing:** Industry standard, proven with NOAA data, good xarray interop. Alternative: `eccodes` (lower-level, more control but complexity).

2. **Shapely for polygon extraction:** Pure Python, no GEOS/GDAL compile issues on Lambda. rasterio + shapely pairs well. Considered: GDAL CLI (slower, more disk I/O).

3. **SQLAlchemy ORM + geoalchemy2:** Type-safe, migratable schemas, good PostGIS support. Considered: psycopg + raw SQL (faster but error-prone).

4. **EventBridge cron (2 min) over SQS poll:** Simpler, no queue management, built-in retry + DLQ via SAM. MRMS updates every 2 min anyway, so cron is natural.

5. **UUID primary keys:** Industry standard for distributed systems, no contention on sequences, good for partitioning later.

6. **Idempotent upsert by (storm_id, hail_size_category):** Handles Lambda retries gracefully. If the same swath is re-ingested, it updates `updated_at` but doesn't duplicate rows.

## Contact & Feedback

- **Issues:** GitHub Issues in this repo
- **Slack:** `#data-pipeline` in HailScout Slack (Month 2+)
- **PRD reference:** `HailScout_Build_Doc_2.md` (source of truth)

---

**Owner:** Data Pipeline Agent (Cowork)  
**Last updated:** 2026-04-24  
**Status:** Scaffold complete; awaiting live MRMS fixtures + AWS infra setup for full integration test
