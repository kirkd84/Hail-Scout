# HailIntel — Master Build Document

**Version:** 1.0 (Week 0)
**Timeline:** 6 months to nationwide MVP
**Budget:** $15-40K (data + infra + contractors)
**Beachhead:** Roofing contractors
**Positioning:** AI-native, mobile-first, integrated-workflow. Undercut IHM on UX, undercut HailTrace on price.

---

## How to Use This Document

1. **Section 1 (PRD)** → paste into Cowork as the source-of-truth brief for all 5 agents. Every agent references this.
2. **Section 2 (Week-1 Assignments)** → paste individual agent blocks as their first tickets.
3. **Section 3 (Outreach Emails)** → copy, personalize, send today. Cole and Regrid have multi-week lead times.
4. **Section 4 (Human Checklist)** → your Week-1 to-dos that no agent can do.

---

# SECTION 1 — PRODUCT REQUIREMENTS DOCUMENT

## 1.1 Product Overview

**HailIntel** is a real-time and historical hail tracking platform for storm restoration contractors. It ingests NOAA radar data, renders forensic-grade hail swaths, and layers property/contact data so roofers can rapidly identify and canvass damaged neighborhoods.

**Core loop:** Storm hits → swath rendered in minutes → contractor sees affected properties on mobile → canvasses door-to-door → generates branded Hail Impact Reports for homeowners → closes work.

## 1.2 Target User (MVP)

Roofing contractor, 1-20 rep sales team, operating in hail-prone regions (TX, OK, KS, CO, MO, NE, IA). Annual revenue $500K-$10M. Currently paying $999-$1,999 for IHM or $3K-8K for HailTrace. Price-sensitive but accuracy-demanding. Uses AccuLynx, JobNimbus, or Roofr as CRM.

## 1.3 Competitive Positioning

| Feature | HailTrace | IHM | HailIntel |
|---|---|---|---|
| Price (nationwide) | $3-8K/yr | $1,999/yr | **$899/yr** |
| Real-time swaths | ✓ | ✓ | ✓ |
| Historical archive (2011+) | ✓ | ✓ | ✓ |
| Meteorologist review | ✓ | ✓ | AI + on-demand met |
| Mobile app quality | Mixed | Poor (Android) | **First-class both** |
| Frame-by-frame replay | — | ✓ (Hail Replay) | ✓ |
| AI-drafted reports | — | — | **✓** |
| Photo damage triage | — | — | **✓** |
| CRM integration | Some | Limited | **API-first** |
| Natural-language search | — | — | **✓** |

## 1.4 Data Sources

| Source | Purpose | Cost | Access |
|---|---|---|---|
| NOAA MRMS MESH | Real-time hail size grid | Free | `s3://noaa-mrms-pds/` |
| MYRORSS | Historical backfill to Jan 2011 | Free | NOAA/NSSL archive |
| NEXRAD Level II | Super-res frame replay | Free | `s3://noaa-nexrad-level2/` |
| SPC Storm Reports | Ground-truth spotter reports | Free | spc.noaa.gov |
| Regrid Parcels | Property boundaries + owner | $4-8K (state-level) → $80K (national) | API + bulk |
| Cole Information | Phone/email enrichment | $6-15K/yr | API |
| PWSWeather / Weather Underground | Wind station heatmap | Free tier | API |
| Mapbox Geocoding or Nominatim | Address → lat/lng | Pay-as-you-go or free | API |

## 1.5 Tech Stack (Locked Decisions)

**Reasoning:** Maximize agent productivity. TypeScript monorepo where possible, Python only for GIS/ML because the ecosystem is irreplaceable there.

