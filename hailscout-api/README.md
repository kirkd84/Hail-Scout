# HailScout API

Production-ready FastAPI service serving the HailScout data API. Ingests NOAA MRMS hail swaths, serves storm history and property-level hail impact queries for roofing contractors.

**Status:** Week 1 scaffold — authentication, core schema, and initial endpoints wired. Stub endpoints for Month 2+ features.

## Quick Start

### Prerequisites
- Python 3.12
- Docker & Docker Compose
- PostgreSQL 16 + PostGIS 3.4 (via Docker Compose)

### Local Development

```bash
# Install dependencies
make install

# Start Postgres + PostGIS
make docker-up

# Run migrations
make migrate

# Start dev server
make dev
```

The API will be available at `http://localhost:8000`. OpenAPI docs: `http://localhost:8000/docs`.

## Architecture

### Tech Stack
- **Framework:** FastAPI (async, OpenAPI 3.0)
- **Database:** PostgreSQL 16 + PostGIS 3.4 (geospatial queries)
- **ORM:** SQLAlchemy 2.0 (async support)
- **Migrations:** Alembic
- **Validation:** Pydantic v2
- **Auth:** Clerk (JWT + JWKS)
- **Geocoding:** Nominatim (MVP; Mapbox abstraction ready)
- **Type Checking:** mypy
- **Linting:** ruff
- **Testing:** pytest + httpx

### Directory Structure
```
src/hailscout_api/
├── main.py              # FastAPI app factory
├── config.py            # Settings via Pydantic
├── deps.py              # Shared dependencies
├── auth/                # Clerk JWT + middleware
├── db/                  # SQLAlchemy models
├── schemas/             # Pydantic request/response
├── routes/              # Route handlers
├── services/            # Business logic (geocoder, storm queries)
└── core/                # Logging, errors, constants
```

## API Reference

**Base URL:** `/v1`

**Authentication:** `Authorization: Bearer <clerk_jwt_token>`

### Week 1 Endpoints (Fully Implemented)

