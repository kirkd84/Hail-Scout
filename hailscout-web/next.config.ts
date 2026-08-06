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
  // The pre-rebrand domain still resolves to this same app, which quietly broke
  // social sign-in: the OAuth state cookie is written on the host the user
  // started from (www.hailgps.com), Google is still registered to return to
  // hailscout.net, and that host cannot read the cookie — so every Google /
  // Microsoft / Apple sign-in died with `invalid_state`.
  //
  // Sending the old host here fixes it without touching any OAuth console:
  // Google still returns to the registered hailscout.net callback, this
  // redirect forwards it on to www.hailgps.com carrying `code` and `state`
  // (Next preserves the query string), and the cookie is waiting there.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "(www\\.)?hailscout\\.net" }],
        destination: "https://www.hailgps.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default config;
