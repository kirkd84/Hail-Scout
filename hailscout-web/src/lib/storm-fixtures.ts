/**
 * Hardcoded realistic storm fixtures for the demo / no-API-key path.
 *
 * Each storm:
 *  - Center on a real US hail-belt city
 *  - Swath polygon is a rough lozenge ~30-60 mi long oriented along
 *    typical NE-bound supercell tracks
 *  - Max hail size in the realistic 1.0–3.5" range
 *  - Date in the past 30 days
 *
 * Used by:
 *  - The map's storm-fixtures-layer to render swath polygons
 *  - The demo "address search" path when the API isn't reachable
 *
 * GeoJSON conventions: coordinates are [lng, lat] order.
 */

import type { Storm } from "./api-types";

export interface StormFixture extends Storm {
  /** Display label used in the storm-list UI. */
  city: string;
  /** GeoJSON Polygon ring of [lng, lat] pairs for the swath. */
  swath: [number, number][];
}

/** Helper to generate a lozenge polygon centered on (lng, lat). */
function lozenge(lng: number, lat: number, halfLengthDeg: number, halfWidthDeg: number, bearing: number): [number, number][] {
  const cos = Math.cos((bearing * Math.PI) / 180);
  const sin = Math.sin((bearing * Math.PI) / 180);
  // 8-point oriented lozenge
  const points: [number, number][] = [
    [+halfLengthDeg, 0],
    [+halfLengthDeg * 0.7, +halfWidthDeg * 0.85],
    [0, +halfWidthDeg],
    [-halfLengthDeg * 0.7, +halfWidthDeg * 0.85],
    [-halfLengthDeg, 0],
    [-halfLengthDeg * 0.7, -halfWidthDeg * 0.85],
    [0, -halfWidthDeg],
    [+halfLengthDeg * 0.7, -halfWidthDeg * 0.85],
  ];
  // Rotate by bearing (deg from east), translate to center, close ring
  const rotated = points.map(([x, y]) => {
    const rx = x * cos - y * sin;
    const ry = x * sin + y * cos;
    return [lng + rx, lat + ry] as [number, number];
  });
  rotated.push(rotated[0]);
  return rotated;
}

const NE = 35;  // typical supercell bearing
const NNE = 20;

