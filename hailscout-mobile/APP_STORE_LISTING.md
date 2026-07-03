# HailScout — App Store Connect listing (iOS v1.0.0)

Paste-ready copy for App Store Connect, plus the pre-submission checklist.
Bundle ID: `com.hailscout.app`. Keep all copy plain-language (no jargon).

---

## Metadata

**App Name** (≤30 chars)
```
HailScout: Storm Damage Maps
```

**Subtitle** (≤30 chars)
```
Verified hail maps + leads
```

**Promotional text** (≤170 chars, editable anytime without review)
```
See exactly where hail hit and how big — then drive straight to the damage. Verified storm maps, live Drive Mode, and turn-by-turn to your next lead.
```

**Keywords** (≤100 chars, comma-separated, no spaces; don't repeat words already in the name/subtitle)
```
roofing,roof,restoration,inspection,adjuster,insurance,canvassing,radar,contractor,siding,weather
```

**Description** (≤4000 chars)
```
Know exactly where hail hit — and get to the right doors first.

HailScout turns the latest storms into a clear, verified map of where hail fell and how big it was. Roofing and restoration crews stop guessing and start working where the damage actually is.

Search any address to see every storm that's hit it and the hail size on record. See a storm's real footprint on the map — not a rough circle. Then head out, and HailScout rides along with you.

WHAT YOU CAN DO
- Verified hail maps. Real storm swaths, color-coded by hail size — cross-checked against ground reports, so you can trust what you're driving to.
- Address lookup. Type any address and instantly see what hit it and how big.
- Drive Mode. A big, glance-friendly map that follows you as you drive into a storm, with voice call-outs ("entering golf-ball hail") so you keep your eyes on the road.
- Navigate to your next lead. Turn-by-turn directions, right in the app.
- Storm alerts. Get notified the moment a new storm hits an area you're watching — with the size and the spot.
- Work your territory. Drop door-knock pins, track leads and follow-ups, and see your team's activity.

BUILT FOR THE FIELD
Whether you're a roofer, a restoration pro, or running a storm crew, HailScout is made to be used from the truck and the doorstep — fast, clear, and honest about what's real.

Sign in with Apple, Google, or Microsoft to get started.
```

**What's New** (v1.0.0 release notes)
```
Welcome to HailScout. See verified hail maps, look up any address, get storm alerts, and navigate straight to your next lead — with Drive Mode and voice call-outs so you can work every storm from the truck.
```

**URLs**
- Support URL: `https://hailscout.net`
- Marketing URL: `https://hailscout.net`
- Privacy Policy URL: `https://hailscout.net/privacy`  ← must be live before submit

**Category**
- Primary: Business
- Secondary: Weather

**Age rating:** 4+

---

## App Privacy (answer the questionnaire to match ACTUAL data use)

- Precise Location — purpose: App Functionality (maps + navigation). Linked to the user's account. NOT used for tracking.
- Contact Info (email) — from sign-in. App Functionality / Account. Not tracking.
- Identifiers (user/account ID) — App Functionality.
- Diagnostics / Usage — only if you actually collect analytics; if not, don't declare it.
- Photos/Camera — declare ONLY if the iOS app accesses them (e.g. a photo feature). Skip if it doesn't.

Rule of thumb: declare exactly what the app does, nothing aspirational.

---

## Pre-submission checklist (blockers first)

1. **[LIKELY BLOCKER] Guideline 4.8 — Sign in with Apple.** The app offers Google + Microsoft sign-in, so Apple requires an equivalent privacy option. Add Sign in with Apple (expo-apple-authentication + backend), or expect rejection. (Task #15.)
2. **Demo account for App Review.** Reviewers can't use your Google/Microsoft account. Provide working credentials they CAN sign in with (Sign in with Apple test, or a dedicated email/password test user) in App Review Information → notes.
3. **Privacy policy must be live** at the URL above before you submit.
4. **`ORS_API_KEY` set** on the Railway API service — otherwise navigate-to-lead is off, and the description claims it.
5. **Screenshots** (6.9"/6.7" iPhone required; 5.5" optional). Shot list, captured from the running app:
   - Hail map with real swaths (color-coded).
   - Address lookup result ("what hit here").
   - Drive Mode HUD ("HAIL HERE 2.0" + following map).
   - Turn-by-turn navigate-to-lead.
   - Storm alerts.
6. **Export compliance:** app uses standard HTTPS only → exempt. Set `ITSAppUsesNonExemptEncryption=false` in Info.plist to skip the per-build prompt, or answer "uses exempt encryption."
7. **App Review notes:** one line that it's a B2B tool for roofing/restoration contractors + the demo login + "location is used to show the hail map and navigate."
