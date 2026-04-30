# HailScout — Session Handoff (2026-04-29, post Phase 7)

What shipped during the autonomous design + Phase 2 build, what's queued.
Latest commit: `5d22e95` (dashboard + bulk import + leads CSV + toasts). Phase 7 complete.

---

## Live state

| Surface | Status | URL |
|---|---|---|
| GitHub repo | ✓ pushed | https://github.com/kirkd84/Hail-Scout |
| Railway API | ⚠ Image Registry (Metal) outage during build | https://hail-scout-production.up.railway.app |
| Vercel web | ✓ deploys on push | https://hail-scout.vercel.app |
| Postgres + PostGIS | ✓ healthy | (Railway managed) |
| Clerk auth + webhook | ✓ wired, reconciles | dashboard.clerk.com |
| MapTiler | ✓ key in Vercel env | `NEXT_PUBLIC_MAPTILER_KEY` set |
| Mobile (EAS) | ✗ not built | — |
| Data pipeline | ✗ not deployed | — |
| Tile service | ✗ not deployed | — |

---

## Phase 1 — Design system (already shipped)

- **Topographic brand**: cream + deep teal + copper (locked 2026-04-28)
- Marketing landing, pricing, compare — all rewritten Apple-grade
- App shell (sidebar + topbar + layout)
- Map page polish (glass panels, redesigned storm list + detail sheet)
- Sign-in / sign-up themed via Clerk appearance prop
- Super-admin pages restyled
- Empty states for inner-app surfaces
- Favicon + Apple touch + 1200×630 OG share image
- System-aware dark mode via `next-themes`
- Carto Voyager + Carto Dark Matter basemap
- 10 hardcoded storm fixtures across the US hail belt

## Phase 1.5 — Industry-aligned data layer (already shipped)

- Industry-standard hail palette (HailTrace / IHM / NWS):
  green pea → lime penny → yellow quarter → orange half-dollar/walnut →
  red golf-ball → dark-red hen-egg → magenta tennis → purple baseball →
  deep-purple softball
- Reference object names everywhere (storm cards show "1.75″ Golf ball")
- **Granular nested-band swaths** — each storm renders 5–8 concentric polygons
  showing the gradient from outer (light) to inner (peak hail core)
- 12-point oriented lozenges with deterministic edge noise read like real
  radar data
- Multi-core storms (Amarillo 3.5″) render multiple hot cores within outer
  track footprint
- `fixturesAtPoint` returns the *largest band threshold* the point falls in,
  i.e. what hail diameter actually fell at that address

## Phase 1.75 — MapTiler integration (already shipped)

- 4 basemap layers (Atlas / Streets / Satellite / Hybrid) with hot-swap
- Glass-morphism BasemapToggle bottom-center
- Falls back to Carto rasters when MAPTILER_KEY is unset

---

## Phase 2 (previous session)

### 2.1 Address autocomplete ✓ `4c81649`
- MapTiler geocoder with US country lock + autocomplete=true
- Debounced (180ms) suggestion fetch, max 5 results
- Glass dropdown anchored to the search pill
- ArrowUp/Down/Enter keyboard nav, click-to-select flies map immediately
- Fixture-city fallback when no key/network

### 2.2 Map filter pills ✓ `4c81649`
- Glass pill top-left, copper-bordered when filters active
- Date range: 24h · 7d · 30d · all
- Min hail size: any · ≥1.0″ · ≥1.75″ · ≥2.5″
- Size filter via setFilter on layers (no source mutation)
- Date filter via setData (storms outside window drop entirely)
- Reset link when filters active

### 2.3 Marker drop with localStorage ✓ `191e855`
- 6-status canvassing model (lead/knocked/no_answer/appt/contract/not_interested)
- localStorage-backed CRUD store with cross-tab storage event
- `useMarkers` hook (reactive)
- MarkersLayer renders status-encoded colored dots + halos on the map
- DropModeToggle pill bottom-right (copper-fill when active)
- Crosshair cursor on the map when in drop mode
- MarkerEditor side sheet: status hero, picker grid, notes textarea, save/delete
- `/app/markers` rebuilt as a real list page: status-breakdown KPIs,
  sortable table, delete row, clear-all confirmation

### 2.4 Hail Impact Report PDF ✓ `a42acf9`
- `@react-pdf/renderer ^4.1.5` added
- `HailImpactReport` component: full LETTER-sized branded PDF
- Brand wordmark + radar mark in header, display-style title
- Hero card with hail-size dial (matches in-app detail sheet)
- 6-cell meta grid (start/end/duration/source/centroid/bounds)
- Narrative section, numbered next steps, legal disclaimer block
- Footer with Report ID + brand line
- `DownloadReportButton` — lazy-loads renderer, generates Blob, triggers
  download with clean filename like
  `HailScout-Impact-Report-2026-04-26-amarillo-tx.pdf`
