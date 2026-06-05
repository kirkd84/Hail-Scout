# HailScout Mobile — Auth & Run Setup

The mobile app was migrated **off Clerk** onto the same first-party auth as the
web/API: native Google/Microsoft sign-in → provider `id_token` →
`POST /v1/auth/exchange` → our own access + refresh tokens (kept in the device
keychain via `expo-secure-store`). No Clerk, no per-MAU fee.

## 1. Install (deps changed)
```bash
cd hailscout-mobile
npm install
npx expo install --fix      # reconcile native module versions to the SDK
```
> Removed: `@clerk/clerk-expo`, `@clerk/clerk-react-native`.
> Added: `expo-auth-session`, `expo-web-browser`, `expo-crypto`.
> Also fixed `package.json` `main` → `index.tsx` (it was `expo-router/entry`,
> but this app uses React Navigation via `registerRootComponent`).

This app needs a **dev build** (MapLibre + SecureStore are native) — it won't
run in Expo Go:
```bash
npx expo prebuild
npx expo run:android        # or: eas build --profile development
```

## 2. OAuth client IDs (env — all EXPO_PUBLIC_*)
Create a `.env` (see `.env.example`) or set in EAS:
```
EXPO_PUBLIC_API_BASE_URL=https://hail-scout-production.up.railway.app
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=...apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=...apps.googleusercontent.com
EXPO_PUBLIC_MICROSOFT_CLIENT_ID=<azure app client id>
EXPO_PUBLIC_MICROSOFT_TENANT=common
```

**Google Cloud** → create **iOS** and **Android** OAuth client IDs (separate
from the web one):
- iOS client: bundle ID `net.hailscout.app`.
- Android client: package `net.hailscout.app` + your signing SHA-1
  (`eas credentials` shows it).

**Azure** → on the *same* app registration as web, add a **Mobile & desktop**
platform with redirect URI `hailscout://auth` (the app scheme). Microsoft keeps
the same client ID across web + mobile, so its `aud` already matches the API.

## 3. API change required (already in code, just set the env var)
Google issues a **different** `aud` per platform, so the API must accept the
mobile client IDs. On the **Hail-Scout API** (Railway) set:
```
GOOGLE_OAUTH_AUDIENCES=["<ios client id>","<android client id>"]
```
(The web `GOOGLE_OAUTH_CLIENT_ID` stays as-is; these are *additional* accepted
audiences. Microsoft needs nothing extra — same client ID.)

Native apps aren't CORS-gated, so no CORS change is needed for mobile.

## 4. Build & submit (iOS from Windows via EAS cloud)
```bash
eas login
eas init                       # writes the EAS projectId
eas build --platform android --profile production
eas build --platform ios --profile production     # cloud Mac — no local Mac needed
eas submit --platform android --latest
eas submit --platform ios --latest
```
Requires an **Apple Developer** account ($99/yr) + **Google Play** account
($25) — store listings, signing, and review are done in their consoles.

## Status
✅ Auth migrated to Google/Microsoft → `/v1/auth/exchange` (AuthProvider +
SecureStore session + native OAuth sign-in). Existing screens (Home, Map,
Addresses, Alerts, Settings) repointed off Clerk.
⏳ Remaining for full web parity (tracked as Mobile M4–M9): richer map swaths,
storm detail, monitored-address CRUD, push (Expo push tokens), canvassing
markers, draw-area lead lists, territories, on-device claim-report PDF.
