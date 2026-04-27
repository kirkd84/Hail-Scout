# HailScout Tiles — Vector Tile Service

Transforms hail-swath polygons from PostGIS into industry-standard vector tiles (Mapbox Vector Tiles / MVT) served via S3 + CloudFront.

## Architecture

```
hail_swaths (PostGIS)
  ↓
[Query] → GeoDataFrame (geopandas)
  ↓
[Export] → Newline-delimited GeoJSON
  ↓
[tippecanoe] → .mbtiles (SQLite3 container)
  ↓
[Split] → /tiles/{z}/{x}/{y}.pbf (gzipped)
  ↓
[Upload] → s3://hailscout-tiles/
  ↓
CloudFront CDN → https://tiles.hailscout.com/swaths/{z}/{x}/{y}.pbf
```

## Key Decisions

- **Tippecanoe:** Industry-standard MVT encoder. Configurable zoom levels, layer simplification, attribute preservation.
- **Layer name:** `swaths` (frontend references via `source-layer: swaths`).
- **Tile properties:** `hail_size`, `category`, `storm_id`, `start_time`, `end_time`, `max_size_in` (see COLOR_LEGEND.md for contract).
- **Zoom range:** Z4 (global) to Z14 (fine detail). Tippecanoe auto-simplifies at lower zooms.
- **Caching strategy:**
  - **Active tiles** (`/swaths/`): max-age=60s, must-revalidate (fast refresh for live swaths)
  - **Historical tiles** (`/historical/{date}/`): max-age=31536000, immutable (1 year; never changes)
- **Color legend:** Defined in `src/hailscout_tiles/colors.py` and documented in `COLOR_LEGEND.md` as the single source of truth.

## Setup

### Prerequisites

- Python 3.12
- Poetry
- tippecanoe (installed via Dockerfile; not required locally for development)
- GDAL/rasterio (via Docker)
- PostgreSQL 16 + PostGIS 3.4 (running; no password needed in Docker Compose)

### Local Development

```bash
# Install dependencies
make install

# Copy .env and configure
cp .env.example .env
# Edit .env with your DATABASE_URL, S3 bucket, CloudFront distribution ID

# Run linter and tests
make lint
make test

# Generate current tileset (requires live database)
make gen-tiles

# Upload to S3 (requires AWS credentials)
make upload
```

### Docker

```bash
# Build image
docker build -t hailscout-tiles:latest .

# Run tile-gen job
docker run --rm \
  -e DATABASE_URL="postgresql://..." \
  -e AWS_PROFILE=hailscout \
  hailscout-tiles:latest \
  python -m hailscout_tiles.cli generate-current
```

## Jobs & Schedules

### 1. Generate Current Tileset (Every 5 minutes)

Queries swaths from the last 7 days, outputs MVT tiles.

```bash
python -m hailscout_tiles.cli generate-current
```

**Run:** AWS Lambda on 5-minute EventBridge schedule, or Fargate task.
**Output location:** `s3://hailscout-tiles/swaths/`
**CloudFront invalidation:** Automatic (see `jobs/generate_current.py`).

### 2. Generate Historical Tileset (On-demand)

Backfills or re-generates tiles for a specific date range or single date.

```bash
python -m hailscout_tiles.cli generate-historical --date 2023-05-15 --bbox "-95.5,25.8,-95.3,26.0"
```

**Run:** Manual invocation, Fargate task, or Lambda with SNS trigger.
**Output location:** `s3://hailscout-tiles/historical/{YYYY-MM-DD}/`
**CloudFront invalidation:** Not needed (immutable cache).

### 3. CloudFront Invalidation (If needed)

Re-generates indexes when re-running a historical date or fixing a bug.

```bash
python -m hailscout_tiles.cli invalidate-cache --pattern "swaths/*"
```

## Database Setup

### Create Read-Only Role

Connect to your RDS instance:

```sql
-- Create a read-only user for the tile-gen job
CREATE ROLE tiles_reader WITH LOGIN PASSWORD 'your-secure-password';
GRANT CONNECT ON DATABASE hailscout TO tiles_reader;
GRANT USAGE ON SCHEMA public TO tiles_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO tiles_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO tiles_reader;
```

### Environment Variable

```bash
export DATABASE_URL="postgresql://tiles_reader:your-secure-password@hailscout-db.us-east-1.rds.amazonaws.com:5432/hailscout"
```

## Tile Properties & Frontend Integration

### Contract (Mapbox Vector Tile Specification)

Each feature in the `swaths` layer contains:

| Property | Type | Example | Notes |
|---|---|---|---|
| `hail_size` | string | `"1.75"`, `"3.0+"` | One of 8 categories; see COLOR_LEGEND.md |
| `category` | number | `4.0` | Float for ordering (0.75=0, 1.0=1, ..., 3.0+=7) |
| `storm_id` | string | `"550e8400-e29b-41d4-a716-446655440000"` | UUID; join to `storms` table |
| `start_time` | string | `"2024-05-15T14:30:00Z"` | ISO 8601 UTC |
| `end_time` | string | `"2024-05-15T16:45:00Z"` | ISO 8601 UTC |
| `max_size_in` | number | `2.5` | Max hail size in inches |

### MapLibre Style Integration

The frontend consumes the generated `style/maplibre_style.json`:

```json
{
  "id": "swaths-fill",
  "type": "fill",
  "source": "swaths",
  "source-layer": "swaths",
  "paint": {
    "fill-color": [
      "match",
      ["get", "hail_size"],
      "0.75", "#2ca02c",
      "1.0", "#ffff00",
      "1.25", "#ff7f0e",
      "1.5", "#ff7f0e",
      "1.75", "#d62728",
      "2.0", "#d62728",
      "2.5", "#9467bd",
      "3.0+", "#000000",
      "#cccccc"
    ],
    "fill-opacity": 0.6
  }
}
```