- **Frontend web:** Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui + MapLibre GL JS
- **Mobile:** React Native (Expo SDK 52+) + TypeScript + MapLibre Native
- **Backend API:** FastAPI (Python 3.12) + SQLAlchemy + Alembic
- **Data pipeline:** Python (xarray, cfgrib, rasterio, geopandas, shapely)
- **ML:** PyTorch for future CNN work; MVP uses classical MESH processing
- **Database:** Postgres 16 + PostGIS 3.4 on AWS RDS (or Supabase managed)
- **Storage:** S3 for raw GRIB2, processed GeoTIFFs, report PDFs
- **Tiles:** Vector tiles via `tippecanoe` → served from CloudFront
- **Queue:** AWS SQS + Lambda for ingestion; Celery for heavier ML jobs
- **Auth:** Clerk (fast, handles orgs + seats natively)
- **Payments:** Stripe (Subscriptions + Billing Portal)
- **PDFs:** React-PDF for branded Hail Impact Reports
- **Monitoring:** Sentry (errors) + Axiom (logs) + CloudWatch
- **Hosting:** Vercel (frontend), AWS ECS/Fargate (API), AWS Lambda (pipeline crons)

## 1.6 Data Model (Core Tables)

```
organizations      (id, name, plan_tier, stripe_customer_id, created_at)
users              (id, email, org_id, role, clerk_user_id)
seats              (id, org_id, user_id, assigned_at)

storms             (id, start_time, end_time, max_hail_size_in, centroid_geom,
                    bbox_geom, source)
hail_swaths        (id, storm_id, hail_size_category, geom_multipolygon,
                    updated_at)  -- categories: 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0+

nexrad_frames      (id, storm_id, timestamp, radar_site, tile_url_pattern)

parcels            (id, source_id, geom_polygon, address, city, state, zip,
                    owner_name, mailing_address, landuse, building_footprint)
contacts           (id, parcel_id, phone, email, owner_full_name,
                    source, last_refreshed_at)  -- Cole-sourced, license-bound

monitored_addresses(id, org_id, parcel_id, label, alert_threshold_in, created_at)
markers            (id, user_id, org_id, storm_id, parcel_id, geom_point,
                    status, notes, photos, created_at)  -- status: lead, knocked,
                    -- no_answer, appt, contract, not_interested
impact_reports     (id, org_id, parcel_id, pdf_s3_key, generated_at, branded_logo_url)
contact_exports    (id, org_id, storm_id, polygon_geom, row_count, s3_key,
                    exported_at)  -- for audit trail + TCPA compliance

alerts             (id, org_id, storm_id, triggered_at, max_size_in, channel)
```

## 1.7 API Contracts (v1)

Base: `https://api.hailintel.com/v1`
Auth: Clerk JWT in `Authorization: Bearer <token>`

```
POST   /auth/session                       # Handled by Clerk
GET    /me                                 # Current user + org + seats

# Storm & hail queries
GET    /storms?bbox=...&from=...&to=...    # List storms in bbox/date range
GET    /storms/{id}                        # Storm detail with swath GeoJSON
GET    /storms/{id}/replay                 # NEXRAD frame list for Hail Replay
GET    /hail-at-address?address=...        # All storm history at address
GET    /hail-at-address?lat=...&lng=...    # Same by coords
POST   /storms/combine                     # Union swaths across date range
GET    /storms/{id}/impact-explorer        # Cities/towns hit with counts

# Tiles (served via CloudFront, not API)
GET    /tiles/swaths/{z}/{x}/{y}.pbf       # Vector tile of current swaths
GET    /tiles/historical/{date}/{z}/{x}/{y}.pbf

# Reports
POST   /reports/hail-impact                # Generate branded PDF report
       body: { parcel_id, storm_ids?, branding: {logo_url, company, phone} }
GET    /reports/{id}                       # Retrieve generated PDF

# Canvassing
POST   /markers                            # Drop a canvassing marker
PATCH  /markers/{id}                       # Update status (knocked, appt, etc.)
GET    /markers?storm_id=...&org_id=...
POST   /markers/bulk-export                # CSV export for offline ops

# Monitoring & alerts
POST   /monitored-addresses
GET    /monitored-addresses
DELETE /monitored-addresses/{id}
GET    /alerts?from=...&to=...

# Contact data (Cole-sourced; license-gated)
POST   /contacts/enrich                    # Enrich a single parcel
POST   /contacts/bulk-export               # From polygon/storm; TCPA-logged
       body: { polygon: GeoJSON, storm_id?, consent_acknowledgment: true }

# AI features (Month 4+)
POST   /ai/storm-score                     # 1-5 star algorithmic scoring
POST   /ai/damage-triage                   # Analyze uploaded contractor photos
POST   /ai/query                           # Natural language: "storms > 1.5in in Denton 2024"
POST   /ai/claim-letter                    # Draft insurance claim support letter
```

