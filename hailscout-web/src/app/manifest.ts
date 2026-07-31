import type { MetadataRoute } from "next";

/**
 * PWA manifest — makes Hail GPS installable as a field app on phones/tablets.
 * Next.js auto-injects the <link rel="manifest"> from this file.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hail GPS — storm intelligence",
    short_name: "Hail GPS",
    description:
      "Verified hail maps, adjuster-grade claim packets, and lead lists for roofing contractors.",
    start_url: "/app/map",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#F8FAFC",
    theme_color: "#0F172A",
    categories: ["weather", "business", "productivity"],
    icons: [
      { src: "/app-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
