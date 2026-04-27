# HailScout — Monorepo

Real-time and historical hail tracking platform for storm-restoration contractors.

**GitHub:** https://github.com/kirkd84/Hail-Scout
**Master PRD:** [HailIntel_Build_Doc_2.md](./HailIntel_Build_Doc_2.md) (internal codename "HailIntel" — the consumer-facing brand is **HailScout**)
**Owner:** Kirk · kirk@rooftechnologies.com

> **Brand note.** The product, GitHub repo, codebase, and all customer-facing surfaces use **HailScout**. The original PRD (`HailIntel_Build_Doc_2.md`) was authored under the codename "HailIntel" and is preserved as a historical planning artifact — references to "HailIntel" in that file should be read as "HailScout".

---

## Repo layout

```
Hail-Scout/                              # Root — github.com/kirkd84/Hail-Scout
├── README.md                            # This file
├── HailIntel_Build_Doc_2.md             # Master PRD (versioned source of truth)
├── outreach/                            # Personalized outreach drafts
│   ├── 01_cole_information.md
│   ├── 02_regrid.md
│   ├── 03_pilot_roofer.md
│   └── 04_consulting_meteorologist.md
├── hailscout-data-pipeline/             # Python · MRMS ingestion · AWS Lambda
├── hailscout-api/                       # FastAPI · PostGIS · Clerk · ECS Fargate
├── hailscout-web/                       # Next.js 15 · MapLibre GL JS · Vercel
├── hailscout-tiles/                     # Python · tippecanoe · S3 + CloudFront
└── hailscout-mobile/                    # Expo · React Native · MapLibre Native · EAS
```

Each subdirectory is independently buildable, with its own README, dependencies, CI workflow (path-filtered), and deploy configuration. They share contracts (DB schema, API types, tile properties), not code.

---

## Architecture at a glance

```
                        ┌────────────────────────────────┐
                        │   NOAA MRMS / NEXRAD / SPC     │
                        │   (s3://noaa-mrms-pds, etc.)   │
                        └───────────────┬────────────────┘
                                        │
                                        ▼
                          ┌─────────────────────────────┐
                          │   hailscout-data-pipeline   │
                          │   Lambda · 2-min EventBridge│
                          │   GRIB2 → polygons → PostGIS│
                          └───────────────┬─────────────┘
                                          │
                                          ▼
              ┌───────────────────────────────────────────┐
              │   PostGIS (RDS Postgres 16 + PostGIS 3.4) │
              │   storms · hail_swaths · parcels · ...    │
              └─────────┬──────────────────┬──────────────┘
                        │                  │
                        ▼                  ▼
        ┌──────────────────────┐   ┌──────────────────────┐
        │   hailscout-tiles    │   │    hailscout-api     │
        │   tippecanoe → MVT   │   │  FastAPI · Clerk JWT │
        │   S3 + CloudFront    │   │   ECS Fargate · ALB  │
        └──────────┬───────────┘   └──────────┬───────────┘
                   │                          │
                   │ tiles.hailscout.com      │ api.hailscout.com
                   │                          │
                   ▼                          ▼
        ┌──────────────────────┐   ┌──────────────────────┐
        │   hailscout-web      │   │   hailscout-mobile   │
        │   Next.js · Vercel   │   │  Expo · iOS+Android  │
        │   app.hailscout.com  │   │  TestFlight + Play   │
        └──────────────────────┘   └──────────────────────┘
```

---

## Workstream owners (Cowork agent assignments)

| Workstream | Repo | Week-1 PRD ref |
|---|---|---|
| Data Pipeline | `hailscout-data-pipeline/` | §2.2 |
| Backend / API | `hailscout-api/` | §2.3 |
| Frontend Web | `hailscout-web/` | §2.4 |
| Tiles / Swaths | `hailscout-tiles/` | §2.5 |
| Mobile | `hailscout-mobile/` | §2.6 |

