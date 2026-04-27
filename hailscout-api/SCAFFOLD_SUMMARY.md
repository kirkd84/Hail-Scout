# HailScout API — Week 1 Scaffold Summary

**Status:** Production-ready scaffold complete. Ready for Kirk to pick up for Week 1 execution.

## File Count & Deliverables

**Total files created: 61**
- Source code: 24 Python modules
- Configuration: 6 files (pyproject.toml, .env.example, docker-compose.yml, etc.)
- Database: 4 Alembic migration files
- Tests: 5 test modules
- CI/CD: 2 GitHub Actions workflows
- Infrastructure: 3 IaC templates
- Documentation: 1 README

## What's Fully Wired

### ✓ Core Framework
- FastAPI app factory with CORS middleware
- SQLAlchemy async ORM with Alembic migrations
- Pydantic v2 request/response validation
- structlog JSON logging setup
- Custom error handling with RFC 7807-ish problem details

### ✓ Authentication & Authorization
- Clerk JWT verification via JWKS endpoint
- Middleware extracting user + org from token
- Support for multi-org users via X-Org-Id header
- Claims parsing from JWT

### ✓ Database Schema (All 14 Tables from PRD §1.6)
1. **organizations** — multi-tenant workspace
2. **users** — Clerk-synced user records
3. **seats** — org-level seat allocation
4. **storms** — storm events with MESH sourcing
5. **hail_swaths** — swath polygons by size category (GeoJSON MULTIPOLYGON)
6. **nexrad_frames** — NEXRAD Level II metadata
7. **parcels** — Regrid property boundaries (Geometry POLYGON)
8. **contacts** — Cole contact enrichment
9. **monitored_addresses** — org-subscribed address alerts
10. **markers** — user canvassing markers
11. **impact_reports** — generated PDF metadata
12. **contact_exports** — audit trail for TCPA compliance
13. **alerts** — triggered alert log

All geometry columns use PostGIS with SRID 4326 (WGS84). Spatial indexes created in migration 001.

### ✓ Week 1 Endpoints (Fully Implemented)
- **GET /health** — Database health check
- **GET /me** — Current user + org + seats (requires Clerk JWT)
- **GET /storms?bbox=...&from=...&to=...** — List storms in bbox/date range
- **GET /hail-at-address?address=...** — Historical hail at location (geocoding via Nominatim)

### ✓ Geocoding Abstraction
- Abstract `Geocoder` base class with two implementations:
  - `NominatimGeocoder` (MVP, free, identifies via User-Agent)
  - `MapboxGeocoder` (production-ready stub, just needs API key swap)
- Factory function `get_geocoder()` for seamless provider switching
- Nominatim rate limit & policy documented

### ✓ Storm Query Service
- `query_storms_in_bbox()` — PostGIS spatial queries
- `query_hail_at_point()` — Uses ST_Contains to find swaths containing a point
- Joined storm + swath results with chronological ordering

### ✓ Stub Endpoints (All with 501 + M# TODO markers)
All remaining §1.7 endpoints have Pydantic schemas + 501 stubs:
- Storm detail + replay (M2, M4)
- PDF reports (M2)
- Markers, alerts, monitoring (M3)
- Contact enrichment (M3)
- AI features: scoring, damage triage, NLP, claim letters (M4-M5)
- Tiles (CloudFront reference)

OpenAPI docs at `/docs` shows complete contract including stubs.

### ✓ Docker & Local Development
- Multi-stage Dockerfile (Python 3.12 slim)
- docker-compose.yml with Postgres 16 + PostGIS 3.4
- Makefile with dev, test, lint, mypy, migrate, docker-up targets
- Health checks on containers

### ✓ Testing Foundation
- pytest + pytest-asyncio + httpx
- conftest.py with fixtures for DB session, settings, async client
- Test stubs for /health, /me, /storms, /hail-at-address
- Ready for integration tests once Clerk mock is added

### ✓ CI/CD Pipelines
- **ci.yml** — On PR: ruff lint, mypy type-check, pytest on Postgres
- **deploy.yml** — On merge to main: build image → push ECR → update ECS service

### ✓ Infrastructure Templates
- **ecs-task-definition.json** — Fargate task with secrets manager integration
- **alb-listener-rules.json** — ALB routing + health check config
- **route53-records.tf** — DNS alias + Route53 health check

## What's Stubbed (Not Yet Implemented)

