# HailScout Mobile App

Real-time hail mapping platform for storm restoration contractors, built with React Native + Expo.

## Overview

HailScout mobile app allows roofing contractors to:
- View real-time and historical hail swaths on a map
- Pinpoint damaged properties using geolocation
- (Coming Month 3) Monitor addresses and canvass door-to-door
- (Coming Month 2) Generate branded Hail Impact Reports

**Current Status:** Week 1 scaffold — auth wired, map placeholder, ready for Month 3 heavy build.

---

## Architecture

### Tech Stack

- **Framework:** React Native via Expo SDK 52+
- **Navigation:** React Navigation (bottom tabs)
- **Auth:** Clerk Expo SDK
- **Maps:** MapLibre GL Native
- **Location:** expo-location
- **Storage:** expo-secure-store (encrypted token cache)
- **Build:** EAS Build (iOS & Android)
- **TypeScript:** Strict mode, no `any`

### Project Structure

```
src/
├── app/
│   ├── App.tsx              # Root component, ClerkProvider setup
│   └── env.ts               # Zod-validated environment config
├── auth/
│   ├── ClerkProvider.tsx    # Token cache implementation
│   ├── SignInScreen.tsx
│   └── SignUpScreen.tsx
├── navigation/
│   ├── RootNavigator.tsx    # Auth gate (isSignedIn ? MainTabs : AuthStack)
│   ├── MainTabs.tsx         # Bottom tab navigation
│   └── types.ts             # Navigation type definitions
├── screens/
│   ├── MapScreen.tsx        # MapLibre GL wrapper, user location, legend
│   ├── AddressesScreen.tsx  # Stub (Month 3)
│   └── SettingsScreen.tsx   # Org info, sign out
├── components/
│   ├── HailMap.tsx          # MapLibre Native wrapper
│   ├── LocationButton.tsx   # Recenter on user button
│   └── ColorLegend.tsx      # Hail size color legend
├── lib/
│   ├── api.ts               # Typed API client (fetch wrapper)
│   ├── api-types.ts         # Pydantic schema mirrors
│   └── constants.ts         # Colors, default region, tile URLs
└── hooks/
    ├── useAuthToken.ts      # Clerk JWT retrieval + refresh
    └── useUserLocation.ts   # Location permissions + tracking
```

---

## Getting Started

### Prerequisites

