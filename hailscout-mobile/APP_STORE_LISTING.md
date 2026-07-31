# Hail GPS — App Store Connect listing (iOS v1.0.0)

Paste-ready copy for App Store Connect, plus the pre-submission checklist.
Bundle ID: `com.hailscout.app`. Keep all copy plain-language (no jargon).

---

## Metadata

**App Name** (≤30 chars)
```
Hail GPS: Storm Damage Maps
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

Hail GPS turns the latest storms into a clear, verified map of where hail fell and how big it was. Roofing and restoration crews stop guessing and start working where the damage actually is.

Search any address to see every storm that's hit it and the hail size on record. See a storm's real footprint on the map — not a rough circle. Then head out, and Hail GPS rides along with you.

WHAT YOU CAN DO
- Verified hail maps. Real storm swaths, color-coded by hail size — cross-checked against ground reports, so you can trust what you're driving to.
- Address lookup. Type any address and instantly see what hit it and how big.
- Drive Mode. A big, glance-friendly map that follows you as you drive into a storm, with voice call-outs ("entering golf-ball hail") so you keep your eyes on the road.
- Navigate to your next lead. Turn-by-turn directions, right in the app.
- Storm alerts. Get notified the moment a new storm hits an area you're watching — with the size and the spot.
- Work your territory. Drop door-knock pins, track leads and follow-ups, and see your team's activity.

BUILT FOR THE FIELD
Whether you're a roofer, a restoration pro, or running a storm crew, Hail GPS is made to be used from the truck and the doorstep — fast, clear, and honest about what's real.

Sign in with Apple, Google, or Microsoft to get started.
```

**What's New** (v1.0.0 release notes)
```
Welcome to Hail GPS. See verified hail maps, look up any address, get storm alerts, and navigate straight to your next lead — with Drive Mode and voice call-outs so you can work every storm from the truck.
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

Status as of the current build:

1. ~~**Guideline 4.8 — Sign in with Apple.**~~ **DONE** — native Sign in with Apple ships in the app; the backend verifies Apple tokens (`APPLE_OAUTH_CLIENT_ID` set on Railway). Ships with the next EAS build.
2. **[STILL REQUIRED — KIRK] Demo account for App Review.** This is the most likely rejection now. Sign-in is **invite-only**: an unknown Apple/Google account gets a 403 ("Ask your administrator to add you"), so a reviewer who signs in with their own Apple ID sees a dead end → Guideline 2.1 rejection. Fix: create a real Hail GPS user (e.g. `appreview@hailscout.net`) with a password set, seed its org with some storms/pins so the app isn't empty, and put those credentials in **App Review Information → Sign-In Information**. Note: password sign-in needs email working only for the *reset* flow — set the password directly so the reviewer doesn't need an email.
3. ~~**Privacy policy live.**~~ **DONE** — `https://hailscout.net/privacy` (with site chrome + footer link). Terms also live at `/terms`.
4. ~~**`ORS_API_KEY` set.**~~ **DONE** — navigate-to-lead works.
5. **Account deletion (Guideline 5.1.1(v))** — **DONE**: Settings → Delete account now deletes in-app (deactivates + revokes sessions server-side), no longer a mailto. Mention it in review notes so the reviewer finds it.
6. **Screenshots** (6.9"/6.7" iPhone required; 5.5" optional). Shot list, captured from the running app:
   - Hail map with real swaths (color-coded).
   - Address lookup result ("what hit here").
   - Drive Mode HUD ("HAIL HERE 2.0" + following map).
   - Turn-by-turn navigate-to-lead.
   - Storm alerts.
   - Canvassing pins on the map (drop-pin + statuses).
7. **Export compliance:** app uses standard HTTPS only → exempt. Already set: `ITSAppUsesNonExemptEncryption=false` in app.json, so the per-build "Missing Compliance" prompt should stop appearing.
8. **App Review notes** — paste-ready:
```
Hail GPS is a business tool for roofing and restoration contractors. It shows
where hail fell (from public NOAA/NWS radar and ground reports), lets crews look
up an address, and navigates them to jobs.

Accounts are provisioned by an administrator, so please use the demo account
above rather than creating one.

Location: used only to center the map, show hail size at your position, and
provide navigation. It is not used for tracking.

Account deletion: Settings → Delete account (deletes in-app, per 5.1.1(v)).
```

---

## Filling in App Store Connect — field by field

In App Store Connect → My Apps → Hail GPS:

**1. App Information** (left sidebar)
- Name / Subtitle → from Metadata above. Category: Business (primary), Weather (secondary). Age rating: 4+ (answer all "None").

**2. Pricing and Availability**
- Free. Availability: United States (or all — but the data is US-only, so US-only is the honest choice).

**3. App Privacy** (this is a questionnaire, not free text)
- Use the "App Privacy" section above. For each type: choose the data, then "App Functionality", then answer **"No"** to *"Do you use this data to track users?"* for all of them.
- If you have no analytics SDK, do **not** declare Usage/Diagnostics.

**4. iOS App version page** (the "1.0 Prepare for Submission" screen)
- Screenshots (required, 6.9" or 6.7").
- Promotional text, Description, Keywords, Support/Marketing URL → from Metadata above.
- What's New → the v1.0.0 text above (only shows for updates, fine to fill).
- Build → pick the build after EAS finishes processing (can take ~15–60 min after submit).
- **App Review Information** → Sign-In Required = YES + the demo credentials, plus the notes block above. Add a contact phone/email.
- Version Release → "Manually release this version" is safest for a first launch (you control the moment it goes live).
