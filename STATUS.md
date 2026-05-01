# HailScout — Session Handoff (2026-04-30, post Phases 9–14)

Latest commit: `6af1466`. Conference-ready build, top-to-bottom — now
includes CRM-lite, follow-up calendar, tabbed settings, customer case
study page, and 7-day hail outlook widget.

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

## Phase 12 — Atlas-grade collaboration

**12.1 Territory zones** `f6f5b49` — `territories` table with polygon JSON +
optional crew assignee. Map overlay layer with name labels, /app/territories
zone card grid with mini SVG previews, "Save as territory" inside the
sweep tool.

**12.2 Notes timeline on markers** `54d0219` — `marker_notes` table with
CASCADE delete, GET/POST `/v1/markers/{id}/notes`, chat-style thread UI
inside the marker editor. Field history that survives crew turnover.

**12.3 Crew dashboard** `24bfb77` — per-teammate metric cards, sorted by
contracts desc, "Top closer" chip on the leader, status-distribution
stacked bars per assignee.

**12.4 CSV import for markers** `2c29b5a` — bulk-import button on
`/app/markers`. Two formats supported: `address,status,notes` and
`lat,lng,status,notes`. Diff preview before commit.

**12.5 Multi-property impact report PDF** `e0d4f53` — portfolio-wide
storm impact report. Cover page with totals + index, then per-address
detail pages. Lazy-loaded react-pdf bundle.

**12.6 Public stat ticker** `36c182c` — anonymous `/v1/public/stats`
aggregate counts. Polls every 60s, falls back to fixture counts. Wired
into landing, pricing, compare, live, claim pages.

---

## Phase 13 — CRM-lite and operations

**13.1 Customer/contact records (CRM-lite)** `b25a0b4` + `f42e33a` —
`hs_contacts` table with name/email/phone/status/notes/follow_up_at,
optional FK to monitored address. Full CRUD at `/v1/customers`. On the
web: `useContacts` hook (SWR + Clerk), `ContactsPanel` inline editor,
expandable rows on `/app/addresses`, full `/app/customers` list page
with status filter chips, sidebar + Cmd-K palette wiring.

**13.2 Follow-up reminders** `6552f59` — `/app/calendar` page with
overdue / this-week / upcoming groups, sorted by date. "+1 week" snooze
and "Done" actions per row. `FollowUpsWidget` on the dashboard
surfaces the 6 most urgent. Sidebar nav + Cmd-K entry.

**13.3 Settings tab navigation** `9daddb5` — `/app/settings`
reorganized into 5 URL-driven tabs (Profile, Workspace, Integrations,
Notifications, Help). `?tab=` deep-linking, sticky left rail on
desktop, horizontal scroll on mobile.

---

## Phase 14 — Marketing polish for the conference

**14.1 Customer case study page** `e1616dd` — `/case-studies` index +
`/case-studies/[slug]` route. First story: Ridgeline Roofing OKC (3.2×
close rate, $840K Q2). Atlas-page editorial layout, stat band, pull
quote treatment, topographic motif card art. Shared `SiteHeader` +
`SiteFooter` with new "Customers" nav link. Linked from landing FAQ.

**14.2 7-day hail outlook widget** `6af1466` — marketing landing strip
showing forecast risk by region for the next week. 5 regions × 7 days
grid, NWS SPC-style risk levels (Quiet → Moderate), cream/teal/copper
legend. Wired into the landing page between ROI calculator and
testimonials. Reinforces "we see what's coming" positioning.

**14.3 STATUS.md refresh** — this document.

---

## Conference demo script

1. **Open landing** at `/`. Scroll past hero → Numbers → How it works →
   Product sections → ROI calculator. Pause on **7-day hail outlook**
   ("here's what's coming next week, by region"). Continue to
   testimonials, FAQ ("read the case study →"), final CTA.
2. **Click Customers** in nav → land on `/case-studies` → click into
   Ridgeline → walk the stat band ("3.2× close rate"), pull quote, the
   "shift" section.
3. **Sign in** → land on `/app`. Point at the dashboard:
   - Live storm pulse on the atlas
   - Activity feed (alerts + reports + markers)
   - **Follow-ups due** widget — "this is the morning page"
   - Marker pipeline strip
4. **Open /app/customers** — show status filter chips, click a contact
   row to expand the inline editor.
5. **Open /app/calendar** — overdue group with copper accent. Show "+1
   week" snooze.
6. **Open /app/addresses** — click a row, the Contacts panel expands
   inline. Add a contact in front of them.
7. **Open the map** at `/app/map`. Show the granular nested-band hail
   swaths. Drop a marker. Sweep-tool a polygon → "Save as territory".
   Open the territories page. Pull up the impact report PDF.
8. **Cmd-K** → "follow-up calendar" → land on calendar. Cmd-K →
   "Slack" → settings opens on Integrations tab.
9. **Phone**: open the Expo app, show the same map + alerts on mobile.

---

## Open tabs cheat sheet

- https://hail-scout.vercel.app — landing
- https://hail-scout.vercel.app/case-studies/ridgeline-roofing — story
- https://hail-scout.vercel.app/app — dashboard (need login)
- https://hail-scout.vercel.app/app/customers — CRM
- https://hail-scout.vercel.app/app/calendar — follow-ups
- https://hail-scout.vercel.app/app/map — atlas
- https://hail-scout.vercel.app/app/settings?tab=integrations — Slack
- https://github.com/kirkd84/Hail-Scout — repo (for the dev crowd)

---

## Backlog (post-conference)

- Email digest (needs SMTP)
- More CRM integrations (AccuLynx, JobNimbus, ServiceTitan)
- Real photo-damage CV model
- Native push notifications on iOS/Android
- Real MRMS data pipeline (currently fixtures)
- Vector tile service deployment (currently MapTiler basemaps)
- Stripe billing
- Custom domain on Vercel
- App Store + Play Store submission
- More case studies (need 2-3 to look like a real customer base)
- Email sequences for inbound trial users
