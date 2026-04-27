import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["maplibre-gl"],
  },
  webpack: (config) => {
    config.externals.push("maplibre-gl");
    return config;
  },
  env: {
    // Public env vars for client-side use are prefixed NEXT_PUBLIC_ by Next.js convention
    // See .env.example for required variables
  },
};

export default config;