## 1.8 Non-Functional Requirements

- **Swath freshness:** MRMS pull → rendered tile in under 6 minutes (IHM claims minutes; we must match)
- **Uptime target:** 99.5% during hail season (Mar-Sep), 99.0% off-season
- **Geocoding accuracy:** 95%+ match rate to parcel centroid
- **Report generation:** PDF in under 10 seconds
- **Mobile offline:** Last 7 days of storms cacheable for field use without signal
- **Scale target (Month 6):** 500 concurrent users, 10K API calls/min peak during major outbreak

## 1.9 Out of Scope for MVP

- Court-admissible "forensic" reports signed by credentialed met (Month 7+, revenue-funded)
- Insurance carrier-tier product (different buyer, different sales cycle)
- International expansion (Canada, Australia)
- Wind-only or tornado-only products (come bundled; not standalone)
- Full CNN-based swath refinement (baseline MESH is enough for MVP; CNN is Year 2)
- Hurricane tracking (seasonal; not competitive necessity)

## 1.10 Legal & Compliance

- **TCPA:** Bulk contact exports must log acknowledgment. Contract exported lists carry the org's liability, not ours — stated in TOS.
- **CCPA:** Right-to-delete flow for any CA-resident property owner whose data appears in Cole exports.
- **Cole MSA restrictions:** Resale limits TBD; respect in export terms.
- **Regrid licensing:** Parcel data may not be redistributed as bulk file; in-app display and per-user export only.
- **DMCA / report branding:** Customer uploads logo; we display on PDF but don't store beyond report generation.

---

# SECTION 2 — WEEK 1 AGENT ASSIGNMENTS

Each block below is one agent's first ticket. Paste into Cowork as the initial assignment when spinning up that agent.

## 2.1 Cowork PM Setup (You Configure This First)

**Recurring jobs to schedule:**
- Every 2 min: health check on MRMS ingestion Lambda
- Every 15 min: alert if no new swath data for any active storm
- Daily 8am CT: status digest email — what each agent shipped, what's blocked
- Daily 11pm CT: pre-generate Hail Impact Reports for all monitored addresses hit in last 24hr
- Weekly Monday 7am: generate sprint plan doc, assign tickets to agents
- Weekly Friday 5pm: retrospective + metrics dashboard update

**Slack or email routing:**
- `#agent-alerts` channel: failed jobs, agent blockers
- `#deploys` channel: all agent PRs merged
- Your personal email: daily digest only, weekly retro

## 2.2 Data Pipeline Agent — Week 1

**Goal:** Continuous live ingestion of NOAA MRMS MESH data into our PostGIS database.

**Tickets:**
1. Create `hailintel-data-pipeline` repo. Python 3.12, Poetry, ruff, pytest.
2. Set up AWS IAM role with read access to `noaa-mrms-pds` S3 bucket.
3. Build ingestion worker: every 2 min, fetch latest `MESH_Max_1440min_00.50` GRIB2 file.
4. Parse GRIB2 with `cfgrib` + `xarray`, convert to GeoTIFF, store in `s3://hailintel-raw/mesh/{year}/{month}/{day}/{timestamp}.tif`.
5. Extract swath polygons by hail-size threshold using `rasterio` + `shapely`. Categories: 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0+ inches.
6. Insert/upsert into `hail_swaths` table via SQLAlchemy.
7. Deploy as AWS Lambda on 2-minute EventBridge cron.
8. CloudWatch alarm: page if no successful run in 10 minutes.

