import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // Replaces the deprecated `experimental.serverComponentsExternalPackages`
  serverExternalPackages: ["maplibre-gl"],
  webpack: (cfg) => {
    cfg.externals.push("maplibre-gl");
    return cfg;
  },
};

export default config;
