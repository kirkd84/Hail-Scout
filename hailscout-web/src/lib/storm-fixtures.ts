/**
 * Granular storm fixtures — nested concentric hail bands.
 *
 * Each storm event is rendered as 5–8 concentric polygons. The outermost
 * band represents the lightest hail (≥ 0.75"), and each inner band
 * steps up to a smaller area of larger hail. The innermost polygon is
 * a tight "core" where the peak hail size fell — exactly how HailTrace
 * and Interactive Hail Maps render real MRMS data.
 *
 * Visual outcome: the user sees a topographic-style intensity gradient
 * across each storm — green outer halo, yellow/orange mid band, red core.
 * "Where did the big stuff fall?" reads from the map at a glance.
 *
 * The polygons are deterministic (seeded), so SSR + hydration match.
 * GeoJSON convention: [lng, lat] order.
 */

import { HAIL_THRESHOLDS } from "./hail";
import type { Storm } from "./api-types";

export interface StormBand {
  min_size_in: number;  // hail diameter at this band's threshold
  ring: [number, number][];  // outer ring of polygon, [lng, lat]
}

export interface StormFixture extends Storm {
  city: string;
  bands: StormBand[];
  /** Storm is currently 'live' — within the last 2 hours. Used for pulse animations. */
  is_live: boolean;
}

interface StormSpec {
  id: string;
  city: string;
  start_time: string;
  end_time: string;
  centroid: [number, number]; // [lng, lat]
  /** Half-length of OUTERMOST band, in degrees. ~0.4° = ~28mi at 35°N */
  outer_half_length: number;
  /** Half-width of OUTERMOST band, in degrees. */
  outer_half_width: number;
  /** Track bearing (degrees from east; 35–45° NE is typical for US plains supercells). */
  bearing: number;
  /** Peak hail size in inches (also the storm's max_hail_size_in). */
  peak_size_in: number;
  /**
   * For multi-core storms, additional offset cores (relative to centroid,
   * in degrees). Each gets its own peak — useful for big multi-cell
   * events like the Amarillo 3.5" storm.
   */
  extra_cores?: { offset: [number, number]; peak: number }[];
}

// Live storms — timestamps computed at module-load so the demo always
// has 'currently active' events. The set re-evaluates on each page load.
const NOW = Date.now();
const minsAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();

const LIVE_STORM_SPECS: (StormSpec & { is_live: boolean })[] = [
  {
    id: "fx-storm-live-wichita-falls",
    city: "Wichita Falls, TX",
    start_time: minsAgo(14),
    end_time: minsAgo(-30), // still ongoing — ETA 30 min
    centroid: [-98.49, 33.91],
    outer_half_length: 0.40, outer_half_width: 0.14, bearing: 38,
    peak_size_in: 2.25,
    is_live: true,
  },
  {
    id: "fx-storm-live-dodge-city",
    city: "Dodge City, KS",
    start_time: minsAgo(38),
    end_time: minsAgo(-12),
    centroid: [-100.02, 37.75],
    outer_half_length: 0.42, outer_half_width: 0.15, bearing: 32,
    peak_size_in: 1.75,
    is_live: true,
  },
  {
    id: "fx-storm-live-tulsa",
    city: "Tulsa, OK",
    start_time: minsAgo(72),
    end_time: minsAgo(8),
    centroid: [-95.99, 36.15],
    outer_half_length: 0.48, outer_half_width: 0.17, bearing: 35,
    peak_size_in: 2.5,
    is_live: true,
  },
  {
    id: "fx-storm-live-greenville",
    city: "Greenville, TX",
    start_time: minsAgo(128),
    end_time: minsAgo(72),
    centroid: [-96.11, 33.14],
    outer_half_length: 0.36, outer_half_width: 0.13, bearing: 40,
    peak_size_in: 1.5,
    is_live: false, // ended >1h ago — no pulse
  },
];