- Wired into the storm detail sheet
- `/app/reports` rebuilt with "How it works" 3-step instruction panel

- `cmdk ^1.1.1` added
- Glass modal at 12vh from top, backdrop blur
- Sections: Pages · Recent storms · Super-admin (when is_super_admin) ·
  Theme · Account
- Storm rows fly the map to that centroid via sessionStorage handoff
- Wired to topbar's Search button + global Cmd-K listener
- Skips its own binding when the address search input has focus

---

## Phase 3 (this session)

### 3.1 Map snapshot embedded in PDF ✓ `5797c95`
- HailMap: enabled `preserveDrawingBuffer` for canvas capture
- lib/map-snapshot.ts: `captureMapSnapshot(map, {bounds, padding, duration})`
  flies, awaits idle (4s timeout fallback), one extra rAF for GPU flush,
  returns a PNG dataURL
- DownloadReportButton flies to storm bbox + 0.05° padding before capture,
  shows two-stage loading ('Capturing…' then 'Generating…')
- HailImpactReport renders a 220pt-tall banded swath image inside a cream
  card with mono caption above the hero. Real visual proof in the PDF.

### 3.2 Monitored addresses ✓ `67535b2`
- lib/saved-addresses.ts + useSavedAddresses hook (mirrors marker pattern)
- 50m near-dedup on save, cross-tab storage sync
- SaveAddressButton ('Monitor' / 'Monitoring') in the search-results sheet
- /app/addresses rewritten: KPI cards (total / hit-in-30d / >=1.75″ hits),
  sortable table with industry-palette hail badge, click row to deep-link
  back to /app/map?address=...
- Map page deep-link reader: ?address=... triggers the search flow on mount

### 3.3 Mobile bottom-sheet pattern ✓ `74edaa8`
- hooks/useIsMobile.ts (SSR-safe matchMedia, 640px breakpoint)
- StormDetailSheet, MarkerEditor, search-results sheet now use
  side='bottom' on small screens (max-h 88vh, rounded-t-2xl, scrolls)
- Right-side behaviour preserved on >=sm



### 3.4 First-run welcome tour ✓ `3f3b247`
- 4-step glass modal with copper-bordered icon ring per step
  (search · basemap · drop-pin · cmd-K)
- Topographic contour decoration up top with a copper storm-trail accent
- Step dots, Skip + Next/Finish controls
- Persists 'seen' flag in localStorage; never re-appears
- Settings page: 'Take the welcome tour again' card resets the flag

---

## Phase 4 (this session)

### 4.1 Live storms with pulse animation ✓ `0de7b29`
- 4 live storm specs computed at module load (Wichita Falls, Dodge City,
  Tulsa, Greenville) with timestamps inside the last 2 hours
- StormFixture.is_live boolean flag, propagated through GeoJSON
- LIVE_PULSE map layer filtered by is_live === true with copper fill
- requestAnimationFrame loop drives radius (8→30) + opacity (0.55→0)
  at 1.5 Hz with ease-out for a clean radar-pulse breath

### 4.2 Storm activity feed widget ✓ `0de7b29`
- Bottom-left glass pill, copper-bordered when storms are live, with a
  Tailwind animate-ping dot in the collapsed state
- Expanded panel: 'Live now' group (copper eyebrow + bolt icon) +
  'Earlier today' / 'Recent storms' below
- Each row: hail-size badge in industry palette, city, time-ago
- Click row flies the map to the storm's centroid
- 30-second timer keeps time-ago labels fresh
- New lib/time-ago.ts compact relative-time formatter

### 4.3 ROI calculator on marketing landing ✓ `e19b09a`
- New section between product rows and testimonial
- 3 sliders: crew size (1-25), avg ticket ($5k-$50k), close-rate lift (5-35%)
- Conservative defaults (6% baseline close, 25 incremental doors/rep/mo)
- Live outputs: projected annual revenue in display teal, ROI multiple
  in copper, payback time, narrative breakdown
- Copper-bordered methodology disclaimer keeps the math transparent



### 4.4 Photo damage AI triage demo ✓ `e19b09a`
- New /app/photo-ai page with drag-drop or click-to-upload
- 1.8s 'Analyzing…' state with pulsing copper dot
- Deterministic-ish hash of filename+size yields the same result on
  re-upload (repeatable demos)
- Result panel: severity-tinted hero (Low/Moderate/Severe/Total Loss),
  3 KPI tiles, estimated replacement cost, copper strike-marker overlays
  on the photo
- Privacy note: photos processed entirely in the browser
- Sidebar + command palette + topbar nav all updated

---

## Phase 5 (this session) — Real persistence

### 5.1 Migration + models for markers + addresses ✓ `63d0939`

Migration 003 simplifies the existing canvass schema so the API can
actually write rows without the parcel/storm ingest pipelines being live.

