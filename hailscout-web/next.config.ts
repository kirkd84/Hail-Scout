import type { NextConfig } from "next";

// Baseline security headers on every response. Deliberately NO strict CSP
// yet — the app pulls the pensnap suite switcher, Google Fonts, MapTiler
// tiles and the Railway API, so a Content-Security-Policy needs careful
// per-source allowlisting (a follow-up). These headers are safe today.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), payment=(), interest-cohort=()" },
];

const config: NextConfig = {
  reactStrictMode: true,
  // maplibre-gl is a client-only package. Mark it external for the *server*
  // build so SSR doesn't try to evaluate its DOM-touching code, but DO let
  // webpack bundle it for the *client* build (otherwise the runtime tries to
  // resolve a `maplibre` global, which doesn't exist).
  serverExternalPackages: ["maplibre-gl"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default config;