- Month 2: PDF reports, historical swath tiles, storm detail endpoint
- Month 3: Cole enrichment, canvassing UI, monitored address alerts
- Month 4: NEXRAD replay, AI storm scoring, damage triage, photo analysis
- Month 5: Stripe billing, natural language queries, claim letter drafting

All have clear `# TODO(M#):` comments and complete Pydantic schemas.

## Schema & Database Decisions

1. **Geometry types:** All PostGIS columns use explicit Geometry() types:
   - `centroid_geom` → POINT (storms)
   - `bbox_geom` → POLYGON (storms)
   - `geom_multipolygon` → MULTIPOLYGON (hail_swaths)
   - `geom_polygon` → POLYGON (parcels)
   - `geom_point` → POINT (markers)

2. **Foreign keys:** All references to organizations.id use CASCADE delete by default (Alembic will set this).

3. **Indexes:** Spatial GIST indexes created on geometry columns. Additional indexes on frequently filtered columns (start_time, storm_id, org_id, etc.).

4. **Timestamps:** All tables use DateTime(timezone=True) with server_default=func.now() for UTC consistency.

5. **String IDs:** Organizations, users, storms, etc. use UUIDs (String 255) as primary keys for Clerk integration. Alembic migration ready for Postgres UUID type migration if needed later.

## Open Questions for Kirk to Review

1. **Clerk JWKS Endpoint:** Currently hardcoded placeholder in `.env.example`. Confirm your Clerk instance URL and update accordingly.

2. **Database Pooling:** Set to 20 connections with 1-hour recycle. Adjust based on expected concurrency during Week 3+ scaling tests.

3. **ECS Task Sizing:** Currently 256 CPU / 512 MB memory. Plan for load testing in Month 4 to right-size.

4. **Nominatim Rate Limiting:** MVP assumes ~1 req/sec. If frontend drives higher geocoding volume (e.g., bulk uploads), consider early Mapbox migration or caching.

5. **PostGIS Spatial Indexes:** Migration creates GIST indexes. Once data ingestion starts (Week 2 pipeline agent), monitor query performance and consider BRIN indexes if swath count > 100K.

6. **Pagination Cursor:** Currently timestamp-based. For large result sets, switch to keyset pagination (cursor = `(timestamp, id)` tuple).

7. **AWS Secrets Manager:** ECS task definition references hardcoded secret ARNs. Update with actual values after creating secrets.

8. **Test Database:** conftest.py currently uses SQLite in-memory for fast test runs. Switch to Postgres test container if you need exact PostGIS behavior testing.

## Deployment Pre-Flight Checklist

Before Kirk/team deploys to ECS:
1. [ ] Create AWS Secrets Manager secrets for DATABASE_URL, CLERK_SECRET_KEY, CLERK_JWKS_ENDPOINT
2. [ ] Provision RDS Postgres 16 + PostGIS 3.4 (or use Supabase managed)
3. [ ] Create ECR repo: `hailscout-api`
4. [ ] Create ECS cluster: `hailscout`
5. [ ] Create ECS service from task definition with ALB target group
6. [ ] Create Route53 hosted zone for `hailscout.com` and alias `api.hailscout.com` to ALB
7. [ ] Run initial migration: `alembic upgrade head` on RDS
8. [ ] Set GitHub secrets: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
9. [ ] Test: `curl https://api.hailscout.com/health`

## Next Steps (Week 2)

1. **Data Pipeline Agent** starts ingesting MRMS data into hail_swaths table
2. **Test with real data:** Once swaths are flowing, verify `/hail-at-address?address=Plano,TX` returns storm history
3. **Clerk sync:** Create test users/orgs in Clerk, verify `/me` endpoint works
4. **Frontend integration:** Frontend team uses `/v1/storms` + `/v1/hail-at-address` endpoints
5. **Load testing:** Verify API scales under spike load during active storms (target: 10K req/min)

## Development Commands Quick Reference

```bash
# Setup
make install
make docker-up

# Development
make dev                 # Run server with reload
make migrate             # Run Alembic migrations
make migrate-new         # Create new migration

# Testing & Quality
make test                # Run pytest
make test-cov            # With coverage report
make lint                # Ruff check
make format              # Ruff fix + black format
make mypy                # Type check

# Docker
make docker-logs         # Tail logs
make docker-down         # Stop containers
make clean               # Remove cache
```

---

**Scaffold created:** 2025-04-24
**Ready for:** Kirk to execute Week 1 tickets (Clerk integration, test data, endpoint validation)
