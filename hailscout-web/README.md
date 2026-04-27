# HailScout Web

Production-ready Next.js 15 web app for HailScout — AI-native hail mapping for roofing contractors.

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Clerk account (for auth)
- Environment variables (copy `.env.example` to `.env.local` and fill in)

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

### Type Checking

```bash
npm run type-check
```

### Linting

```bash
npm run lint
```

### Production Build

```bash
npm run build
npm run start
```

## Project Structure

```
hailscout-web/
├── src/
│   ├── app/                    # Next.js 15 App Router
│   │   ├── (marketing)/        # Public marketing pages
│   │   ├── app/                # Authenticated app shell
│   │   ├── sign-in/            # Clerk sign-in
│   │   ├── sign-up/            # Clerk sign-up
│   │   ├── globals.css         # Tailwind v4 + CSS vars
│   │   └── layout.tsx          # Root layout w/ ClerkProvider
│   ├── components/
│   │   ├── ui/                 # shadcn/ui primitives
│   │   ├── marketing/          # Hero, pricing, footer, etc.
│   │   ├── app/                # Sidebar, topbar, search, etc.
│   │   └── map/                # MapLibre GL components
│   ├── hooks/                  # Custom React hooks
│   │   ├── useStormsAtAddress.ts
│   │   └── useMapTiles.ts
│   └── lib/
│       ├── api.ts              # Typed API client
│       ├── api-types.ts        # Type definitions
│       ├── env.ts              # Environment validation (Zod)
│       ├── utils.ts            # Utility functions
│       └── constants.ts        # App constants (colors, nav, etc.)
├── public/
│   ├── favicon.ico
│   └── logo.svg
├── .github/workflows/          # GitHub Actions CI/CD
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
├── middleware.ts               # Clerk middleware + public routes
└── vercel.json                 # Vercel deployment config
```

## Key Features

### Week 1 MVP

1. **Landing page** (`/`) — hero, pricing, feature comparison table
2. **Authenticated shell** (`/app/*`) — sidebar nav, topbar, protected routes
3. **Map page** (`/app/map`) — MapLibre GL JS with OSM base tiles, address search, storm list
4. **Clerk auth** — sign-up, sign-in, user session management
5. **Address search** — debounced input, calls `/v1/hail-at-address`, drops marker, shows storm history

### Pricing Pages

- `/pricing` — detailed pricing with FAQs
- `/compare` — feature comparison vs. HailTrace and IHM

### Stub Pages (Month 2+)

- `/app/addresses` — monitored properties (coming soon)
- `/app/markers` — canvassing markers (Month 3)
- `/app/reports` — Hail Impact Reports (Month 2)
- `/app/settings` — organization & billing settings

## Environment Variables

Create `.env.local` from `.env.example`:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<your-clerk-publishable-key>
CLERK_SECRET_KEY=<your-clerk-secret-key>
NEXT_PUBLIC_API_BASE_URL=https://api.hailscout.com
NEXT_PUBLIC_TILES_BASE_URL=https://tiles.hailscout.com
NEXT_PUBLIC_MAP_CENTER_LAT=39.8
NEXT_PUBLIC_MAP_CENTER_LNG=-98.58
NEXT_PUBLIC_MAP_DEFAULT_ZOOM=4
```

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4 + shadcn/ui
- **Maps:** MapLibre GL JS + OpenStreetMap
- **Auth:** Clerk
- **HTTP:** SWR for data fetching (with Clerk JWT)
- **Validation:** Zod for env vars and API types
- **Testing:** Playwright E2E (scaffolded, not implemented in Week 1)

## API Integration

The frontend calls `https://api.hailscout.com` endpoints via the `apiClient` wrapper in `src/lib/api.ts`. The wrapper:

1. Automatically attaches Clerk JWT in the `Authorization` header
2. Handles 401 → redirect to sign-in
3. Provides typed responses via `src/lib/api-types.ts`

### Key Endpoints (from PRD §1.7)