#### `GET /me`
Current user + organization + seats.

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/v1/me
```

Response:
```json
{
  "user": {
    "id": "user_123",
    "email": "alice@example.com",
    "role": "owner"
  },
  "organization": {
    "id": "org_456",
    "name": "ABC Roofing",
    "plan_tier": "pro",
    "created_at": "2025-01-01T00:00:00Z"
  },
  "seats": [
    {
      "id": "seat_789",
      "user_id": "user_123",
      "assigned_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

#### `GET /storms`
List storms in a bounding box and date range.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/v1/storms?bbox=-97.5,31.5,-96.5,32.5&from=2025-04-01&to=2025-04-30"
```

Parameters:
- `bbox` (required): comma-separated minlon,minlat,maxlon,maxlat
- `from` (required): ISO 8601 date
- `to` (required): ISO 8601 date
- `limit` (optional): default 50, max 100
- `cursor` (optional): pagination token

Response:
```json
{
  "storms": [
    {
      "id": "storm_123",
      "start_time": "2025-04-15T14:30:00Z",
      "end_time": "2025-04-15T18:00:00Z",
      "max_hail_size_in": 1.5,
      "centroid": { "type": "Point", "coordinates": [-97.0, 32.0] },
      "bbox": { "type": "Polygon", "coordinates": [...] }
    }
  ],
  "cursor": "next_page_token_here",
  "total": 42
}
```

#### `GET /hail-at-address`
Query historical hail impacts at an address.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/v1/hail-at-address?address=Plano,TX"
```

Parameters:
- `address` or (`lat` + `lng`): address string or coordinates
- `from` (optional): ISO 8601 date (default: 2011-01-01)
- `to` (optional): ISO 8601 date (default: today)

Response:
```json
{
  "address": {
    "query": "Plano, TX",
    "formatted": "Plano, Texas, United States",
    "lat": 33.2093,
    "lng": -96.8083
  },
  "hail_history": [
    {
      "storm_id": "storm_456",
      "date": "2024-05-15",
      "max_hail_size_in": 1.75,
      "category": "1.75\"",
      "distance_miles": 0.2,
      "impact_probability": 0.92
    }
  ]
}
```

#### `GET /health`
Health check with database status.

```bash
curl http://localhost:8000/v1/health
```

Response:
```json
{
  "status": "ok",
  "db": "ok",
  "timestamp": "2025-04-24T12:34:56Z"
}
```

### Stub Endpoints (Month 2+)

All other endpoints in §1.7 return `501 Not Implemented` with a clear `# TODO(M2)` marker:

- `GET /storms/{id}` — detailed swath + metadata (M2)
- `GET /storms/{id}/replay` — NEXRAD frame list (M4)
- `POST /reports/hail-impact` — PDF generation (M2)
- `POST /markers` — canvassing markers (M3)
- `GET /monitored-addresses` — address monitoring (M3)
- `POST /contacts/enrich` — Cole enrichment (M3)
- `POST /ai/storm-score` — ML scoring (M4)
- ... and 10+ others

All have complete Pydantic request/response schemas so the OpenAPI doc is comprehensive.

## Environment Variables

See `.env.example` for the complete list. Required vars:

```
DATABASE_URL=postgresql+asyncpg://user:pass@postgres:5432/hailscout
CLERK_SECRET_KEY=<your-clerk-secret-key>
CLERK_JWKS_ENDPOINT=https://your-instance.clerk.accounts.com/.well-known/jwks.json
```

## Database Schema

Alembic migration `001_initial_schema.py` creates all tables from PRD §1.6:

- **organizations** — multi-tenant workspace
- **users** — Clerk-synced user records
- **seats** — org-level seat allocation
- **storms** — storm events with MESH sourcing
- **hail_swaths** — swath polygons by size category (0.75", 1.0", 1.25", 1.5", 1.75", 2.0", 2.5", 3.0"+)
- **nexrad_frames** — NEXRAD Level II metadata for replay
- **parcels** — Regrid property boundaries (Polygon)
- **contacts** — Cole contact enrichment (license-gated)
- **monitored_addresses** — org-subscribed address alerts
- **markers** — user canvassing markers with status
- **impact_reports** — generated PDF metadata
- **contact_exports** — audit trail for TCPA compliance
- **alerts** — triggered alert log

All geometry columns use PostGIS types with SRID 4326 (WGS84).

## Geocoding

**MVP:** Nominatim (OpenStreetMap). Write-once abstraction in `services/geocoder.py`:

```python
from hailscout_api.services.geocoder import Geocoder

geocoder = Geocoder()  # defaults to NominatimGeocoder
lat, lng, formatted = await geocoder.geocode("Plano, TX")
```

**Future:** Drop-in `MapboxGeocoder(api_key=...)` replacement. No changes to routes needed.

**Nominatim policy:** Requests limited to 1/sec with identifying User-Agent header. See comments in code.

## Testing

```bash
# Run all tests
make test

# Run with coverage
pytest --cov=hailscout_api tests/

# Type check
make mypy

# Lint
make lint
```

Tests use a transactional rollback fixture for isolation. Mock Clerk JWKS in conftest.

## Deployment

### Docker Compose (Local Dev)
```bash
make docker-up
# Postgres + PostGIS + API all running
docker-compose logs -f api
```

### AWS ECS Fargate (Production)

Configs provided but **not deployed yet** per ticket instructions:

- `Dockerfile` — multi-stage Python 3.12 slim, distroless runtime
- `docker-compose.yml` — local Postgres + PostGIS
- `infra/ecs-task-definition.json` — ECS Fargate task definition template
- `infra/alb-listener-rules.json` — ALB routing rules
- `.github/workflows/ci.yml` — PR: ruff, mypy, pytest
- `.github/workflows/deploy.yml` — merge to main: build, push ECR, update ECS

**Manual pre-deployment:**
1. Set Clerk JWKS endpoint in ECS task environment
2. Provision RDS Postgres 16 + PostGIS
3. Provision ECS cluster + ALB + Route53 alias for `api.hailscout.com`
4. Create ECR repo
5. Run migrations on RDS: `alembic upgrade head`

## Monitoring & Observability

- **Logging:** structlog with JSON formatting for Axiom/CloudWatch
- **Errors:** Sentry integration ready (configure via env var)
- **Health:** `/health` endpoint + database connectivity check

## Development Workflow

### Create a New Route

1. Define Pydantic schema in `schemas/`
2. Create route handler in `routes/`
3. Wire into `main.py` under the `/v1` router
4. Add tests in `tests/`
5. Run `make mypy && make lint && make test`

### Add a Database Column

1. Create a new Alembic migration: `alembic revision --autogenerate -m "description"`
2. Review the generated file in `migrations/versions/`
3. Test locally: `make migrate`
4. Commit and push

## Known Limitations & Open Questions

1. **Clerk JWKS Endpoint:** Hardcoded in `.env.example` as a placeholder. Kirk: confirm your Clerk instance URL and update.
2. **ECS Task CPU/Memory:** Currently set to 256 CPU / 512 MB RAM. Adjust based on load testing in Month 4.
3. **Nominatim Rate Limiting:** MVP assumes ~1 req/sec. If the frontend drives higher geocoding volume, consider switching to Mapbox earlier or caching results.
4. **PostGIS Spatial Indexes:** Migration creates basic indexes. May need tuning for 100K+ swaths.
5. **Pagination Cursor:** Using timestamp-based cursor. For large result sets, switch to keyset pagination.

## Roadmap

**Month 2:** Detailed storm endpoint, PDF reports, MYRORSS historical backfill
**Month 3:** Canvassing UI, Cole enrichment, monitored address alerts
**Month 4:** NEXRAD replay, AI storm scoring, photo triage
**Month 5:** Stripe billing, AI natural-language queries
**Month 6+:** Advanced features, scale-out, consulting met tier

## Contributing

- All PRs must pass: `make lint`, `make mypy`, `make test`
- Code coverage target: 80%+
- Type hints required everywhere
- Docstrings for public functions

## License

Proprietary — HailScout Inc.
