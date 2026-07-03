/**
 * "Hail at my GPS" engine — the shared brain behind Drive mode (and, later,
 * the CarPlay / Android Auto surface).
 *
 * Given a live GPS point and the loaded swath band polygons (the same
 * FeatureCollection the map renders, from useStorms({ includeSwaths: true })),
 * it answers two questions with zero network calls, so it updates instantly as
 * you move:
 *   - hailSizeAtPoint  — how big was the hail RIGHT HERE (0 if you're clear)
 *   - nearestSwath     — if you're not in it yet, how big + how far ahead
 *
 * Pure geometry (ray-casting), no deps. Bands carry `min_size_in` (the floor of
 * the 0.25" category) and are pre-sorted smallest-first by useStorms.
 */

import type { FeatureCollection, Position } from "geojson";

// Ray-casting crossing test for a single linear ring.
function ringCrosses(x: number, y: number, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// Polygon = outer ring + holes. XOR of per-ring crossings handles holes:
// a point inside a hole flips back to "outside".
function polygonContains(x: number, y: number, rings: Position[][]): boolean {
  let inside = false;
  for (const ring of rings) if (ringCrosses(x, y, ring)) inside = !inside;
  return inside;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function geomContains(x: number, y: number, geom: any): boolean {
  if (!geom) return false;
  if (geom.type === "Polygon") return polygonContains(x, y, geom.coordinates);
  if (geom.type === "MultiPolygon") {
    for (const rings of geom.coordinates) if (polygonContains(x, y, rings)) return true;
  }
  return false;
}

/**
 * Largest hail-band size (inches) whose swath contains [lng, lat]; 0 if the
 * point is clear. Bands are ascending, so we skip any band that can't beat the
 * best hit so far.
 */
export function hailSizeAtPoint(
  lng: number,
  lat: number,
  swaths: FeatureCollection,
): number {
  let max = 0;
  for (const f of swaths.features) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const size = Number((f.properties as any)?.min_size_in) || 0;
    if (size <= max) continue;
    if (geomContains(lng, lat, f.geometry)) max = size;
  }
  return max;
}

// Equirectangular metres — plenty accurate at neighbourhood scale, and fast.
function metres(aLng: number, aLat: number, bLng: number, bLat: number): number {
  const midLat = (((aLat + bLat) / 2) * Math.PI) / 180;
  const dx = (aLng - bLng) * Math.cos(midLat) * 111_320;
  const dy = (aLat - bLat) * 110_540;
  return Math.hypot(dx, dy);
}

/**
 * The nearest swath band + approximate distance in miles — used for the
 * "approaching" heads-up when you're not inside one yet. Distance is the min to
 * any band vertex (cheap; slightly over-estimates true edge distance, which is
 * fine for a glanceable "~0.6 mi ahead"). null when there are no swaths.
 */
export function nearestSwath(
  lng: number,
  lat: number,
  swaths: FeatureCollection,
): { sizeIn: number; distanceMi: number } | null {
  let best: { sizeIn: number; distanceMi: number } | null = null;
  for (const f of swaths.features) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const size = Number((f.properties as any)?.min_size_in) || 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = f.geometry as any;
    if (!g) continue;
    const polys =
      g.type === "MultiPolygon" ? g.coordinates : g.type === "Polygon" ? [g.coordinates] : [];
    for (const rings of polys) {
      for (const ring of rings) {
        for (const v of ring) {
          const mi = metres(lng, lat, v[0], v[1]) / 1609.34;
          if (best === null || mi < best.distanceMi) best = { sizeIn: size, distanceMi: mi };
        }
      }
    }
  }
  return best;
}
