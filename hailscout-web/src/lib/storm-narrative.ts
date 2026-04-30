/**
 * Synthesizes a natural-language summary of a storm event from its
 * structured data. No live LLM calls — deterministic templating with
 * variation seeded by the storm id so each storm reads slightly
 * differently. Looks like AI without burning tokens.
 */

import type { Storm } from "./api-types";
import { hailColor } from "./hail";

const SEVERITY_FRAMING: Record<
  string,
  { headline: string; impact: string; risk: string }
> = {
  Pea: {
    headline: "minor hail event",
    impact: "Minimal documented damage to most roof types.",
    risk: "Routine inspection is sufficient.",
  },
  Penny: {
    headline: "small hail event",
    impact: "Aesthetic granule loss possible on aging shingles.",
    risk: "Customer outreach worthwhile for roofs over 10 years old.",
  },
  Quarter: {
    headline: "moderate hail event",
    impact: "Surface bruising and granule loss on most asphalt shingles.",
    risk: "Insurance claims commonly filed at this size.",
  },
  "Half-dollar": {
    headline: "moderate-to-severe hail event",
    impact: "Visible shingle damage; soft metals commonly dented.",
    risk: "Strong claim viability for affected roofs.",
  },
  Walnut: {
    headline: "severe hail event",
    impact: "Likely shingle penetration; gutter, vent, and siding damage common.",
    risk: "Full inspection recommended for every property in the swath.",
  },
  "Golf ball": {
    headline: "severe hail event",
    impact: "Decking damage probable; mandatory replacement on many policies.",
    risk: "High-value claim territory — file promptly.",
  },
  "Hen egg": {
    headline: "destructive hail event",
    impact: "Roof replacements expected; vehicles and skylights at risk.",
    risk: "Catastrophic-tier claim documentation required.",
  },
  "Tennis ball": {
    headline: "destructive hail event",
    impact: "Severe structural impact; total losses on older roofs.",
    risk: "Immediate canvass; storm-chase competitors will arrive within hours.",
  },
  Baseball: {
    headline: "catastrophic hail event",
    impact: "Total replacements, broken windows, vehicle write-offs likely.",
    risk: "Insurance will fast-track claims — first responder wins the contracts.",
  },
  Softball: {
    headline: "catastrophic hail event",
    impact: "Property-wide damage; structural insurance claims certain.",
    risk: "Mobilize the whole crew. This is a once-a-season event.",
  },
};

function durationStr(start: string, end: string): string {
  const ms = Math.max(60_000, new Date(end).getTime() - new Date(start).getTime());
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins} minutes`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem === 0 ? `${hrs} hour${hrs === 1 ? "" : "s"}` : `${hrs}h ${rem}m`;
}

function trackLengthMi(s: Storm): number | null {
  if (!s.bbox) return null;
  // ~69 mi per degree of latitude; ~55 mi per degree of longitude at 35°N
  const dLat = (s.bbox.max_lat - s.bbox.min_lat) * 69;
  const dLng = (s.bbox.max_lng - s.bbox.min_lng) * 55;
  return Math.round(Math.sqrt(dLat * dLat + dLng * dLng));
}

function affectedAreaSqMi(s: Storm): number | null {
  if (!s.bbox) return null;
  const dLat = (s.bbox.max_lat - s.bbox.min_lat) * 69;
  const dLng = (s.bbox.max_lng - s.bbox.min_lng) * 55;
  // Lozenge-shaped, so ~ ellipse area = π·a·b/4. Approximate.
  return Math.round((Math.PI * dLat * dLng) / 4);
}

function bearingFromBbox(s: Storm): string {
  if (!s.bbox) return "";
  const aspect = (s.bbox.max_lng - s.bbox.min_lng) / (s.bbox.max_lat - s.bbox.min_lat);
  // Most US plains supercells run roughly NE
  if (aspect > 1.3) return "tracked east-northeast";
  if (aspect < 0.7) return "tracked north-northeast";
  return "tracked northeast";
}

function pickVariant<T>(seed: string, options: T[]): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return options[h % options.length];
}

export interface StormNarrative {
  /** One-sentence headline. */
  headline: string;
  /** 2-3 sentence body. */
  body: string;
  /** Tactical "what to do" line. */
  next_step: string;
  /** Stat tiles to render alongside. */
  stats: { label: string; value: string }[];
}

export function synthesize(storm: Storm): StormNarrative {
  const c = hailColor(storm.max_hail_size_in);
  const framing = SEVERITY_FRAMING[c.object] ?? SEVERITY_FRAMING.Quarter;
  const dur = durationStr(storm.start_time, storm.end_time);
  const trackMi = trackLengthMi(storm);
  const areaSqMi = affectedAreaSqMi(storm);
  const bearing = bearingFromBbox(storm);

  const onsetWord = pickVariant(storm.id + "onset", [
    "fired", "initiated", "developed", "ignited",
  ]);
  const peakWord = pickVariant(storm.id + "peak", [
    "peaked", "topped out", "maxed",
  ]);
  const dateStr = new Date(storm.start_time).toLocaleString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const headline = `A ${framing.headline} — peak ${storm.max_hail_size_in.toFixed(2)}″ ${c.object.toLowerCase()} hail.`;

  const tracks = trackMi ? `, ${bearing} for roughly ${trackMi} miles` : "";
  const area = areaSqMi ? ` Affected area: ~${areaSqMi.toLocaleString()} sq mi.` : "";
  const body = `The cell ${onsetWord} on ${dateStr} and persisted for ${dur}${tracks}. Hail ${peakWord} at ${storm.max_hail_size_in.toFixed(2)}″ — ${c.object.toLowerCase()}-sized.${area} ${framing.impact}`;

  const stats: StormNarrative["stats"] = [
    { label: "Peak size",    value: `${storm.max_hail_size_in.toFixed(2)}″` },
    { label: "Reference",    value: c.object },
    { label: "Duration",     value: dur },
  ];
  if (trackMi !== null) stats.push({ label: "Track length", value: `${trackMi} mi` });
  if (areaSqMi !== null) stats.push({ label: "Affected area", value: `${areaSqMi.toLocaleString()} sq mi` });

  return {
    headline,
    body,
    next_step: framing.risk,
    stats,
  };
}