**Acceptance:** Live MRMS data flowing into PostGIS, query `SELECT COUNT(*) FROM hail_swaths WHERE updated_at > NOW() - INTERVAL '5 minutes'` returns non-zero during any active US storm.

**Don't do yet:** Historical MYRORSS backfill (Month 2), NEXRAD Level II (Month 4).

## 2.3 Backend/API Agent — Week 1

**Goal:** FastAPI service with auth, core schema, and stub endpoints.

**Tickets:**
1. Create `hailintel-api` repo. FastAPI + SQLAlchemy + Alembic + Pydantic v2.
2. Docker Compose for local Postgres 16 + PostGIS 3.4.
3. Clerk SDK integration; middleware extracting user + org from JWT.
4. Alembic migration 001: all tables from PRD §1.6.
5. Implement and test: `GET /me`, `GET /storms?bbox=...`, `GET /hail-at-address?address=...` (stub geocoding with Nominatim initially).
6. OpenAPI docs at `/docs`, health check at `/health`.
7. Deploy to AWS ECS Fargate behind ALB, Route53 `api.hailintel.com`.
8. GitHub Actions CI: test + type-check on PR, deploy on merge to `main`.

**Acceptance:** `curl https://api.hailintel.com/v1/hail-at-address?address=Plano,TX` returns real storm history from ingested data.

**Don't do yet:** Stripe (Month 5), PDF reports (Month 2), Cole integration (Month 3).

## 2.4 Frontend Agent — Week 1

**Goal:** Next.js web app with working map, address search, and Clerk auth.

**Tickets:**
1. Create `hailintel-web` repo. Next.js 15 App Router + TypeScript + Tailwind v4 + shadcn/ui.
2. Clerk middleware and sign-in/sign-up flows.
3. Landing page at `/` — hero, pricing ($899/yr nationwide), feature comparison vs IHM/HailTrace.
4. Authenticated `/app` shell with sidebar nav.
5. MapLibre GL JS component with OpenStreetMap base tiles, pan/zoom/geolocate controls.
6. Address search bar using `/hail-at-address` endpoint. Drop marker on match, show storm list in sidebar.
7. Deploy to Vercel. Domain: `app.hailintel.com`.

**Acceptance:** User signs up, logs in, searches an address, sees storm history pinned on map.

**Don't do yet:** Canvassing UI (Month 3), Hail Replay (Month 4), dashboards (Month 5).

## 2.5 ML/Swath Agent — Week 1

**Goal:** Render swath data as vector tiles in the map with industry-standard color coding.

**Tickets:**
1. Create `hailintel-tiles` repo. Python + `tippecanoe` + GDAL.
2. Tile generation job: query `hail_swaths` by bbox+date, output MVT vector tiles.
3. Color legend: green (0.75"), yellow (1.0"), orange (1.25-1.5"), red (1.75-2"), purple (2.5"+), black (3"+). Match industry standard so roofers don't re-learn.
4. Push tiles to `s3://hailintel-tiles/`, fronted by CloudFront.
5. Expose URL pattern `https://tiles.hailintel.com/swaths/{z}/{x}/{y}.pbf`.
6. Integration: frontend agent adds this as a vector source layer in MapLibre.

**Acceptance:** Viewing the map at zoom 6-14 over a known historical storm shows the colored swath overlay correctly.

**Don't do yet:** NEXRAD frame tiles (Month 4), AI scoring (Month 4), photo triage (Month 4).

## 2.6 Mobile Agent — Week 1

**Goal:** Expo app scaffolded with auth, ready for Month 3 heavy build.

**Tickets:**
1. Create `hailintel-mobile` repo. Expo SDK 52+, TypeScript, EAS Build.
2. Clerk Expo SDK integration, sign-in/sign-up screens.
3. React Navigation: Map tab, Addresses tab, Settings tab.
4. MapLibre Native placeholder with user location blue dot.
5. Configure EAS for iOS + Android builds.
6. Submit to TestFlight Internal + Google Play Internal (even as a shell — review times are the enemy, start now).

