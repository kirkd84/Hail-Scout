# Assets

This directory contains app icons, splash screens, and other visual assets.

## Required Files

Kirk, you need to provide the following assets:

### icon.png
- **Size:** 1024x1024 px
- **Format:** PNG with transparency
- **Purpose:** App icon (used for all platform icons via Expo's icon generation)
- **Notes:** Will be auto-scaled for iOS and Android. Ensure it works well at small sizes (29x29 minimum).

### adaptive-icon.png
- **Size:** 1024x1024 px
- **Format:** PNG with transparency
- **Purpose:** Android adaptive icon (used only on Android 8.0+)
- **Notes:** Should be a centered logo on a transparent background

### splash.png
- **Size:** 1080x2340 px (or your target device size)
- **Format:** PNG
- **Purpose:** Launch screen
- **Notes:** Displayed while the app loads. Keep it simple — avoid text that could be hard to read on all devices.

### favicon.png
- **Size:** 192x192 px
- **Format:** PNG
- **Purpose:** Web version favicon (if you add web support)

## Generation

Once you provide these source assets:
1. Place them in this directory
2. Expo will auto-generate platform-specific versions
3. EAS Build will package them for iOS (via Xcode) and Android

## Design Guidance

- **Brand consistency:** Use the HailScout brand color (#0066cc) in icon design
- **Contrast:** Ensure icons are visible on both light and dark backgrounds
- **Simplicity:** Avoid complex designs that get muddy at small sizes
- **Localization:** The icon/splash should be language-agnostic

## Tools

- **Figma:** https://figma.com (design tools)
- **ImageOptim:** https://imageoptim.com (optimize PNG size)
- **iOS Icon Generator:** Tools like Makeappicon (https://makeappicon.com) can help generate multiple sizes
