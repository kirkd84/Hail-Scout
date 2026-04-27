# EAS Build & Submission Cheat Sheet

Quick reference for building and submitting HailScout to TestFlight + Google Play Internal.

## Prerequisites

### One-time setup

```bash
# Login to EAS
eas login

# Configure EAS for this project
eas build:configure

# Generate or link Apple Developer account
# (prompted by EAS, or set in eas.json)
```

### Credentials

- **Apple Developer Account:** $99/yr (create at developer.apple.com)
- **Google Play Developer Account:** $25 one-time (create at play.google.com)
- **EAS Account:** Free (create at expo.dev)

---

## Building

### Development build (internal testing on simulators/dev devices)

```bash
# iOS
eas build --platform ios --profile development

# Android
eas build --platform android --profile development

# Both
eas build --platform all --profile development
```

### Preview build (internal distribution, ad-hoc/Play Internal)

Use this for TestFlight + Play Internal submission.

```bash
# iOS
eas build --platform ios --profile preview --wait

# Android
eas build --platform android --profile preview --wait

# Both
eas build --platform all --profile preview --wait
```

### Production build (store submission)

```bash
# iOS (archive for App Store)
eas build --platform ios --profile production --wait

# Android (app bundle for Play Store)
eas build --platform android --profile production --wait
```

---

## Submitting to TestFlight (iOS Internal)

**Why**: Apple review takes 24-48 hours. By submitting now, you beat the clock and launch faster in Month 2-3.

### First time only

1. Create an app in App Store Connect (https://appstoreconnect.apple.com)
2. Get the ASC App ID (looks like a number)
3. Update `eas.json`:
   ```json
   {
     "submit": {
       "production": {
         "ios": {
           "ascAppId": "YOUR_ASC_APP_ID"
         }
       }
     }
   }
   ```

### Submit

```bash
# Build + submit in one command
eas build --platform ios --profile preview --wait && eas submit --platform ios --latest

# Or submit an existing build
eas submit --platform ios --latest
```

**Status check:** https://appstoreconnect.apple.com → Your App → TestFlight → Internal Testing

---

## Submitting to Play Internal (Android)

**Why**: Google Play processes internal releases in hours (sometimes minutes). Start now to validate signing & metadata.

### First time only

1. Create an app in Google Play Console (https://play.google.com/console)
2. Get your Keystore (EAS can help generate one)
3. EAS will prompt you to authorize Google Play during submission

### Submit

```bash
# Build + submit in one command
eas build --platform android --profile preview --wait && eas submit --platform android --latest

# Or submit an existing build
eas submit --platform android --latest --track internal
```

**Status check:** https://play.google.com/console → Your App → Testing → Internal Testing

---

## Typical Timeline

### iOS (TestFlight Internal)

1. **Submit:** `eas submit --platform ios --latest`
2. **Wait:** 24-48 hours for Apple review
3. **Status:** Check App Store Connect → TestFlight → Internal Testing
4. **Install:** Testers get email invite, download via TestFlight app

### Android (Play Console Internal)

1. **Submit:** `eas submit --platform android --latest --track internal`
2. **Wait:** 1-3 hours (usually) for initial review
3. **Status:** Check Play Console → Testing → Internal Testing
4. **Install:** Users in the internal testing group see the app in Play Store

---

## Build Status & Logs

```bash
# List recent builds
eas build:list --limit 10

# View a specific build
eas build:view BUILD_ID

# View build logs (streaming)
eas build:logs BUILD_ID
```

---

## Troubleshooting

### Build failed: "Bundling failed"
```bash
# Clear cache and rebuild
rm -rf node_modules/.cache
npm install
eas build --platform ios --profile preview --wait
```

### EAS submit fails: "Unauthorized"
```bash
# Re-authenticate
eas logout
eas login
eas submit --platform ios --latest
```

### iOS: "No ASC App ID configured"
- Ensure `eas.json` has the correct `ascAppId` under `submit.production.ios`
- Create the app in App Store Connect first

### Android: "Keystore not found"
```bash
# EAS will prompt to create or upload a keystore
eas build --platform android --profile preview --wait
```

---

## Best Practices

1. **Version bumping:** Update `app.json` version before each build:
   ```json
   {
     "expo": {
       "version": "1.0.1",
       "android": {
         "versionCode": 2
       }
     }
   }
   ```

2. **Tag releases:** After successful submission:
   ```bash
   git tag -a v1.0.0 -m "Release 1.0.0 to TestFlight + Play Internal"
   git push origin v1.0.0
   ```

3. **Monitor submissions:** Check status daily while in review. Apple delays launch, so get ahead.

4. **Test on real devices:** Download from TestFlight (iOS) or Play Store (Android) and verify:
   - Sign-in works
   - Map renders
   - Blue dot appears on map
   - Settings screen shows correct org name

---

## Links

- **EAS Docs:** https://docs.expo.dev/build/introduction/
- **EAS Submit:** https://docs.expo.dev/submit/introduction/
- **App Store Connect:** https://appstoreconnect.apple.com
- **Google Play Console:** https://play.google.com/console
- **Clerk Expo Docs:** https://clerk.com/docs/quickstarts/expo