**Acceptance:** App installs on real iOS and Android devices, user can sign in, map renders with blue dot.

**Don't do yet:** Canvassing flows, push notifications, offline cache — all Month 3.

---

# SECTION 3 — OUTREACH EMAILS

## 3.1 Cole Information — Send Today

**To:** `sales@coleinformation.com`
**Subject:** Introduction — HailIntel, new storm-restoration SaaS

> Hi Cole team,
>
> I'm [Your Name], founder of HailIntel — a new storm-intelligence platform for roofing contractors launching nationwide in 2026. I'd like to open a conversation about licensing your residential contact data as part of our product.
>
> For context, we'll be serving roofing contractors with a real-time and historical hail mapping tool. Contact enrichment on parcels inside active storm swaths is a core feature, and Cole is the industry-standard source — I believe both Interactive Hail Maps and HailTrace source from you.
>
> Would you have time for a 20-minute intro call in the next two weeks? I'd like to understand:
>
> - MSA terms and pricing at our stage (pre-launch, pilot customers ramping in month 3)
> - API access versus bulk delivery options
> - Any use-case restrictions for storm-restoration SaaS
> - Monthly refresh cadence and match-rate expectations
>
> Happy to share more about the product, roadmap, and expected volume on the call.
>
> Best,
> [Your Name]
> Founder, HailIntel
> [phone] | [email]

## 3.2 Regrid — Send Today

**To:** `parcels@landgrid.com`
**Subject:** State-level parcel API — hail-alley coverage for storm-intel SaaS

> Hi Regrid team,
>
> I'm [Your Name], founder of HailIntel, a storm-intelligence platform launching in 2026 for roofing contractors.
>
> We need nationwide parcel coverage eventually, but our 6-month MVP is focused on hail-alley states — Texas, Oklahoma, Kansas, Colorado, Missouri, Nebraska, and Iowa. Given your $80K/yr nationwide tier is ahead of our current stage, I'd like to explore:
>
> 1. State-level bulk licensing for those 7 states (which package and cost?)
> 2. Parcel API pricing — we'd use it for on-demand hydration of parcels within storm swaths, so volume is storm-event-driven
> 3. Upgrade path from state-level to nationwide once we have paying pilot revenue (anticipated month 5-6)
>
> Could we schedule a 20-minute intro call in the next two weeks? I can share projected volumes and the integration model.
>
> Best,
> [Your Name]
> Founder, HailIntel
> [phone] | [email]

## 3.3 Pilot Roofer Outreach — Send This Week

**To:** 5 target contractors in DFW, OKC, Denver
**Subject:** Free 6 months of hail mapping — want early access?

> Hey [First Name],
>
> I run [Your Company / HailIntel]. We're building a hail mapping platform for roofing contractors — think Interactive Hail Maps or HailTrace, but with a better mobile app, AI-drafted Hail Impact Reports, and nationwide access at $899/yr instead of $2K-8K.
>
> We're picking 3-5 contractors to be founding pilots. Here's the deal:
>
> - **6 months completely free** — full nationwide access, all features, unlimited seats
> - **Direct line to me for feedback.** Tell me what sucks, and I'll fix it that week.
> - **Lifetime 50% discount** if you decide to stay on after the pilot.
>
> What I need from you: honest feedback about 2x per month, and permission to quote you when we launch publicly.
>
> If that sounds interesting, want to jump on a 15-minute call? I can show you what we've got so far and hear about your current storm workflow.
>
> [Your Name]
> [phone]
>
> P.S. We're also working on contractor-photo damage triage using AI — upload a roof photo, get hail impact assessment. Would that be useful to you?

## 3.4 Meteorologist Consultant Outreach — Send Month 3

**To:** LinkedIn message to 10 certified consulting meteorologists (AMS CCM directory, forensic meteorology specialty)
**Subject:** Part-time consulting met for hail SaaS — inquiry