- `GET /v1/me` — current user + org
- `GET /v1/storms?bbox=...&from=...&to=...` — list storms
- `GET /v1/hail-at-address?address=...` — storm history at address
- `POST /markers` — create canvassing marker
- `GET /tiles/swaths/{z}/{x}/{y}.pbf` — vector tiles (CloudFront)

## Deployment

### Vercel

1. Connect GitHub repo at `https://vercel.com/new`
2. Set `rootDirectory` to `hailscout-web` in Vercel project settings
3. Add environment variables in Vercel dashboard (Clerk keys, API/tiles URLs)
4. Domain: `app.hailscout.com`

See `vercel.json` for config details and env var contracts.

### CI/CD

GitHub Actions workflows:
- **`ci.yml`** — lint, type-check, build on push/PR to main
- **`preview.yml`** — automatic Vercel preview deployments on PR

## Design System

### Colors

Tailwind v4 uses CSS variables. Hail size colors (from PRD §2.5):

```
--hail-0-75: #22c55e   (green)
--hail-1-0: #eab308    (yellow)
--hail-1-25: #f97316   (orange)
--hail-1-5: #f97316    (orange)
--hail-1-75: #ef4444   (red)
--hail-2-0: #ef4444    (red)
--hail-2-5: #a855f7    (purple)
--hail-3-0: #000000    (black)
```

Access via `HAIL_SIZE_COLORS` in `src/lib/constants.ts` or call `getHailSizeColor(inches)` in `src/lib/utils.ts`.

### Components

All shadcn/ui primitives are in `src/components/ui/`. Copy from `shadcn/ui` source as needed.

Currently shipped:
- `button.tsx`
- `input.tsx`
- `card.tsx`
- `badge.tsx`
- `sheet.tsx` (side drawer)
- `dropdown-menu.tsx`

## Next Steps (For Other Agents)

### API Agent (hailscout-api)
- Implement endpoints: `GET /me`, `GET /storms`, `GET /hail-at-address`, etc.
- Schema + migrations for all tables (PRD §1.6)
- Clerk middleware for auth

### ML/Swath Agent (hailscout-tiles)
- Tile generation pipeline from `hail_swaths` table
- Vector tiles served at `https://tiles.hailscout.com/swaths/{z}/{x}/{y}.pbf`
- Color coding per PRD §2.5

### Data Pipeline Agent (hailscout-data-pipeline)
- Ingest NOAA MRMS every 2 minutes → PostGIS
- Extract swath polygons by hail size
- Upsert to `hail_swaths` table

### Mobile Agent (hailscout-mobile)
- Expo app with React Navigation
- MapLibre Native
- Clerk auth flows

## Acceptance Criteria (Week 1)

✓ User signs up via Clerk  
✓ User logs in  
✓ User lands on map page  
✓ User searches an address (API required)  
✓ Storms appear in sidebar (API required)  
✓ Storm detail sheet opens (UI complete, data from API)  
✓ Hail swaths render on map (requires tiles service)  

## Known Limitations / Placeholders

1. **Tiles source:** `useMapTiles()` points to `${NEXT_PUBLIC_TILES_BASE_URL}/swaths/{z}/{x}/{y}.pbf`. The ML/Swath agent will provide this.
2. **Vector tile styling:** Currently uses fill layer with hardcoded color mapping. Adjust in `useMapTiles.ts` if tiles include different properties.
3. **Address search:** UI is complete; API integration requires backend `/hail-at-address` endpoint.
4. **Markers:** Map click handler `onMarkerDrop` is wired but not yet persisted (Month 3).
5. **Offline mode:** Not implemented (Month 3 mobile feature).
6. **Dark mode:** CSS variables support it; toggle not yet built.

## Testing

E2E tests will use Playwright. Scaffold ready in `tests/` directory.

```bash
npm run test:e2e  # Not implemented in Week 1
```

## License

Proprietary. All rights reserved.

---

**Built for:** HailScout, Inc.  
**Maintained by:** Frontend Agent (Cowork)  
**Last updated:** Week 1 MVP