export const STORM_FIXTURES: StormFixture[] = [
  {
    id: "fx-storm-dfw-04-12",
    city: "Dallas–Fort Worth, TX",
    start_time: "2026-04-12T20:14:00Z",
    end_time:   "2026-04-12T22:38:00Z",
    max_hail_size_in: 2.75,
    centroid_lat: 32.81, centroid_lng: -96.97,
    bbox: { min_lat: 32.55, min_lng: -97.42, max_lat: 33.07, max_lng: -96.52 },
    source: "mrms",
    swath: lozenge(-96.97, 32.81, 0.45, 0.13, NE),
  },
  {
    id: "fx-storm-okc-04-14",
    city: "Oklahoma City, OK",
    start_time: "2026-04-14T22:02:00Z",
    end_time:   "2026-04-15T00:18:00Z",
    max_hail_size_in: 3.0,
    centroid_lat: 35.47, centroid_lng: -97.50,
    bbox: { min_lat: 35.18, min_lng: -97.95, max_lat: 35.76, max_lng: -97.05 },
    source: "mrms",
    swath: lozenge(-97.50, 35.47, 0.50, 0.16, NE),
  },
  {
    id: "fx-storm-wichita-04-15",
    city: "Wichita, KS",
    start_time: "2026-04-15T19:31:00Z",
    end_time:   "2026-04-15T21:14:00Z",
    max_hail_size_in: 1.75,
    centroid_lat: 37.69, centroid_lng: -97.34,
    bbox: { min_lat: 37.45, min_lng: -97.74, max_lat: 37.93, max_lng: -96.94 },
    source: "mrms",
    swath: lozenge(-97.34, 37.69, 0.40, 0.12, NE),
  },
  {
    id: "fx-storm-denver-04-18",
    city: "Denver, CO",
    start_time: "2026-04-18T22:48:00Z",
    end_time:   "2026-04-19T00:36:00Z",
    max_hail_size_in: 2.25,
    centroid_lat: 39.74, centroid_lng: -104.99,
    bbox: { min_lat: 39.49, min_lng: -105.39, max_lat: 39.99, max_lng: -104.59 },
    source: "mrms",
    swath: lozenge(-104.99, 39.74, 0.40, 0.14, NNE),
  },
  {
    id: "fx-storm-omaha-04-19",
    city: "Omaha, NE",
    start_time: "2026-04-19T20:11:00Z",
    end_time:   "2026-04-19T22:24:00Z",
    max_hail_size_in: 1.5,
    centroid_lat: 41.26, centroid_lng: -95.93,
    bbox: { min_lat: 41.02, min_lng: -96.30, max_lat: 41.50, max_lng: -95.56 },
    source: "mrms",
    swath: lozenge(-95.93, 41.26, 0.37, 0.12, NE),
  },
  {
    id: "fx-storm-kc-04-20",
    city: "Kansas City, MO",
    start_time: "2026-04-20T23:05:00Z",
    end_time:   "2026-04-21T01:42:00Z",
    max_hail_size_in: 2.5,
    centroid_lat: 39.10, centroid_lng: -94.58,
    bbox: { min_lat: 38.79, min_lng: -95.05, max_lat: 39.41, max_lng: -94.11 },
    source: "mrms",
    swath: lozenge(-94.58, 39.10, 0.47, 0.16, NE),
  },
  {
    id: "fx-storm-lubbock-04-21",
    city: "Lubbock, TX",
    start_time: "2026-04-21T21:18:00Z",
    end_time:   "2026-04-21T23:09:00Z",
    max_hail_size_in: 2.0,
    centroid_lat: 33.58, centroid_lng: -101.86,
    bbox: { min_lat: 33.33, min_lng: -102.21, max_lat: 33.83, max_lng: -101.51 },
    source: "mrms",
    swath: lozenge(-101.86, 33.58, 0.35, 0.13, NE),
  },
  {
    id: "fx-storm-stl-04-22",
    city: "St. Louis, MO",
    start_time: "2026-04-22T22:34:00Z",
    end_time:   "2026-04-23T00:51:00Z",
    max_hail_size_in: 1.25,
    centroid_lat: 38.63, centroid_lng: -90.20,
    bbox: { min_lat: 38.42, min_lng: -90.55, max_lat: 38.84, max_lng: -89.85 },
    source: "mrms",
    swath: lozenge(-90.20, 38.63, 0.35, 0.10, NE),
  },
  {
    id: "fx-storm-ind-04-25",
    city: "Indianapolis, IN",
    start_time: "2026-04-25T23:48:00Z",
    end_time:   "2026-04-26T01:32:00Z",
    max_hail_size_in: 1.75,
    centroid_lat: 39.77, centroid_lng: -86.16,
    bbox: { min_lat: 39.51, min_lng: -86.51, max_lat: 40.03, max_lng: -85.81 },
    source: "mrms",
    swath: lozenge(-86.16, 39.77, 0.35, 0.13, NE),
  },
  {
    id: "fx-storm-amarillo-04-26",
    city: "Amarillo, TX",
    start_time: "2026-04-26T20:55:00Z",
    end_time:   "2026-04-26T22:48:00Z",
    max_hail_size_in: 3.5,
    centroid_lat: 35.22, centroid_lng: -101.83,
    bbox: { min_lat: 34.92, min_lng: -102.30, max_lat: 35.52, max_lng: -101.36 },
    source: "mrms",
    swath: lozenge(-101.83, 35.22, 0.45, 0.16, NE),
  },
];

/**
 * Returns storms whose swath polygon contains the given lng/lat point.
 * Simple ray-casting algorithm — sufficient for fixture data.
 */
export function fixturesAtPoint(lng: number, lat: number): StormFixture[] {
  return STORM_FIXTURES.filter((s) => pointInPolygon([lng, lat], s.swath));
}

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

/** Build a GeoJSON FeatureCollection from the fixtures. */
export function fixturesAsGeoJSON(): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: STORM_FIXTURES.map((s) => ({
      type: "Feature",
      id: s.id,
      geometry: { type: "Polygon", coordinates: [s.swath] },
      properties: {
        id: s.id,
        city: s.city,
        max_hail_size_in: s.max_hail_size_in,
        start_time: s.start_time,
        end_time: s.end_time,
        source: s.source,
      },
    })),
  };
}
