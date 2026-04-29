/** Application-wide constants. */

export const APP_NAME = "HailScout";
export const APP_DESCRIPTION =
  "AI-native hail mapping for roofers. Nationwide coverage, $899/yr.";

/** Default map settings — continental US. */
export const MAP_CONFIG = {
  // MapLibre takes [lng, lat] order — geographic center of continental US.
  DEFAULT_CENTER: [-98.58, 39.8] as [number, number],
  DEFAULT_ZOOM: 4,
  MIN_ZOOM: 2,
  MAX_ZOOM: 18,
};

/** Hail size color palette (industry standard). */
export const HAIL_SIZE_COLORS: Record<string, string> = {
  "0.75": "#22c55e",
  "1.0": "#eab308",
  "1.25": "#f97316",
  "1.5": "#f97316",
  "1.75": "#ef4444",
  "2.0": "#ef4444",
  "2.5": "#a855f7",
  "3.0+": "#000000",
};

export const HAIL_SIZE_CATEGORIES = [
  { inches: 0.75, color: "#22c55e", label: '0.75"' },
  { inches: 1.0, color: "#eab308", label: '1.0"' },
  { inches: 1.25, color: "#f97316", label: '1.25-1.5"' },
  { inches: 1.75, color: "#ef4444", label: '1.75-2.0"' },
  { inches: 2.5, color: "#a855f7", label: '2.5"' },
  { inches: 3.0, color: "#000000", label: '3.0"+' },
] as const;

/** Pricing tiers — Week-1 MVP is $899/yr nationwide. */
export const PRICING = {
  monthly: { starter: 899 / 12, pro: 1499 / 12, enterprise: null },
  annual: { starter: 899, pro: 1499, enterprise: null },
} as const;

/** Feature comparison table for landing page (PRD §1.3). */
export const FEATURE_COMPARISON = {
  columns: ["Feature", "HailTrace", "IHM", "HailScout"] as const,
  rows: [
    { feature: "Price (nationwide)", hailtrace: "$3-8K/yr", ihm: "$1,999/yr", hailscout: "$899/yr", highlight: true },
    { feature: "Real-time swaths", hailtrace: "✓", ihm: "✓", hailscout: "✓" },
    { feature: "Historical archive (2011+)", hailtrace: "✓", ihm: "✓", hailscout: "✓" },
    { feature: "Meteorologist review", hailtrace: "✓", ihm: "✓", hailscout: "AI + on-demand" },
    { feature: "Mobile app quality", hailtrace: "Mixed", ihm: "Poor (Android)", hailscout: "First-class both", highlight: true },
    { feature: "Frame-by-frame replay", hailtrace: "—", ihm: "✓", hailscout: "✓" },
    { feature: "AI-drafted reports", hailtrace: "—", ihm: "—", hailscout: "✓", highlight: true },
    { feature: "Photo damage triage", hailtrace: "—", ihm: "—", hailscout: "✓", highlight: true },
    { feature: "CRM integration", hailtrace: "Some", ihm: "Limited", hailscout: "API-first", highlight: true },
    { feature: "Natural-language search", hailtrace: "—", ihm: "—", hailscout: "✓", highlight: true },
  ],
};

/** Authenticated app navigation. */
export const APP_NAV = [
  { label: "Map", href: "/app/map", icon: "MapPin" },
  { label: "Addresses", href: "/app/addresses", icon: "MapMarker" },
  { label: "Markers", href: "/app/markers", icon: "Flag" },
  { label: "Reports", href: "/app/reports", icon: "FileText" },
  { label: "Settings", href: "/app/settings", icon: "Settings" },
] as const;

/** Marker status options for canvassing. */
export const MARKER_STATUS_OPTIONS = [
  { value: "lead", label: "Lead", color: "bg-blue-500" },
  { value: "knocked", label: "Knocked", color: "bg-yellow-500" },
  { value: "no_answer", label: "No Answer", color: "bg-gray-500" },
  { value: "appt", label: "Appointment", color: "bg-purple-500" },
  { value: "contract", label: "Contract", color: "bg-green-500" },
  { value: "not_interested", label: "Not Interested", color: "bg-red-500" },
] as const;