const STORM_SPECS: StormSpec[] = [
  { id: "fx-storm-dfw-04-12",   city: "Dallas–Fort Worth, TX", start_time: "2026-04-12T20:14:00Z", end_time: "2026-04-12T22:38:00Z", centroid: [-96.97, 32.81], outer_half_length: 0.55, outer_half_width: 0.18, bearing: 38, peak_size_in: 2.75 },
  { id: "fx-storm-okc-04-14",   city: "Oklahoma City, OK",     start_time: "2026-04-14T22:02:00Z", end_time: "2026-04-15T00:18:00Z", centroid: [-97.50, 35.47], outer_half_length: 0.62, outer_half_width: 0.21, bearing: 35, peak_size_in: 3.0 },
  { id: "fx-storm-wichita-04-15", city: "Wichita, KS",          start_time: "2026-04-15T19:31:00Z", end_time: "2026-04-15T21:14:00Z", centroid: [-97.34, 37.69], outer_half_length: 0.50, outer_half_width: 0.16, bearing: 40, peak_size_in: 1.75 },
  { id: "fx-storm-denver-04-18", city: "Denver, CO",            start_time: "2026-04-18T22:48:00Z", end_time: "2026-04-19T00:36:00Z", centroid: [-104.99, 39.74], outer_half_length: 0.50, outer_half_width: 0.18, bearing: 22, peak_size_in: 2.25 },
  { id: "fx-storm-omaha-04-19",  city: "Omaha, NE",             start_time: "2026-04-19T20:11:00Z", end_time: "2026-04-19T22:24:00Z", centroid: [-95.93, 41.26], outer_half_length: 0.46, outer_half_width: 0.16, bearing: 42, peak_size_in: 1.5 },
  { id: "fx-storm-kc-04-20",     city: "Kansas City, MO",       start_time: "2026-04-20T23:05:00Z", end_time: "2026-04-21T01:42:00Z", centroid: [-94.58, 39.10], outer_half_length: 0.58, outer_half_width: 0.20, bearing: 38, peak_size_in: 2.5 },
  { id: "fx-storm-lubbock-04-21",city: "Lubbock, TX",           start_time: "2026-04-21T21:18:00Z", end_time: "2026-04-21T23:09:00Z", centroid: [-101.86, 33.58], outer_half_length: 0.45, outer_half_width: 0.17, bearing: 36, peak_size_in: 2.0 },
  { id: "fx-storm-stl-04-22",    city: "St. Louis, MO",         start_time: "2026-04-22T22:34:00Z", end_time: "2026-04-23T00:51:00Z", centroid: [-90.20, 38.63], outer_half_length: 0.45, outer_half_width: 0.14, bearing: 45, peak_size_in: 1.25 },
  { id: "fx-storm-ind-04-25",    city: "Indianapolis, IN",      start_time: "2026-04-25T23:48:00Z", end_time: "2026-04-26T01:32:00Z", centroid: [-86.16, 39.77], outer_half_length: 0.45, outer_half_width: 0.17, bearing: 50, peak_size_in: 1.75 },
  {
    id: "fx-storm-amarillo-04-26", city: "Amarillo, TX",          start_time: "2026-04-26T20:55:00Z", end_time: "2026-04-26T22:48:00Z",
    centroid: [-101.83, 35.22],
    outer_half_length: 0.60, outer_half_width: 0.22, bearing: 32, peak_size_in: 3.5,
    extra_cores: [
      { offset: [+0.18, +0.10], peak: 3.0 },
      { offset: [-0.22, -0.08], peak: 2.5 },
    ],
  },
];

/** Build a noisy oriented lozenge polygon. */
function lozenge(
  centerLng: number,
  centerLat: number,
  halfLen: number,
  halfWid: number,
  bearingDeg: number,
  noiseSeed: number,
): [number, number][] {
  const cos = Math.cos((bearingDeg * Math.PI) / 180);
  const sin = Math.sin((bearingDeg * Math.PI) / 180);
  // 12-point lozenge for organic edges
  const pts: [number, number][] = [];
  for (let i = 0; i < 12; i++) {
    const t = (i / 12) * Math.PI * 2;
    // Base shape: slim ellipse (long along x, narrow along y)
    let x = Math.cos(t) * halfLen;
    let y = Math.sin(t) * halfWid;
    // Pinch the ends slightly so it looks more like a track than an oval
    if (Math.abs(Math.cos(t)) > 0.7) {
      y *= 0.7;
    }
    // Edge noise — small perturbation, deterministic via seed + index
    const noise = (((noiseSeed + i * 31) % 17) - 8) / 200;
    x *= 1 + noise;
    y *= 1 + noise * 0.6;
    pts.push([x, y]);
  }
  // Rotate by bearing, translate to center, close ring
  const rotated = pts.map(([x, y]) => {
    const rx = x * cos - y * sin;
    const ry = x * sin + y * cos;
    return [centerLng + rx, centerLat + ry] as [number, number];
  });
  rotated.push(rotated[0]);
  return rotated;
}

/**
 * Compute concentric bands for a single core.
 * Returns bands ordered from outermost (smallest hail) to innermost (largest).
 */
