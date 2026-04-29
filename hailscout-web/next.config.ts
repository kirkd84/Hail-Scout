import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // maplibre-gl is a client-only package. Mark it external for the *server*
  // build so SSR doesn't try to evaluate its DOM-touching code, but DO let
  // webpack bundle it for the *client* build (otherwise the runtime tries to
  // resolve a `maplibre` global, which doesn't exist).
  serverExternalPackages: ["maplibre-gl"],
};

export default config;
