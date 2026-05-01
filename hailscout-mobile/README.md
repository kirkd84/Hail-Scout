# HailScout Mobile

The HailScout iOS + Android app — Topographic-themed companion to the
desktop atlas. Built with Expo, React Native, MapLibre, and Clerk.

## Status

Phase 9.1 ships a real branded shell:

- **Home** — dashboard with KPI tiles + live & recent storms
- **Atlas** — MapLibre map with Carto Voyager (light) / Dark Matter (dark)
  basemap, user-location FAB, hail-size legend
- **Alerts** — live `/v1/alerts` polling, mark-as-read, pull-to-refresh
- **Addresses** — synced watchlist from `/v1/monitored-addresses`
- **Settings** — account info, sign-out, link to desktop

Data syncs across devices because both clients hit the same Railway API.

## Run locally

```
cd hailscout-mobile
npm install
EXPO_PUBLIC_API_BASE_URL="https://hail-scout-production.up.railway.app" \
  npx expo start
```

Press `i` for iOS simulator, `a` for Android. Real devices: scan the QR
with the Expo Go app.

## Stack

- **Framework:** Expo SDK 52
- **Auth:** `@clerk/clerk-expo` (token cached in expo-secure-store)
- **Maps:** `@maplibre/maplibre-react-native`
- **Navigation:** React Navigation (stack + bottom tabs)
- **API:** plain fetch via `src/lib/api.ts`, JWT injected from Clerk
- **Design tokens:** `src/lib/tokens.ts` mirrors the web Topographic palette

## Environment

`EXPO_PUBLIC_API_BASE_URL` overrides the Railway URL.
`EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` is read by `src/app/env.ts`.

## What's not yet shipped

- Native push notifications (will plug into the SSE alerts stream)
- Full offline mode (markers cache locally, sync on reconnect)
- EAS Build profile + App Store submission

## Conventions

- Brand colors live in `lib/tokens.ts`. Don't hardcode hex elsewhere.
- Hail size colors come from `lib/hail.ts` — industry-standard palette
  matching the web app pixel-for-pixel so customers recognize them.
- All API calls go through `lib/api.ts` so token injection + base URL
  resolution stays consistent.