function bandsForCore(
  centerLng: number,
  centerLat: number,
  outerHalfLen: number,
  outerHalfWid: number,
  bearingDeg: number,
  peakSizeIn: number,
  seedBase: number,
): StormBand[] {
  // Pick which thresholds are present in this core: from 0.75 up to peak.
  const includedThresholds = HAIL_THRESHOLDS.filter(
    (t) => t >= 0.75 && t <= peakSizeIn,
  );
  // For each, pick a scale factor relative to the outermost band.
  // Linear interpolation: outermost = 1.0, innermost (peak) = ~0.18
  const minScale = 0.18;
  const n = includedThresholds.length;
  return includedThresholds.map((threshold, i) => {
    const t = n === 1 ? 1 : i / (n - 1);
    const scale = 1 - t * (1 - minScale);
    const noise = seedBase + i * 7;
    return {
      min_size_in: threshold,
      ring: lozenge(
        centerLng,
        centerLat,
        outerHalfLen * scale,
        outerHalfWid * scale,
        bearingDeg,
        noise,
      ),
    };
  });
}

function buildFixture(spec: StormSpec): StormFixture {
  const seed = spec.id
    .split("")
    .reduce((acc, c) => acc + c.charCodeAt(0), 0);

  const primary = bandsForCore(
    spec.centroid[0],
    spec.centroid[1],
    spec.outer_half_length,
    spec.outer_half_width,
    spec.bearing,
    spec.peak_size_in,
    seed,
  );

  const extraBands: StormBand[] = (spec.extra_cores ?? []).flatMap((core, i) =>
    bandsForCore(
      spec.centroid[0] + core.offset[0],
      spec.centroid[1] + core.offset[1],
      spec.outer_half_length * 0.5,
      spec.outer_half_width * 0.5,
      spec.bearing,
      core.peak,
      seed + (i + 1) * 13,
    ),
  );

  const bands = [...primary, ...extraBands];

  // Compute bbox from all bands
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const b of bands) {
    for (const [lng, lat] of b.ring) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }

  return {
    id: spec.id,
    city: spec.city,
    start_time: spec.start_time,
    end_time: spec.end_time,
    max_hail_size_in: spec.peak_size_in,
    centroid_lat: spec.centroid[1],
    centroid_lng: spec.centroid[0],
    bbox: { min_lat: minLat, min_lng: minLng, max_lat: maxLat, max_lng: maxLng },
    source: "mrms",
    bands,
    is_live: (spec as StormSpec & { is_live?: boolean }).is_live ?? false,
  };
}

export const STORM_FIXTURES: StormFixture[] = [
  ...LIVE_STORM_SPECS.map(buildFixture),
  ...STORM_SPECS.map(buildFixture),
];

/* ──────────────────────────────────────────────────────────
   Geo helpers
   ────────────────────────────────────────────────────────── */

function pointInPolygon([px, py]: [number, number], ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Return storms whose footprint contains (lng, lat). For each storm, the
 * `max_hail_size_in` we report back is the largest band threshold that
 * actually contains the point — i.e., what hail diameter fell *here*.
 */
export function fixturesAtPoint(lng: number, lat: number): StormFixture[] {
  const hits: StormFixture[] = [];
  for (const s of STORM_FIXTURES) {
    let bestThreshold: number | null = null;
    for (const band of s.bands) {
      if (pointInPolygon([lng, lat], band.ring)) {
        if (bestThreshold === null || band.min_size_in > bestThreshold) {
          bestThreshold = band.min_size_in;
        }
      }
    }
    if (bestThreshold !== null) {
      hits.push({ ...s, max_hail_size_in: bestThreshold });
    }
  }
  return hits;
}

/**
 * Build a GeoJSON FeatureCollection of all bands across all storms,
 * each feature carrying its `min_size_in` threshold. The map renders
 * smallest first so larger-hail bands paint on top.
 */
export function fixturesAsGeoJSON(): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const s of STORM_FIXTURES) {
    // Outer-first ordering so the data-driven `step` paints small-then-large
    const ordered = [...s.bands].sort((a, b) => a.min_size_in - b.min_size_in);
    for (const band of ordered) {
      features.push({
        type: "Feature",
        id: `${s.id}-${band.min_size_in}`,
        geometry: { type: "Polygon", coordinates: [band.ring] },
        properties: {
          storm_id: s.id,
          city: s.city,
          min_size_in: band.min_size_in,
          peak_size_in: s.max_hail_size_in,
          start_time: s.start_time,
          end_time: s.end_time,
          source: s.source,
          is_live: s.is_live,
        },
      });
    }
  }
  return { type: "FeatureCollection", features };
}