Insert this into your MapLibre spec under `layers[]` with:

```json
{
  "source": {
    "type": "vector",
    "tiles": ["https://tiles.hailscout.com/swaths/{z}/{x}/{y}.pbf"],
    "minzoom": 4,
    "maxzoom": 14
  }
}
```

## S3 Bucket Policy

Tiles are served publicly via CloudFront Origin Access Control (OAC). See `infra/s3-bucket-policy.json` for the required policy.

```bash
aws s3api put-bucket-policy \
  --bucket hailscout-tiles \
  --policy file://infra/s3-bucket-policy.json
```

## CloudFront Configuration

See `infra/cloudfront-distribution.tf` for Terraform spec. Key settings:

- **Origin:** S3 bucket with OAC (no public ACL needed)
- **Cache policies:**
  - `/swaths/*`: Cache-Control: max-age=60, must-revalidate
  - `/historical/*`: Cache-Control: max-age=31536000, immutable
- **Domain:** `tiles.hailscout.com` (via Route53 CNAME)
- **HTTPS:** ACM certificate for *.hailscout.com

## Color Legend

See `COLOR_LEGEND.md` for the industry-standard color mapping and the rationale behind each bin. This is the single source of truth — frontend + mobile + documentation all reference it.

## Zoom Level Guidance

- **Z 4–5:** World/continent view. Swaths coalesce; only largest storms visible.
- **Z 6–8:** State/region. Good for overview, area search.
- **Z 9–11:** County/metro. Useful for targeting neighborhoods.
- **Z 12–14:** Street/property. Finest detail; individual homes visible.

Tippecanoe auto-simplifies polygon geometries at lower zooms to keep tile size <500KB.

## Monitoring & Alerting

### CloudWatch Metrics

- `TileGenJob.Duration` — wall-clock time for generate-current job
- `S3.UploadedTiles` — count of .pbf files uploaded
- `S3.UploadSize` — total bytes uploaded
- `CloudFront.InvalidationTime` — time to complete cache invalidation

### Alarms

- If `generate-current` fails or exceeds 5 minutes → page on-call engineer
- If `S3.UploadSize` exceeds 1GB (memory leak in tippecanoe) → auto-rollback
- If CloudFront hit-rate drops below 90% → investigate origin (DB latency?)

## Troubleshooting

### No swaths appear in tiles

1. Check database query: `SELECT COUNT(*) FROM hail_swaths WHERE updated_at > NOW() - INTERVAL '7 days'`
2. Verify bbox logic in `pipeline/query.py` matches expected storm locations
3. Check tippecanoe invocation: `tippecanoe -o /tmp/test.mbtiles --layer=swaths input.geojson && mbutil /tmp/test.mbtiles /tmp/test_tiles/`
4. Verify S3 upload with `aws s3 ls s3://hailscout-tiles/swaths/`

### Tiles are slow to render

1. Zoom level too low — tiles too large. Recommend zoom 8+.
2. Check CloudFront cache hit rate (CloudWatch console). If <90%, investigate origin latency.
3. Verify gzip compression is applied: `aws s3api head-object --bucket hailscout-tiles --key swaths/4/0/0.pbf` → check `ContentEncoding: gzip`.

### Historical tileset bloats S3

Each historical date is immutable and cached forever. Purge old tiles after 2 years:

```bash
aws s3 rm s3://hailscout-tiles/historical/2020/ --recursive
```

## Architecture Decision Records (ADRs)

### ADR-001: Tippecanoe vs. PostGIS Tile Generation

**Decision:** Use Tippecanoe for offline tile generation, not PostGIS `ST_AsMVT()`.

**Rationale:**
- Tippecanoe is more mature, handles attribute preservation and zoom-level simplification better.
- Offline generation decouples tile freshness from database load.
- Easier to version-control tile specs (tippecanoe CLI args in code).

**Alternative:** PostGIS `ST_AsMVT()` in FastAPI endpoint. Rejected because:
- Every API request hits the database; doesn't scale.
- No built-in simplification or zoom-level handling.

### ADR-002: Newline-Delimited GeoJSON as Tippecanoe Input

**Decision:** Export GeoDataFrame as NDJSON, pipe to tippecanoe.

**Rationale:**
- Tippecanoe reads GeoJSON natively; no intermediate format needed.
- NDJSON is streaming-friendly; handles large swaths without loading entire file into memory.
- Easy to version-control in CI: test pipeline by diffing GeoJSON.

**Alternative:** PostGIS → Shapefile → tippecanoe. Rejected: shapefile has geometry limits, less portable.

### ADR-003: Gzipped .pbf Tiles with Content-Encoding Header

**Decision:** Store .pbf files gzipped in S3; set Content-Encoding: gzip.

**Rationale:**
- Tiles are highly compressible (10:1 ratio for swath polygons).
- CloudFront + browsers automatically decompress, transparent to MapLibre.
- Saves bandwidth and S3 egress costs.

## Contributing

All code is type-checked with `mypy`, linted with `ruff`, and tested with `pytest`.

```bash
make lint
make test
make type-check
```

Before submitting a PR:
1. Update the color legend in `COLOR_LEGEND.md` if you change `colors.py`.
2. Add tests for new tile properties in `tests/test_geojson_export.py`.
3. Document any new job in the Jobs section above.

## License

Copyright 2026 HailScout. All rights reserved. (TBD: open-source after MVP.)
