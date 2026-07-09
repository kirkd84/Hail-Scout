import type { MetadataRoute } from "next";

const BASE = "https://hailscout.net";

// Public marketing + product routes (mirrors the site footer nav).
const ROUTES = [
  "",
  "/live",
  "/alerts",
  "/storms",
  "/stats",
  "/accuracy",
  "/pricing",
  "/case-studies",
  "/claim",
  "/api",
  "/privacy",
];

// /storms/state/[code] — all 50 states + DC. Lowercased; the page uppercases
// internally. A key SEO surface (users landing from a state name).
const STATES = [
  "al", "ak", "az", "ar", "ca", "co", "ct", "dc", "de", "fl", "ga", "hi",
  "id", "il", "in", "ia", "ks", "ky", "la", "me", "md", "ma", "mi", "mn",
  "ms", "mo", "mt", "ne", "nv", "nh", "nj", "nm", "ny", "nc", "nd", "oh",
  "ok", "or", "pa", "ri", "sc", "sd", "tn", "tx", "ut", "vt", "va", "wa",
  "wv", "wi", "wy",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes: MetadataRoute.Sitemap = ROUTES.map((r) => ({
    url: `${BASE}${r || "/"}`,
    lastModified: now,
    changeFrequency: r === "" || r === "/live" ? "daily" : "weekly",
    priority: r === "" ? 1 : 0.7,
  }));
  const states: MetadataRoute.Sitemap = STATES.map((s) => ({
    url: `${BASE}/storms/state/${s}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.6,
  }));
  return [...routes, ...states];
}
