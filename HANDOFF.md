# HailScout — Claude Code Handoff (updated 2026-05-07)

You're picking up an in-flight build of HailScout, a multi-tenant SaaS hail
intelligence platform for roofing contractors. Most of the app is shipped
and live. The current focus is **getting real NOAA MRMS hail data flowing
into the production database** — replacing fixture data everywhere.

**Read this whole file before touching code.** Then run the steps in the
"How to pick up" section.

---

## Where things stand

**Live infrastructure:**
- Web: https://hail-scout.vercel.app (Next.js 15.5 on Vercel)
- API: https://hail-scout-production.up.railway.app (FastAPI on Railway)
- DB:  Railway-managed Postgres + PostGIS
- Auth: Clerk (https://dashboard.clerk.com)
- Tiles: MapTiler
- Repo: https://github.com/kirkd84/Hail-Scout
- Latest commit on `main`: `ff357e6` (or newer)

**What's already done (96 phases):**
The app has marketing site (landing, pricing, FAQ, case studies, live storms,
claim lookup), full app shell at `/app` (map with hail swaths, dashboard,
addresses watchlist, markers, alerts, reports, territories, crew, photo-AI,
team management, settings with tabs), CRM-lite contacts at `/app/customers`,
follow-up calendar at `/app/calendar`, super-admin tools, audit log, Slack
integration, real-time SSE, Cmd-K palette, mobile Expo app — all deployed
and working. Read `STATUS.md` for the full inventory.

**What's still on fixtures:**
Every hail polygon you see in production is from
`hailscout-web/src/lib/storm-fixtures.ts`. The `storms`, `hail_swaths`,
and `nexrad_frames` tables exist in Postgres but are mostly empty.
The whole next phase (16.x) is about replacing fixtures with real data.

---

## What's done in Phase 16 already

**Decision: Pipeline runs as a Railway worker container** (not AWS Lambda).
**Decision: Backfill 12 months of history** from Iowa State MtArchive.

**Phase 16.1 — Audit (done).** Found that the pipeline scaffold had real
S3/orchestration/upsert structure but the GRIB-parsing and polygonization
modules were stubbed, and the pipeline DB models used `UUID(as_uuid=True)`
while the deployed API uses `String(255)` — they wouldn't share a table.

**Phase 16.2 + 16.3 — Pipeline rewrite (done, commit `9829f3a`).**
- Aligned pipeline `db/models.py` to API schema (String IDs, NOT NULL fields).
- Added migration `012_hail_swath_uniq` for the `(storm_id, hail_size_category)`
  unique constraint the upsert needs.
- Wrote real `grib_to_geotiff.py` — cfgrib parsing, mm→inches, lat/lon
  normalization (0..360 → -180..180, north-up reorder), gzip handling.
- Wrote real `polygonize.py` — per-category masking → `rasterio.features.shapes`
  → `shapely.unary_union` MultiPolygons. Filters swaths < 4 px (noise).
- Wrote real `upsert.py` — centroid + bbox from `shapely.unary_union`,
  one Storm per (date, source) with widening end_time + max_size,
  `ON CONFLICT` upsert per swath.
- `MRMSClient` uses anonymous S3 (`botocore.UNSIGNED`) for the public
  `noaa-mrms-pds` bucket — no AWS creds needed.
- `IowaArchiveClient` (new) pulls historical MRMS from
  `mtarchive.geol.iastate.edu` over HTTPS for backfill (NOAA's S3 only
  keeps the last ~7 days).
- `__main__.py` CLI: subcommands `live`, `once <path>`, `backfill --since
  --until --cadence`, `loop --interval-seconds`. The `loop` command is the
  Railway worker entrypoint.
- `Dockerfile` — `python:3.12-slim` + GDAL + ecCodes + PROJ + GEOS so
  cfgrib and rasterio compile and run.
- `railway.json` declares the Dockerfile build with restart policy.
- `requirements.txt` (replacing poetry) with pinned numpy/xarray/cfgrib/
  rasterio/shapely/geoalchemy2.
- Dropped the `storage/s3.py` raw-cache module. Re-process is cheaper than
  running an extra AWS account for v1.

**Phase 16.5 — API route TODOs (done, commit `ff357e6`).**
- `routes/storms.py` no longer returns hardcoded `[0.0, 0.0]` placeholders.
  Uses `ST_AsGeoJSON` for centroid + bbox.
- New `GET /v1/storms/at-point?lat=&lng=` for "what hit this address?"
  (returns largest hail-size category whose polygon contains the point).
- Real `GET /v1/storms/{id}` detail endpoint with all swaths included.
- `services/storm_query.py`: `query_storms_in_bbox` uses `ST_Intersects`
  on `bbox_geom` against `ST_MakeEnvelope`. New `get_storm_with_swaths`,
  new `query_hail_at_point`.
- `schemas/storm.py`: `HailAtPointResponse`, `HailSwathResponse`,
  `GeoMultiPolygon`. `StormDetailResponse` extended.
- List query renamed `from_date`/`to_date` → `?from=` / `?to=` (alias)
  to match what the web/mobile clients will send.

---

## What's left (in priority order)

### Phase 16.4 — First end-to-end pipeline run (still blocked on local Docker)

**Goal:** download one MESH GRIB2 file, parse it, write swaths to a real DB,
verify the polygons by spot-checking the GeoJSON output.

**What landed in the 2026-05-07 session (push to `main`):**
- `0d0df20` — Phase 16.8 hooks (`useStorms`, `useStormDetail`, `useStormsAtPoint`)
  added, additive only. Plus a fix to `/v1/hail-at-address` that was about to
  crash on first MRMS write (it was unpacking `(storm, swath)` tuples after
  Phase 16.5 changed `query_hail_at_point` to return rolled-up dicts).
- `95bfb59` — pipeline temp-file leaks closed. `_maybe_gunzip` now reports
  whether it created a file so the caller can `unlink` it; `cmd_live` and
  `cmd_backfill` wrap ingest in `try/finally` so the downloaded
  `.grib2.gz` is removed even if cfgrib or the DB throws. Without this the
  Railway worker would have leaked ~860 MB/day at 5-min cadence.
- `a0ed131` — two production-blocking bugs:
  - `Storm.start_time/end_time` and `NexradFrame.timestamp` lacked
    `DateTime(timezone=True)`, so the new `/v1/storms` route was
    500-ing with an asyncpg "naive vs aware datetime" error on every
    request. (Live API is now happy — `/v1/storms?...` returns
    `{"storms":[],"cursor":null,"total":0}` instead of 500.)
  - `IowaArchiveClient` was building 404 URLs. Iowa's directory is
    `mrms/ncep/MESH_Max_1440min/` (no `_00.50` suffix); the file
    inside still has the `_00.50` prefix. NOAA's S3 is the one that
    has the suffix at both levels. Verified manually against
    2024-06-15, 2026-05-06, and the 1-year-old date the backfill
    starts at.

**Still blocked here (the smoke run itself):** the dev sandbox has no
local Docker and no Railway auth. The Phase 16.4 / 16.7 deploy is your
hand. The good news: code is now in a state where the moment the
container boots, alembic 012 lands, the loop starts, and `/v1/storms`
returns real rows.

**Steps (you, on your own machine or via Railway dashboard):**
1. `cd hailscout-data-pipeline`
2. Build the Docker image: `docker build -t hailscout-pipeline .`
3. Set `DATABASE_URL` env var pointing at the Railway Postgres. Get it from
   `railway variables -s hailscout-api` or copy from the Railway dashboard.
4. The API container already runs `alembic upgrade head` on every boot,
   and it redeployed cleanly after `a0ed131`. Migration `012_hail_swath_uniq`
   should already be applied. If you want to confirm:
   `DATABASE_URL=... alembic -c hailscout-api/alembic.ini current`
   from a checkout.
5. One-shot smoke test:
   `docker run --rm -e DATABASE_URL=$DATABASE_URL hailscout-pipeline \
      python -m hailscout_pipeline live`
   Expected: pipeline downloads the latest MESH file, parses it, polygonizes,
   inserts one Storm + N HailSwaths.
6. Verify: hit `https://hail-scout-production.up.railway.app/v1/storms?bbox=-105,30,-90,42&from=2026-04-01&to=2026-12-31`
   (continental US bbox covering Tornado Alley). You should see at least
   one storm in the response with real centroid/bbox.
7. Sanity-check the geometry: copy the bbox/centroid/one swath geometry
   from the API response and paste into geojson.io. The polygons should
   look like meandering ribbons over land, not weird grid blocks. If they
   do look like grid blocks, the pixel→polygon contouring needs another
   pass.

**Common issues you'll hit:**
- **cfgrib first-time use** opens an index cache file (`*.idx`). Make sure
  the temp dir is writable. (We set `indexpath=""` so it's in-memory only,
  but it still has to be able to scratch.)
- **Anonymous S3 access** — the `MRMSClient` already configures
  `botocore.UNSIGNED`. If you see `NoCredentialsError`, something's been
  reverted.
- **Swaths empty** — common during quiet weather. If `live` returns
  `swath_count: 0` retry during/after a storm, or seed via the `once`
  command using a known-active GRIB.

### Phase 16.6 — 12-month backfill

Once 16.4 works, kick off the backfill:

```bash
docker run --rm -e DATABASE_URL=$DATABASE_URL hailscout-pipeline \
  python -m hailscout_pipeline backfill \
    --since 2025-05-03 --until 2026-05-03 \
    --cadence 6h
```

Expected runtime: ~2-4 hours (pulls one file every 6 hours of wall time
across 365 days = ~1460 GRIB files). Cadence 6h is sparse but enough for
v1; tighten to `1h` later if needed. The backfill is idempotent — if it
crashes you can resume.

Sanity-check after: `SELECT count(*), max(start_time), min(start_time)
FROM storms;` — expect ~365 storm rows, oldest ~12 months ago.

### Phase 16.7 — Schedule live ingestion on Railway

1. Create a new Railway service in the same project as `hailscout-api` and
   the Postgres add-on.
2. Point it at the `hailscout-data-pipeline` directory of this monorepo
   (Railway can build from a subdirectory). Builder = Dockerfile.
3. Inject `DATABASE_URL` from the shared Postgres add-on.
4. Default start command (from `railway.json`):
   `python -m hailscout_pipeline loop --interval-seconds 300`.
5. Confirm logs show `live_done` JSON every ~5 min and that Storm row
   counts grow over the next hour.

### Phase 16.8 — Switch web from fixtures to live API

**Status:** hooks landed in `0d0df20`, no consumers migrated yet.

`hailscout-web/src/hooks/useStorms.ts` exposes:
- `useStorms({ bbox, from, to, limit?, fallbackToFixtures? })` → /v1/storms
- `useStormDetail(id)` → /v1/storms/{id} with full swath GeoJSON
- `useStormsAtPoint({ lat, lng, fallbackToFixtures? })` → /v1/storms/at-point

All three:
- Are unauthenticated (the API exposes them publicly).
- Short-circuit to fixtures when `NEXT_PUBLIC_USE_FIXTURES === "1"`.
- Accept `fallbackToFixtures: true` for graceful degradation when the
  API replies with an empty list — useful in the post-deploy / pre-pipeline
  window so the demo isn't blank.
- An `adaptApiStorm()` helper flattens the API's GeoJSON `centroid`/`bbox`
  into the existing UI `Storm` shape so consumers don't need to refactor
  rendering code immediately.

**Migration order (suggested) — do these AFTER the pipeline is producing data:**
1. `app/(marketing)/live/page.tsx` — public storm gallery. Use `useStorms`
   over a CONUS bbox + last 90 days.
2. `app/(marketing)/claim/page.tsx` and `hooks/useStormsAtAddress.ts` —
   point at `useStormsAtPoint`. Today the address-search hook still calls
   the legacy `/v1/hail-at-address` (which we just patched to not crash);
   switch it to `/v1/storms/at-point` for consistency.
3. `app/app/map/page.tsx` — biggest one. Map currently renders fixtures
   directly; needs to consume swath GeoJSON from `useStormDetail`. The
   per-storm "bands" become the per-category swath polygons returned by
   the API — same conceptual shape, but the API geometries will be much
   more granular than fixtures, so expect rendering tweaks.
4. `app/app/page.tsx` — dashboard "today on the atlas".
5. `app/(marketing)/storm/[id]/page.tsx` — public storm detail.

Don't try to do all five in one pass. Each migration should: (a) swap the
fixture import for the hook, (b) test the page in dev with the env flag
both ways, (c) ship.

Test after: load `/app/map`, the hail polygons should match the geometry
the pipeline produced. Sanity-check by toggling MapLibre's layer panel
and comparing against IowaState's MRMS viewer for the same date.

### Phase 16.9 — Switch mobile from fixtures to live API

Same as 16.8 but for `hailscout-mobile`. The fixture file is at
`hailscout-mobile/src/lib/storm-fixtures.ts` (or similar). Hook pattern
mirrors web; reuse the API client at `hailscout-mobile/src/lib/api.ts`.

---

## Architectural decisions to keep

- **Topographic brand:** cream `#F5F1EA` + deep teal `#0F4C5C` + copper `#D87C4A`,
  cartographer/field-guide voice ("the atlas your crew opens every morning").
  National Geographic + Mapbox Studio + Field Notes references. Marketing
  surfaces are Apple-grade craft; app surface is Google-Maps-grade simplicity.
- **Industry-standard hail palette:** matches HailTrace / IHM / NWS — pea,
  penny, quarter, half-dollar, walnut, golf-ball, hen-egg, tennis, baseball,
  softball. Defined in `hailscout-data-pipeline/src/hailscout_pipeline/extraction/thresholds.py`
  and `hailscout-web/src/lib/hail.ts`.
- **One Storm per (UTC date, source).** All swaths from the same MRMS
  product on the same calendar day roll up to one Storm row. Per-system
  clustering (split by storm cell) can come later.
- **Anonymous S3 for `noaa-mrms-pds`** — public bucket, no AWS account needed.
- **Iowa State MtArchive for backfill** — `mtarchive.geol.iastate.edu`,
  HTTPS, going back ~10 years. This is the standard public archive.
- **Railway worker, not Lambda.** One Railway project, one bill, simpler
  mental model. The `lambda_handler.py` is kept as a shim in case
  EventBridge cron is ever wanted.
- **Same Postgres for API and pipeline.** They write to the same `storms`
  + `hail_swaths` + `nexrad_frames` tables. The pipeline's `db/models.py`
  must mirror the API's schema exactly. If you change one, change the other.

---

## Repo layout (top-level dirs)

```
HailScout/
├── hailscout-api/             # FastAPI + SQLAlchemy + Alembic. Railway-deployed.
├── hailscout-web/             # Next.js 15.5 + Clerk + MapLibre. Vercel-deployed.
├── hailscout-mobile/          # Expo + React Native + MapLibre RN.
├── hailscout-data-pipeline/   # MRMS ingestion. Railway-deployed (new).
├── hailscout-tiles/           # Vector tile service (scaffolded, not built).
├── README.md
├── STATUS.md                  # Cumulative phase log; read this!
├── HANDOFF.md                 # This file.
└── COWORK_PM_BRIEF.md
```

Inside `hailscout-data-pipeline/src/hailscout_pipeline/`:
```
__main__.py              # CLI entrypoint (live / once / backfill / loop)
config.py                # Pydantic settings — DATABASE_URL, MRMS bucket
db/
  models.py              # Storm, HailSwath — must mirror API exactly
  session.py             # SQLAlchemy engine
  upsert.py              # Real centroid+bbox + ON CONFLICT upsert
ingestion/
  mrms_client.py         # MRMSClient (anonymous S3) + IowaArchiveClient
  grib_to_geotiff.py     # cfgrib → MeshGrid (numpy + transform)
extraction/
  thresholds.py          # 8-bin hail size palette
  polygonize.py          # raster mask → MultiPolygon per category
lambda_handler.py        # Legacy shim for EventBridge (not the canonical entrypoint)
```

Inside `hailscout-api/src/hailscout_api/`:
```
routes/storms.py         # /v1/storms, /storms/{id}, /storms/at-point
services/storm_query.py  # PostGIS queries with ST_Intersects, ST_AsGeoJSON
db/models/storm.py       # Storm, HailSwath, NexradFrame ORM
schemas/storm.py         # Response Pydantic models with GeoJSON shapes
migrations/versions/     # 012 is the latest — adds the unique constraint
```

---

## Gotchas (these will bite you)

1. **Pipeline + API model schemas must stay in lockstep.** If you change
   either `hailscout-api/.../db/models/storm.py` or
   `hailscout-data-pipeline/.../db/models.py`, change both. They map to
   the same physical tables.

2. **GitHub PAT** lives at `.cowork-secrets` in the workspace folder
   (Kirk has a different setup; check whatever your CI/credential helper
   is). Pushes from the dev sandbox use HTTPS basic-auth via the PAT.

3. **GRIB2 files come gzipped from Iowa State.** Filename is
   `*.grib2.gz`. The pipeline's `parse_mesh_grib` already handles `_maybe_gunzip`.

4. **MESH values are in millimeters in the GRIB, inches in the DB.**
   `parse_mesh_grib` does the divide-by-25.4. Don't double-convert.

5. **Latitude orientation.** GRIB sometimes ships south-up; rasterio wants
   north-up for "north up" affine transforms. `parse_mesh_grib` flips if
   needed.

6. **Longitude wrapping.** MRMS sometimes uses 0..360 instead of -180..180.
   The parser normalizes.

7. **`max_hail_size_in` is NOT NULL** in the deployed schema, but the
   first version of the upsert had `max_hail_size_in=None` for new rows
   on UPDATE. The current version computes max from the swath set.
   Don't regress this.

8. **`ON CONFLICT (storm_id, hail_size_category)`** requires the unique
   constraint added by migration `012_hail_swath_uniq`. If you see
   `there is no unique or exclusion constraint matching the ON CONFLICT
   specification`, that migration didn't run.

9. **Don't silently swap brand colors.** Topographic palette is locked
   (cream/teal/copper). Anything that doesn't fit a National Geographic
   atlas page should be flagged before merging.

10. **Don't quote-cite memory blindly.** Memory entries can age — verify
    against the current code before asserting "this is how X works."
    The codebase is moving fast.

---

## How to pick up

1. Clone the repo and check the latest commit:
   ```
   git clone https://github.com/kirkd84/Hail-Scout.git
   cd Hail-Scout
   git log --oneline -5
   ```
2. Read these files in order:
   - `STATUS.md` (full phase history)
   - `HANDOFF.md` (this file)
   - `hailscout-data-pipeline/src/hailscout_pipeline/__main__.py`
   - `hailscout-data-pipeline/src/hailscout_pipeline/db/upsert.py`
   - `hailscout-api/src/hailscout_api/routes/storms.py`
   - `hailscout-api/src/hailscout_api/services/storm_query.py`
3. Pull the Railway `DATABASE_URL` for the production Postgres into a
   local env var. (Use a read-only role first if you have one. The
   pipeline will write Storms + HailSwaths.)
4. Run alembic migrations against the Railway DB:
   ```
   cd hailscout-api
   DATABASE_URL=$DATABASE_URL alembic upgrade head
   ```
   You should see `012_hail_swath_uniq` apply.
5. Smoke test the pipeline (Phase 16.4):
   ```
   cd ../hailscout-data-pipeline
   docker build -t hailscout-pipeline .
   docker run --rm -e DATABASE_URL=$DATABASE_URL hailscout-pipeline \
     python -m hailscout_pipeline live
   ```
6. Verify via the API (continental US bbox):
   `curl 'https://hail-scout-production.up.railway.app/v1/storms?bbox=-105,30,-90,42&from=2026-04-01&to=2026-12-31'`
7. Once that returns a real Storm, kick off Phase 16.6 (backfill).
8. After backfill, Phase 16.7 (Railway scheduled deploy), then 16.8 + 16.9
   (web + mobile fixture swap).

---

## Communication style

- Don't ask Kirk to confirm individual file edits — work autonomously.
- Push commits to `main` directly. Each commit message starts with the
  phase number (e.g. "Phase 16.4 — first MRMS run").
- Keep responses terse. Kirk reads diffs.
- When you finish a phase, mark it completed in TodoWrite (or whatever
  task tracking your CLI provides) and move to the next.
- If you hit a real blocker (auth, DB schema, rate limit, etc.), surface
  it specifically — don't try a dozen workarounds silently.
- The brand voice is cartographer/atlas. Marketing copy and component
  names should fit. App surface should "get out of the way" like Google Maps.

Have fun. There's a lot built. The next session is mostly plumbing.
