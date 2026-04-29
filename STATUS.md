# HailScout — Session Handoff (2026-04-29)

What shipped during the autonomous design + build session, what's still
queued, and the exact state of every surface.

---

## Live state

| Surface | Status | URL |
|---|---|---|
| GitHub repo (monorepo) | ✓ pushed (commit `e4e1716`) | https://github.com/kirkd84/Hail-Scout |
| Railway API | ✓ deployed | https://hail-scout-production.up.railway.app |
| Postgres + PostGIS | ✓ healthy | postgis/postgis:16-3.4 |
| Vercel web | ✓ deployed | https://hail-scout.vercel.app |
| Clerk auth | ✓ wired (test instance) | dashboard.clerk.com |
| Clerk webhook | ✓ verified, reconciles seeded users | `/v1/webhooks/clerk` |
| MapTiler | ⚠ key configured, **needs adding to Vercel env** | `NEXT_PUBLIC_MAPTILER_KEY` |
| Mobile (EAS) | ✗ not built | — |
| Data pipeline | ✗ not deployed | — |
| Tile service | ✗ not deployed | — |

---

## What's new in the web app

### Brand: Topographic
Cream + deep teal + copper. Field-guide / cartographer aesthetic. National
Geographic meets Mapbox Studio. Locked 2026-04-28 after picking from three
mocks (Storm Watch / Aurora / Topographic).

Color tokens in `globals.css`. Brand scales (`cream`, `teal`, `copper`,
`forest`) in `tailwind.config.ts`. Typography: Inter (UI) + Fraunces (display
serif) + JetBrains Mono (numbers, coordinates).

### Marketing site (`/`, `/pricing`, `/compare`)
Apple-grade craft. Sticky header with the new contour-radar wordmark.
Editorial hero ("Every hailstorm, on one atlas") with an animated SVG atlas
plate beside it. Trust stats. Three-step "How it works." Alternating product
rows. Pull-quote testimonial. Copper-on-teal final CTA. Atlas footer.

Pricing redesigned with three tiers + FAQ in display serif. Compare page
has a 4-column comparison grid with copper-tinted HailScout column and an
honest take on competitors.

### App shell
- **Sidebar** (`Sidebar`): cream paper, contour decoration at top, copper
  active dot, dedicated super-admin section in copper, settings footer.
- **Topbar** (`Topbar`): minimal, glass, page title in display serif,
  Cmd-K hint pill (palette wired next pass).
- **Layout**: `overflow-hidden` on main so the map fills viewport.
- **Sign-in / sign-up**: ContourBg + Wordmark hero, Clerk forms themed.

### Map page (`/app/map`)
- **HailMap**: MapTiler vector tiles, 4 styles (Atlas / Streets / Satellite
  / Hybrid), hot-swap on theme + style change. Carto fallback when key is
  unset.
- **BasemapToggle**: glass-morphism segmented control bottom-center, copper
  highlight on active.
- **AddressSearch**: glass-morphism floating pill at top-center. Cmd-K
  focuses. Inline loading/error/result hint.
- **SwathLegend**: collapsible glass pill (default: 5 color dots → click
  expands to full legend).
- **StormFixturesLayer**: 10 hardcoded realistic storms across the US hail
  belt, rendered as data-driven `step` color polygons + copper centroid dots.
- **StormList** (in side sheet): atlas-card list with hail-color size badge.
- **StormDetailSheet**: hero hail-size dial (topographic ring riff) +
  display-serif date + term/definition meta rows.

### Inner pages
- `/app/addresses`, `/app/markers`, `/app/reports`: contour-decorated
  EmptyState components with feature-specific copy and map CTAs.
- `/app/settings`: profile card + workspace EmptyState.

### Super-admin (`/super-admin/*`)
- Layout: copper top bar with Wordmark + "Super" pill, sidebar nav.
- `/orgs`: editorial header, atlas-table grid, inline copper-bordered
  create-tenant form, plan-tier tone pills.
- `/users`: themed grant/revoke radio cards (copper for grant, destructive
  for revoke).
- `/usage`: split-pane atlas list + Stat tiles.

### Dark mode
System-aware via `next-themes` (`defaultTheme="system"`). Light mode adopts
the cream paper aesthetic; dark mode uses warm charcoal `#1A1814` with
lighter teal `#5BA8BC` as primary. Map basemap hot-swaps on theme toggle.

---

## Storm fixtures (demo data)

`src/lib/storm-fixtures.ts` exports 10 storms across the US hail belt:
DFW · OKC · Wichita · Denver · Omaha · KC · Lubbock · STL · Indy · Amarillo.
Each has an oriented lozenge swath polygon, max hail size in 1.0–3.5″, and
a date in the past 30 days.

`useStormsAtAddress` hook tries the API first; on failure (401, 404, network)
it falls back to client-side geocode (MapTiler if key is set; fixture city
fallback otherwise) + point-in-polygon hit-test. So the demo flow works
**before the data pipeline is deployed**.

Try it: visit `/app/map`, search "Dallas TX" → sheet shows storm history,
map flies to the storm centroid, swaths are visible.

---

## ⚠ One thing for Kirk to do

Add the MapTiler key to Vercel:

1. https://vercel.com → `hailscout-web` → Settings → Environments → Production
2. Edit env vars → add:
   ```
   NEXT_PUBLIC_MAPTILER_KEY=dXpxElwSr8RaGE7PdgFl
   ```
3. Mirror to Preview + Development if you want PR previews to work
4. Redeploy without build cache

Until you do this, the map falls back to Carto rasters (still works,
just lower quality on dark mode and no Streets/Satellite/Hybrid layers).

---

## Backlog (next session priorities)

1. **Real Cmd-K command palette** (cmdk lib) — search across pages, addresses,
   storms, super-admin actions. Topbar already has the trigger.
2. **Address autocomplete dropdown** — call MapTiler geocoder on each
   keystroke, render suggestions below the search pill.
3. **Marker drop persistence** — wire up the click-to-drop pin → save
   to API → render as a permanent marker layer.
4. **Hail Impact Report PDF generation** — first version probably uses
   `@react-pdf/renderer` for client-side generation, server-side template
   later when the data pipeline is online.
5. **Mobile bottom-sheet pattern** for the storm list on small screens
   (right now it's a side sheet on mobile too, which is cramped).
6. **Data pipeline deployment** — connect to MRMS, ingest swaths, populate
   real DB, retire fixture fallback.
7. **Tile service deployment** — vector PBF tiles for live swath rendering
   on the map (replaces the static GeoJSON fixture layer).
8. **Mobile app** (Expo) — start from the same design system tokens.

---

## Useful files for next-session context

- `src/lib/storm-fixtures.ts` — demo data (replace when pipeline ships)
- `src/lib/hail.ts` — hail-size color palette (the topographic version,
  kept distinct from the legacy `HAIL_SIZE_COLORS` in `constants.ts`)
- `src/components/brand/atlas-map-preview.tsx` — the SVG hero plate (no
  MapLibre, all hand-drawn)
- `src/components/brand/contour-bg.tsx` — decorative topo-line background
- `src/components/icons/index.tsx` — 16 inline SVG icons in the
  topographic stroke language

The latest commit on `main` is `e4e1716`. Vercel auto-deploys on push.