- Node.js 18+ (using `npm` or `yarn`)
- Expo CLI: `npm install -g expo-cli`
- EAS CLI: `npm install -g eas-cli`
- Xcode 14+ (for iOS builds)
- Android Studio or Android SDK (for Android builds)
- Clerk account (https://clerk.com) — sign up free

### Local Development

#### 1. Clone & install

```bash
cd hailscout-mobile
npm install
```

#### 2. Configure environment

Copy `.env.example` to `.env` and fill in:

```bash
cp .env.example .env
```

Edit `.env`:

```env
CLERK_PUBLISHABLE_KEY=<your-clerk-publishable-key>
API_BASE_URL=https://api.hailscout.com/v1
TILES_BASE_URL=https://tiles.hailscout.com
```

Get your Clerk publishable key from https://dashboard.clerk.com → API Keys.

#### 3. Start the dev server

```bash
npm start
```

This will print a QR code. Scan with:
- **iOS:** Camera app → opens link → Expo Go app
- **Android:** Expo Go app → scan QR code

#### 4. Test sign-in

- Create a test user at https://dashboard.clerk.com → Users
- Or use the Clerk-embedded sign-up screen in the app

---

## Building for Devices

### iOS (via TestFlight Internal)

#### First time

```bash
eas build:configure
# Choose iOS, follow prompts
```

#### Build

```bash
eas build --platform ios --profile preview --wait
```

#### Submit to TestFlight

See `scripts/README.md` for detailed instructions. Quick version:

```bash
# Create app in App Store Connect first (https://appstoreconnect.apple.com)
# Update eas.json with the ASC App ID
eas submit --platform ios --latest
```

**Timeline:** Apple review = 24-48 hours. Start now to beat the clock.

### Android (via Play Console Internal)

#### First time

```bash
eas build:configure
# Choose Android, let EAS generate keystore
```

#### Build

```bash
eas build --platform android --profile preview --wait
```

#### Submit to Play Internal

```bash
# Create app in Play Console first (https://play.google.com/console)
eas submit --platform android --latest --track internal
```

**Timeline:** Google review = 1-3 hours (usually).

---

## Key Features (Week 1)

### Authentication

- **Clerk Expo SDK:** Email/password sign-in and sign-up
- **Secure token storage:** `expo-secure-store` encrypts JWT on device
- **Auth gate:** RootNavigator checks `useAuth().isSignedIn` and routes to auth stack or main app
- **Session management:** Clerk handles token refresh; SecureStore caches for offline reads

### Map

- **MapLibre GL Native:** Industry-standard open-source map rendering
- **OpenStreetMap basemap:** Free, globally available
- **User location:** Blue dot follows GPS (with `whenInUse` permission)
- **Recenter button:** Float button to zoom to user location
- **Color legend:** Industry-standard swath colors (green 0.75", yellow 1.0", orange 1.25-1.5", etc.)

### Environment Validation

- **Zod schema:** `src/app/env.ts` validates required env vars on startup
- **Type-safe:** `env.CLERK_PUBLISHABLE_KEY` is a typed string, never undefined
- **Error messages:** Helpful errors if config is missing

### TypeScript Strict

- **No `any`:** All function params and returns are typed
- **Navigation types:** RootStackParamList, MainTabsParamList prevent runtime errors
- **API types:** Mirrors Pydantic schemas from FastAPI backend

---

## Month 3 Build (Deferred)

The following are intentionally NOT implemented yet:

### Canvassing Flows
- Address monitoring (CRUD)
- Marker placement and status tracking (lead → knocked → appt → contract)
- Bulk export for offline ops
- Photo upload & damage triage

### Push Notifications
- Storm alerts ("hail detected in your monitored area")
- User preferences (quiet hours, alert threshold)

### Offline Sync
- Last 7 days of storms cached for field use without signal
- Marker and export sync when connection restores
- This is a key risk mitigation (PRD §5) — add in Month 3 once core features are stable

### UI Polish
- Address search bar
- Storm detail drill-down
- Historical storm replay

### Integration
- Cole contact enrichment
- Regrid parcel hydration
- Report generation

---

## API Client

Thin fetch wrapper in `src/lib/api.ts`:

```typescript
// Example usage in a screen
import { useAuthToken } from "@/hooks/useAuthToken";
import { getMe, listStorms } from "@/lib/api";

export function MyScreen() {
  const { token } = useAuthToken();
  const [me, setMe] = useState(null);

  useEffect(() => {
    (async () => {
      const authToken = await token();
      if (authToken) {
        const meData = await getMe(authToken);
        setMe(meData);
      }
    })();
  }, [token]);

  // ...
}
```

All API types are in `src/lib/api-types.ts` — mirrors Pydantic schemas from hailscout-api.

---

## CI/CD

### GitHub Actions

- **ci.yml:** Type-check + lint on every PR/push to `main`, `develop`
  - Triggers on changes to `hailscout-mobile/**`
  - Validates `app.json` and `eas.json` are valid JSON

- **eas-build.yml:** Manual workflow to build + submit via EAS
  - Trigger with: `gh workflow run eas-build.yml -f platform=ios -f profile=preview`
  - Or use GitHub UI: Actions → EAS Build → Run workflow

---

## Key Decisions

### 1. Expo SDK 52+ with new architecture

**Why:** Fabric/TurboModules make native module integration smoother. MapLibre Native requires the new arch flag.

**Config:** Set `"newArchEnabled": true` in `app.json`.

### 2. MapLibre Native over React Native Map View

**Why:** MapLibre is open-source, maintained by contributors from the geospatial community, and used by IHM/HailTrace-like competitors. No proprietary lock-in.

**Gotchas:**
- Requires `expo-build-properties` plugin to set iOS deploymentTarget ≥ 14
- Requires Android compileSdk ≥ 34 (handled in `app.json` plugins)
- Vector tiles come from `TILES_BASE_URL` — wired in Month 3

### 3. Clerk Expo SDK with SecureStore token cache

**Why:** Clerk handles multi-org support (seats, roles) natively. SecureStore is the official recipe for Expo.

**Gotcha:** If your org needs background location tracking (Month 3+), you'll need to request `always` permission on iOS — update Info.plist accordingly.

### 4. Bottom tabs instead of drawer

**Why:** Mobile UX convention. Map + Addresses + Settings are co-equal, not hierarchical. Easy to add more tabs later.

### 5. EAS Build + Submit instead of local builds

**Why:** Eliminates Xcode/Android Studio complexity on CI. Cloud builds also ensure reproducibility.

**Gotcha:** First build takes 15-30 min. Subsequent builds cache dependencies, so ~5-10 min.

---

## Testing on Real Devices

### iOS (via TestFlight)

1. Submit to TestFlight Internal (see `scripts/README.md`)
2. Wait 24-48h for Apple review
3. In App Store Connect, add internal testers (emails)
4. Testers get email invite → download TestFlight app → install
5. Testers can report crashes via TestFlight

### Android (via Play Internal)

1. Submit to Play Internal track (see `scripts/README.md`)
2. Wait 1-3h for Google review
3. In Play Console, add testers to internal testing group
4. Testers see the app in Play Store → install
5. Crashes reported via Play Console Crashes & ANRs

---

## Monitoring & Debugging

### Local debugging

```bash
# Run with detailed logs
npm start -- --verbose

# View Expo logs in real-time
expo logs
```

### Sentry (Month 2)

Plan to add Sentry SDK for production error tracking:

```bash
npx @sentry/wizard -i reactNative
```

Update `app.json` with Sentry config and wire in `src/app/App.tsx`.

### MapLibre debugging

Enable verbose logging:

```typescript
// In MapScreen.tsx
MapLibreGL.setLoggingEnabled(true);
```

---

## Push Notifications (Month 3)

Placeholder for future implementation. Will use:
- Expo Notifications SDK (managed push)
- Clerk triggers (storm alerts from backend)

For now, note in the app: "Alerts coming soon."

---

## Offline Cache (Month 3)

**PRD §1.8:** "Last 7 days of storms cacheable for field use without signal."

Will implement using:
- AsyncStorage for unencrypted cache (storms GeoJSON)
- SQLite for structured data (markers)
- SyncManager pattern (sync on reconnect)

For now, the app requires live internet. Document the limitation in the app or as a tooltip.

---

## Environment Variables

### Required (must set in `.env`)

- `CLERK_PUBLISHABLE_KEY`: From https://dashboard.clerk.com → API Keys → Publishable Key

### Optional (defaults provided)

- `API_BASE_URL`: Defaults to `https://api.hailscout.com/v1`
- `TILES_BASE_URL`: Defaults to `https://tiles.hailscout.com`
- `ENVIRONMENT`: Set by EAS build profile (development, preview, production)

### How to set env vars in EAS builds

Secrets (like API keys) should NOT be in `.env`. Use EAS Secrets:

```bash
# Set a secret via CLI
eas secret:create --scope project --name CLERK_PUBLISHABLE_KEY

# Or manage via https://expo.dev
```

Then reference in `eas.json`:

```json
{
  "build": {
    "production": {
      "env": {
        "CLERK_PUBLISHABLE_KEY": "@CLERK_PUBLISHABLE_KEY"
      }
    }
  }
}
```

For now (Week 1), use `.env` file locally. Swap to EAS Secrets before submitting to TestFlight/Play.

---

## Deployment Checklist (Month 2)

- [ ] Update version in `app.json` (e.g., 1.0.0)
- [ ] Update Android `versionCode` (increment by 1)
- [ ] Test on iOS simulator + Android emulator
- [ ] Test on real device via EAS Preview
- [ ] Run `npm run type-check` — must pass
- [ ] Run `npm run lint` — should pass
- [ ] Create git tag: `git tag -a v1.0.0 -m "Release 1.0.0"`
- [ ] Build via EAS: `eas build --platform all --profile preview --wait`
- [ ] Submit to TestFlight: `eas submit --platform ios --latest`
- [ ] Submit to Play Internal: `eas submit --platform android --latest --track internal`
- [ ] Monitor submissions via App Store Connect & Play Console
- [ ] Once approved, promote to TestFlight External / Play Closed Testing
- [ ] Coordinate with Kirk for public launch

---

## Troubleshooting

### "Module not found: MapLibreGL"

```bash
# Reinstall and clear cache
rm -rf node_modules .expo
npm install
npm start
```

### "Cannot find module '@clerk/clerk-expo'"

Same fix as above — clear and reinstall.

### "Permission denied: location"

- iOS: Check `Info.plist` in Xcode for `NSLocationWhenInUseUsageDescription`
- Android: Check `AndroidManifest.xml` for `android.permission.ACCESS_FINE_LOCATION`
- App: User denied permission in Settings → go back and enable

### Map is blank / blue dot not showing

1. Check Clerk authentication is working (Settings screen shows email)
2. Open DevTools in Expo Go: Press `d` → "Inspect with DevTools"
3. Check MapLibre GL logs: `MapLibreGL.setLoggingEnabled(true)` in MapScreen
4. Verify `expo-location` permission is granted

### EAS build fails: "Bundling failed"

```bash
# Clear all caches
rm -rf node_modules .expo .cache
npm install
eas build --platform ios --profile preview --wait --clear-cache
```

---

## Support & Contribution

- **Questions:** Slack `#mobile-team` or create a Cowork ticket
- **Bugs:** Create a GitHub issue in the Hail-Scout repo
- **PRs:** Link to a Cowork ticket; ensure CI passes

---

## Resources

- [Expo Docs](https://docs.expo.dev)
- [React Navigation](https://reactnavigation.org)
- [Clerk Expo SDK](https://clerk.com/docs/quickstarts/expo)
- [MapLibre React Native](https://github.com/maplibre/maplibre-react-native)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

**Last Updated:** Week 1, Month 1  
**Status:** Scaffold complete, ready for Month 3 build  
**Owner:** Mobile Agent (Kirk D)