> Hi [Name],
>
> I'm the founder of HailIntel, a storm-intelligence platform for roofing contractors launching this year. We're looking for a certified consulting meteorologist for retained part-time work starting month 4-5.
>
> The role:
> - Review a small volume of "legal-tier" Hail Impact Reports each month (the ones destined for insurance disputes or court)
> - Occasionally consult on QC of our AI-generated storm scoring
> - ~5-15 hours per month retainer, scaling with customer growth
>
> Pay: competitive hourly or monthly retainer, your choice. Fully remote.
>
> If you'd be open to a 20-minute chat, I'd love to walk through what we're building and see if it's a fit.
>
> Best,
> [Your Name]

---

# SECTION 4 — WEEK 1 HUMAN CHECKLIST

Tasks only you can do. Cowork cannot do these.

**Monday:**
- [ ] Send Cole Information email (§3.1)
- [ ] Send Regrid email (§3.2)
- [ ] Register domain: hailintel.com + back-ups (hailintel.app, hailintel.io)
- [ ] Reserve socials: @hailintel on IG, X, TikTok, YouTube, LinkedIn

**Tuesday:**
- [ ] Apply to AWS Activate for $5K credit
- [ ] File Stripe Atlas for Delaware C-corp OR use Clerky ($500)
- [ ] Open Mercury business bank account (instant approval)
- [ ] Stand up Cowork project; paste this entire doc as the brief

**Wednesday:**
- [ ] Create GitHub org `hailintel`
- [ ] Create Apple Developer account ($99/yr)
- [ ] Create Google Play Developer account ($25 one-time)
- [ ] Cowork spins up the 5 agents with assignments from §2

**Thursday:**
- [ ] Identify 10 target pilot roofers (LinkedIn + Facebook groups: Roofing Insights, Adam Bensman's Roof Strategist community, local chapters)
- [ ] Personalize and send pilot outreach emails to 5 best-fit candidates (§3.3)

**Friday:**
- [ ] Review agents' Week-1 progress via Cowork digest
- [ ] Tweak assignments based on what shipped vs. blocked
- [ ] Attorney intro call — TCPA-savvy tech attorney for TOS + Cole MSA review ($3-5K budget)

**Recurring starting Week 2:**
- [ ] Monday: Review Cowork weekly sprint plan before agents kick off
- [ ] Wednesday: 30-min pilot roofer check-in calls (as they come on)
- [ ] Friday: Cowork retro; note what's drifting from the PRD

---

# SECTION 5 — RISKS & MITIGATIONS

| Risk | Likelihood | Mitigation |
|---|---|---|
| Cole MSA takes > 8 weeks | Medium | Start week 1; have OpenAddresses/free assessor fallback for MVP |
| Regrid state bulk exceeds $8K | Medium | Fall back to Parcel API pay-as-you-go |
| Agent code drifts from PRD | High | Weekly human architecture review; PRD is versioned |
| First major storm overwhelms infra | Medium | Load test in month 4 with historical storm replay |
| iOS/Play review delays launch | High | Submit shell apps in Month 1 to start review clock |
| Pilot roofer gives bad review publicly | Medium | Over-communicate during pilot; offer white-glove onboarding |
| MESH accuracy complaints | High | Frame as "AI + human-reviewed" tier for the skeptics; route legal-tier through consulting met |
| Cloud bills balloon | Medium | Tiered S3 storage (Glacier for archive > 90 days); Lambda not EC2 for spiky jobs |

---

# SECTION 6 — SUCCESS METRICS

**Month 3:** 3 pilot roofers actively using; 50+ storms ingested; mobile app in TestFlight

**Month 6 (launch):** 25-50 paying orgs at $899; ~$25-45K ARR; full nationwide parity; 1 CRM integration live (AccuLynx or JobNimbus)

**Month 12:** 200+ paying orgs; $180K+ ARR; consulting met retained; first insurance-adjuster pilot conversation; CNN training data collection underway

---

*Document owner: [You]. Update cadence: weekly during build. All agents reference this as source of truth; conflicting instructions defer to the PRD.*