Cowork PM scheduling jobs (§2.1) are listed in [`COWORK_PM_BRIEF.md`](./COWORK_PM_BRIEF.md).

---

## Shared contracts

These are the integration points between subsystems. Treat them as load-bearing — change them only with a coordinated PR across affected repos.

### Database schema (PRD §1.6)
Source of truth: `hailscout-api/migrations/versions/001_initial_schema.py`. The data pipeline and tiles repos read against the same schema; they must NOT migrate it.

### Tile feature properties (output of `hailscout-tiles`)
Each feature in vector layer `swaths` carries:

| Property | Type | Example |
|---|---|---|
| `hail_size` | string | `"1.75"`, `"3.0+"` (one of 8 categories) |
| `category` | number | `4.0` — float for sorting |
| `storm_id` | uuid string |  |
| `start_time` | ISO 8601 UTC string |  |
| `end_time` | ISO 8601 UTC string |  |
| `max_size_in` | number | inches |

Source of truth: [`hailscout-tiles/COLOR_LEGEND.md`](./hailscout-tiles/COLOR_LEGEND.md).

### Color legend (industry standard — don't deviate)

| Hail size | Color | Hex |
|---|---|---|
| 0.75" | green | `#2ca02c` |
| 1.0" | yellow | `#ffff00` |
| 1.25"–1.5" | orange | `#ff7f0e` |
| 1.75"–2.0" | red | `#d62728` |
| 2.5"+ | purple | `#9467bd` |
| 3.0"+ | black | `#000000` |

The web and mobile clients import this from `hailscout-tiles` rather than redefine it.

### API base URL
Production: `https://api.hailscout.com/v1`
Auth: `Authorization: Bearer <Clerk JWT>` + optional `X-Org-Id`

---

## Week-1 status (scaffolded, not deployed)

| Repo | Status | Files | Notes |
|---|---|---|---|
| hailscout-data-pipeline | scaffolded | ~68 | Awaits real MRMS GRIB2 fixture + AWS account to verify |
| hailscout-api | scaffolded | ~54 | All §1.6 tables + 4 implemented endpoints + stubbed rest |
| hailscout-web | scaffolded | ~79 | Landing + auth + map shell + address search wired to API |
| hailscout-tiles | scaffolded | ~44 | Color legend + tippecanoe pipeline + CloudFront infra |
| hailscout-mobile | scaffolded | ~35 | Auth gate + bottom tabs + MapLibre Native blue dot |

**No code has been run, installed, or deployed.** Each repo has a README with setup steps. See PRD §4 for the human checklist of accounts/services that must be set up first.

---

## Critical path (Week 1 → Week 4)

1. **Week 1 — accounts & domains** (PRD §4 — only Kirk can do these)
   - Domains: hailscout.com (primary) + back-ups
   - GitHub org `hailscout` (or stay on personal `kirkd84` and rename later)
   - AWS Activate, Stripe Atlas, Mercury, Clerk org, Apple/Google Developer accounts
   - Outreach: Cole + Regrid emails go out Monday — long lead times

2. **Week 2 — wire credentials**
   - Drop creds into each repo's `.env`
   - `poetry install` / `npm install` in each, run local dev
   - Run pipeline against real MRMS bucket; verify swaths land in PostGIS

3. **Week 3 — first deploy**
   - `sam deploy` for the pipeline; CloudWatch alarms armed
   - `terraform apply` for the tiles bucket + CloudFront
   - ECS Fargate for the API; Vercel for web; EAS preview for mobile
   - Smoke test: search "Plano, TX" → see real storm history

4. **Week 4 — first pilot demo**
   - Pilot roofer #1 onboarded against the live system
   - Begin §2.1 Cowork PM recurring jobs (digest, retro, alerts)

---

## How to update this doc

The PRD (`HailIntel_Build_Doc_2.md`) is the versioned source of truth. This README is a navigational layer — keep it terse. Material changes (schema, API contract, tile properties, color legend) belong in the relevant subdirectory's docs, with this README only carrying the pointer.
