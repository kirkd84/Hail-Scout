/**
 * Client-safe config (all EXPO_PUBLIC_*, inlined at build time).
 *
 * OAuth client IDs come from the Google Cloud + Azure NATIVE app registrations
 * (separate from the web ones). See RUNNING.md → Auth.
 */
export const env = {
  GOOGLE_IOS_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "",
  GOOGLE_ANDROID_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "",
  MICROSOFT_CLIENT_ID: process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID ?? "",
  MICROSOFT_TENANT: process.env.EXPO_PUBLIC_MICROSOFT_TENANT ?? "common",
  API_BASE_URL:
    process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://hail-scout-production.up.railway.app",
  TILES_BASE_URL: process.env.EXPO_PUBLIC_TILES_BASE_URL ?? "https://tiles.hailscout.net",
} as const;

export type Env = typeof env;
