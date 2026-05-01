# HailScout — Session Handoff (2026-04-30, post Phases 9–11)

Latest commit: pending push of Phase 11.5. The full conference-ready
build, top-to-bottom.

---

## Live state

| Surface | URL | Status |
|---|---|---|
| GitHub repo | https://github.com/kirkd84/Hail-Scout | ✓ |
| Marketing site | https://hail-scout.vercel.app | ✓ |
| Public claim lookup | https://hail-scout.vercel.app/claim | ✓ |
| Public storm gallery | https://hail-scout.vercel.app/live | ✓ |
| Public storm detail | https://hail-scout.vercel.app/storm/[id] | ✓ |
| API | https://hail-scout-production.up.railway.app | ✓ |
| Postgres + PostGIS | Railway managed | ✓ |
| Mobile app (Expo) | source in `hailscout-mobile/` | ✓ buildable |
| Auth (Clerk) | dashboard.clerk.com | ✓ |
| MapTiler tiles | NEXT_PUBLIC_MAPTILER_KEY | ✓ |

---

## Phase 9 — Mobile, Slack, real-time, clustering, claim lookup, audit, sweep

**9.1 Mobile app overhaul** `a2fa895` — Topographic-themed Expo shell.
Bottom tabs: Home / Atlas / Alerts / Addrs / Settings. Real branded
sign-in/up flow. Pull-to-refresh, MapLibre Carto basemap, sync to API.

**9.2 Slack webhook integration** `9b050c0` — per-org webhook URL.
Alert generator fans out new matches to Slack. SlackCard on settings.
Test message endpoint.

**9.3 Real-time push via SSE** `6459e89` — `/v1/alerts/stream` with
heartbeat. EventSource subscribes; toasts and badges update instantly.
60s polling stays as a backstop.

**9.4 Marker clustering** `338d8f4` — cream/copper bubbles at low zoom,
click-to-expand. Counts auto-format as "10+", "50+", etc.

**9.5 Public claim lookup** `91e892f` — `/claim` page for homeowners
and adjusters. Address search → instant fixture hits. "Try one of these"
shortcuts for demo cities. Copy share link. CTA for contractors.

**9.6 Audit log + super-admin viewer** `88fffc4` — every alert/marker/
report/branding/Slack/team change is logged. Super-admin `/super-admin/audit`
with action-filter chips and joined user emails.

**9.7 Polygon sweep** `e8e0585` — "Sweep area" button. Draw polygon →
generates jittered grid of synthetic parcels inside → drops up to 50
markers. Esc to cancel, Enter to close polygon.

---

## Phase 10 — Onboarding, assignments, comparison, activity feed

**10.1 Onboarding wizard** `17916c7` — 5-step modal auto-opens for
first-time users on `/app`. Welcome → save first address → show storms
at it → explain reports → invite team. Skippable; persists `seen` flag.

**10.2 Marker assignment** `1ef86f9` — `assignee_user_id` on markers.
Assignee dropdown in editor, filter chips on `/app/markers` (All /
Assigned to me / Per-teammate / Unassigned). Inline assignee chip on
each row.

**10.3 Storm comparison** `903fa91` — `/app/compare?a=…&b=…`. Two
pickers, AI verdict ("DFW is the bigger event by 0.75″"), side-by-side
storm cards, comparison table with copper-highlighted winners.

**10.4 Full activity feed** `43644d3` — `/app/activity` merges alerts,
reports, markers chronologically. Filter chips per type. Click any row
to drill in.

---

## Phase 11 — Final conference polish

**11.1 Keyboard shortcuts modal** `a9b54c3` — `?` opens reference modal.
Global / Palette / Atlas groups. Doesn't trigger inside inputs.

**11.2 All-markers CSV export** `a9b54c3` — Export button on
`/app/markers`. Respects current filter. Includes assignee email.

**11.3 Testimonial carousel** `a9b54c3` — 3 rotating quotes (owner,
sales, ops), auto-advance every 8s, pause on hover, dot navigation.
Replaces single static quote on the landing.

**11.4 Inspection checklist** `a9b54c3` — On marker editor when status
is knocked / appt / contract. Roof type chips, age input, damage
multi-select chips. Persists by JSON-encoding inside `marker.notes`
with an `::INSPECT::` prefix — no schema change required.

**11.5 Landing FAQ** `pending` — 8-question accordion between
testimonials and final CTA. Covers price, data source, accuracy,
mobile, integrations, switching, free trial, who's behind it.

---

## Demo flow for the conference

1. **`/`** — landing. Live count badge, hero with atlas plate, ROI
   calculator, testimonial carousel, FAQ.
2. **`/live`** — public storm gallery. Live + recent cards with
   nested-band SVG plates.
3. **`/storm/fx-storm-amarillo-04-26`** — public storm detail (3.5″
   softball). Insurance-grade.
4. **`/claim`** — homeowner address lookup. Try "Dallas TX".
5. Sign in. **`/app`** — dashboard with onboarding wizard auto-open
   for first-time users. KPIs, live storms, recent activity.
6. **`/app/map`** — atlas. Live storm pulse, time scrubber, filters,
   drop-pin, sweep tool, storm activity feed, basemap toggle, marker
   clustering (drop a few pins to see).
7. Click a storm → AI insight + Download PDF + Export Leads CSV +
   Copy share link.
8. **`/app/alerts`** — bell badge, dropdown panel, full page with
   bulk mark-read.
9. **`/app/team`** — invite teammate, change roles.
10. **`/app/compare`** — pick two storms, see verdict.
11. **`/app/activity`** — full activity feed.
12. **`/app/markers`** — filter by assignee, export CSV.
13. **`/app/photo-ai`** — drag a roof photo, mocked CV verdict.
14. **`/app/settings`** → BrandingCard + SlackCard + replay tour
    buttons.
15. **`/super-admin/audit`** — every workspace event logged (only if
    you're a super-admin).
16. Press **`?`** anywhere — keyboard shortcuts reference.

---

## Stack at a glance

**Web:** Next.js 15.5, Tailwind 3.4, shadcn/ui, MapLibre GL, MapTiler,
Clerk, SWR, react-pdf, cmdk, next-themes, Fraunces + Inter + JetBrains
Mono.

**API:** FastAPI (Python 3.12), SQLAlchemy 2.x async, asyncpg, PostGIS
3.4, Alembic (8 migrations), Pydantic v2, Clerk + Svix.

**Mobile:** Expo SDK 52, React Native, MapLibre RN, Clerk Expo,
react-native-svg.

**Branded design system** — Topographic palette (cream + deep teal +
copper), industry-standard hail palette (NWS / HailTrace-aligned),
identical hail.ts + tokens across web and mobile.

---

## Backlog (post-conference)

- Custom contact records / CRM
- Calendar integration for follow-ups
- Email digest (needs SMTP)
- More CRM integrations (AccuLynx, JobNimbus, ServiceTitan)
- Real photo-damage CV model
- Native push notifications on iOS/Android
- Real MRMS data pipeline (currently fixtures)
- Vector tile service deployment (currently MapTiler basemaps)
- Stripe billing
- Custom domain on Vercel
- App Store + Play Store submission