- monitored_addresses: parcel_id/label/threshold -> nullable; add
  lat/lng/address/last_storm_at/last_storm_size_in/user_id columns;
  indexes on user_id and (lat, lng)
- markers: storm_id/parcel_id/geom_point -> nullable; add lat/lng/client_id;
  indexes on client_id and (lat, lng). client_id supports idempotent
  upsert from the localStorage->API migration path.
- SQLAlchemy models in db/models/canvass.py rewritten to match.

### 5.2 Implement /v1/markers + /v1/monitored-addresses routes ✓ `63d0939`

Replaced the 501 stubs with auth-scoped CRUD.

Routes now live (markers + monitored-addresses):
- `GET /v1/markers` · `POST /v1/markers` · `PATCH /v1/markers/{id}` · `DELETE /v1/markers/{id}`
- `POST /v1/markers/bulk` (idempotent via client_id collision check)
- `GET /v1/monitored-addresses` · `POST` · `PATCH` · `DELETE`
- `POST /v1/monitored-addresses/bulk` (~50m near-dedup on insert)
- `GET /v1/alerts` returns `[]` (Phase 5.5 wires the generator)

Every request resolves the local User row via `clerk_user_id` (the
JWT `sub`), enforces `org_id` scoping on read/write/delete, and 404s
on cross-tenant access attempts.

### 5.3 Web hooks sync to API when signed in ✓ `9571a2a`

- `useMarkers` and `useSavedAddresses` rewritten with a dual-mode
  surface: SWR-cached fetch when signed in, localStorage when not
- async add/update/remove (was sync). Map page + save-address-button
  updated to await
- One-time migration of existing localStorage rows on first sign-in
  via `/markers/bulk` and `/monitored-addresses/bulk`. Persists a
  `hs.{markers,addresses}.migrated.v1` flag so it never re-runs.
  Falls back gracefully if the API call fails (retries on next mount).

What this means for the demo:
- Anonymous users still get a working app via localStorage
- Signed-in users see their data on every device
- No data loss when an anonymous user signs up (migration kicks in)

---

## Phase 4 (previous session)## Phase 2 (previous session)
- `cmdk ^1.1.1` added
- Glass modal at 12vh from top, backdrop blur
- Sections: Pages · Recent storms · Super-admin (when is_super_admin) ·
  Theme · Account
- Storm rows fly the map to that centroid via sessionStorage handoff
- Wired to topbar's Search button + global Cmd-K listener
- Skips its own binding when the address search input has focus

---

## ⚠ Note on Railway

You mentioned a Railway "Image Registry (Metal)" investigating outage. That
might surface as a queued or failed deploy on the API side. The web app is
on Vercel and is unaffected — every Phase 2 commit deployed cleanly.

API is still on the previous `e399e2a` build (Clerk webhook + /v1/me 401
fix). When Railway is healthy, no action needed — the latest commit on
main contains no API changes.

---

## Backlog (post-Phase-2)

1. **Mobile bottom-sheet pattern** for storm list + storm detail on small
   screens — currently uses a side sheet which feels cramped on mobile
2. **Map snapshot in PDF** — use html2canvas on the live map and embed as
   `<Image>` in the report, showing the actual storm swath on a basemap
3. **Saved Reports library** — sync to backend, re-download from history,
   custom contractor branding (logo, colors)
4. **Marker → API persistence** — swap localStorage for `/v1/markers`
   when the endpoint ships
5. **Real-time storm alerts** — push notifications when a hail event
   touches a monitored address
6. **Mobile app (Expo)** — ship from the same design tokens
7. **Data pipeline + tile service** — replace fixture data with live MRMS

---

## Useful files for next-session context

**Brand / design:**
- `src/components/brand/{wordmark,contour-bg,atlas-map-preview}.tsx`
- `src/app/globals.css` — Topographic tokens, glass utility, atlas rule, contour bg
- `tailwind.config.ts` — brand color scales

**Data:**
- `src/lib/hail.ts` — industry-standard hail palette + reference object names
- `src/lib/storm-fixtures.ts` — 10 nested-band storms across US hail belt
- `src/lib/markers.ts` — canvassing model + localStorage store
- `src/lib/geocode.ts` — MapTiler geocoder with fixture fallback

**Map:**
- `src/components/map/HailMap.tsx` — MapTiler vector tiles, theme + basemap swap
- `src/components/map/storm-fixtures-layer.tsx` — band rendering with filter support
- `src/components/map/markers-layer.tsx`
- `src/components/map/{basemap-toggle,map-filters,swath-legend,drop-mode-toggle}.tsx`

**App:**
- `src/components/app/{sidebar,topbar,command-palette,address-search,marker-editor,storm-list,storm-detail-sheet,empty-state}.tsx`
- `src/components/reports/{hail-impact-report,download-report-button}.tsx`
