/**
 * useStorms — mobile-side storm fetcher backed by the live API.
 *
 * Mirrors the web hook. Returns:
 *   - `storms`: centroid list (MobileStorm) for the Home + Map dot layer
 *   - `swaths`: a GeoJSON FeatureCollection of hail-swath BAND polygons
 *     (when `includeSwaths`), so the map can render real filled swaths —
 *     not just centroid dots.
 *
 * NO fixture fallback: an empty API result returns an empty list (honest
 * empty state), and an error surfaces as an error. Showing fabricated
 * "live" storms to a field rep on bad signal is a trust killer — we
 * removed exactly that from the web app.
 *
 * /v1/storms is public — no token needed.
 */

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import type { MobileStorm } from "@/lib/storm-fixtures";

interface ApiSwath {
  id: string;
  hail_size_category: string;
  geometry: { type: "MultiPolygon"; coordinates: number[][][][] } | null;
}

interface ApiStorm {
  id: string;
  start_time: string;
  end_time: string;
  max_hail_size_in: number;
  source: string;
  centroid: { type: "Point"; coordinates: [number, number] } | null;
  bbox: unknown;
  lsr_confirmed?: boolean;
  suspect?: boolean;
  swaths?: ApiSwath[];
}

interface ApiStormsListResponse {
  storms: ApiStorm[];
  cursor: string | null;
  total: number;
}

// The 0.25" category ladder — swath bands sit on these floors.
function catToMin(label: string): number {
  const n = parseFloat(String(label).replace("+", ""));
  return Number.isFinite(n) ? n : 0;
}

const METROS: Array<{ name: string; state: string; lat: number; lng: number }> = [
  { name: "Dallas", state: "TX", lat: 32.78, lng: -96.80 },
  { name: "Houston", state: "TX", lat: 29.76, lng: -95.37 },
  { name: "Austin", state: "TX", lat: 30.27, lng: -97.74 },
  { name: "San Antonio", state: "TX", lat: 29.42, lng: -98.49 },
  { name: "Amarillo", state: "TX", lat: 35.22, lng: -101.83 },
  { name: "Lubbock", state: "TX", lat: 33.58, lng: -101.86 },
  { name: "Oklahoma City", state: "OK", lat: 35.47, lng: -97.50 },
  { name: "Tulsa", state: "OK", lat: 36.15, lng: -95.99 },
  { name: "Wichita", state: "KS", lat: 37.69, lng: -97.34 },
  { name: "Topeka", state: "KS", lat: 39.05, lng: -95.68 },
  { name: "Kansas City", state: "MO", lat: 39.10, lng: -94.58 },
  { name: "Omaha", state: "NE", lat: 41.26, lng: -95.93 },
  { name: "Lincoln", state: "NE", lat: 40.81, lng: -96.70 },
  { name: "Denver", state: "CO", lat: 39.74, lng: -104.99 },
  { name: "Colorado Springs", state: "CO", lat: 38.83, lng: -104.82 },
  { name: "Albuquerque", state: "NM", lat: 35.08, lng: -106.65 },
  { name: "Des Moines", state: "IA", lat: 41.59, lng: -93.62 },
  { name: "Minneapolis", state: "MN", lat: 44.98, lng: -93.27 },
  { name: "Sioux Falls", state: "SD", lat: 43.55, lng: -96.73 },
  { name: "Fargo", state: "ND", lat: 46.88, lng: -96.79 },
  { name: "Saint Louis", state: "MO", lat: 38.63, lng: -90.20 },
  { name: "Chicago", state: "IL", lat: 41.88, lng: -87.63 },
  { name: "Little Rock", state: "AR", lat: 34.75, lng: -92.29 },
  { name: "Memphis", state: "TN", lat: 35.15, lng: -90.05 },
  { name: "Nashville", state: "TN", lat: 36.16, lng: -86.78 },
  { name: "Louisville", state: "KY", lat: 38.25, lng: -85.76 },
  { name: "Indianapolis", state: "IN", lat: 39.77, lng: -86.16 },
  { name: "Cincinnati", state: "OH", lat: 39.10, lng: -84.51 },
  { name: "Birmingham", state: "AL", lat: 33.52, lng: -86.80 },
  { name: "Atlanta", state: "GA", lat: 33.75, lng: -84.39 },
  { name: "Charlotte", state: "NC", lat: 35.23, lng: -80.84 },
  { name: "Jackson", state: "MS", lat: 32.30, lng: -90.18 },
  { name: "Jacksonville", state: "FL", lat: 30.33, lng: -81.65 },
];
function regionLabel(lng: number, lat: number): string {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return "MRMS event";
  let best = METROS[0];
  let bestDist = Number.POSITIVE_INFINITY;
  const MPD = 69.0;
  for (const m of METROS) {
    const dLat = (lat - m.lat) * MPD;
    const meanLat = ((lat + m.lat) / 2) * (Math.PI / 180);
    const dLng = (lng - m.lng) * MPD * Math.cos(meanLat);
    const d = Math.sqrt(dLat * dLat + dLng * dLng);
    if (d < bestDist) { bestDist = d; best = m; }
  }
  return `${best.name}, ${best.state}`;
}

function adaptApiStorm(s: ApiStorm): MobileStorm {
  const [lng, lat] = s.centroid?.coordinates ?? [0, 0];
  const ageMs = Date.now() - new Date(s.start_time).getTime();
  return {
    id: s.id,
    city: regionLabel(lng, lat),
    centroid_lat: lat,
    centroid_lng: lng,
    peak_size_in: s.max_hail_size_in,
    start_time: s.start_time,
    end_time: s.end_time,
    is_live: ageMs >= 0 && ageMs < 2 * 60 * 60 * 1000,
  };
}

/** Band polygons across all radar storms → one FeatureCollection, smallest
 *  first so larger-hail bands stack on top. SPC-LSR rows are point reports
 *  (placeholder boxes), excluded — they belong on a markers layer. */
function buildSwathFC(apiStorms: ApiStorm[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const s of apiStorms) {
    if (s.source === "SPC-LSR") continue;
    for (const sw of s.swaths ?? []) {
      if (!sw.geometry) continue;
      features.push({
        type: "Feature",
        geometry: sw.geometry as GeoJSON.Geometry,
        properties: {
          storm_id: s.id,
          min_size_in: catToMin(sw.hail_size_category),
          suspect: s.suspect ? 1 : 0,
        },
      });
    }
  }
  features.sort(
    (a, b) =>
      (Number(a.properties?.min_size_in) || 0) -
      (Number(b.properties?.min_size_in) || 0),
  );
  return { type: "FeatureCollection", features };
}

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

interface UseStormsState {
  storms: MobileStorm[];
  swaths: GeoJSON.FeatureCollection;
  isLoading: boolean;
  error: Error | null;
}

export function useStorms(opts?: {
  bbox?: [number, number, number, number];
  daysBack?: number;
  limit?: number;
  includeSwaths?: boolean;
}): UseStormsState & { refresh: () => Promise<void> } {
  const bbox = opts?.bbox ?? ([-125, 24, -66, 50] as [number, number, number, number]);
  const daysBack = opts?.daysBack ?? 30;
  const limit = opts?.limit ?? 50;
  const includeSwaths = opts?.includeSwaths ?? false;

  const [state, setState] = useState<UseStormsState>({
    storms: [],
    swaths: EMPTY_FC,
    isLoading: true,
    error: null,
  });

  const fetchStorms = async () => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const to = new Date();
      const from = new Date(to.getTime() - daysBack * 86_400_000);
      const qs = new URLSearchParams({
        bbox: bbox.join(","),
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
        limit: String(limit),
        include_unconfirmed: "true",
      });
      if (includeSwaths) {
        qs.set("include", "swaths");
        qs.set("simplify", "0.01");
      }
      const data = await apiRequest<ApiStormsListResponse>(`/v1/storms?${qs}`);
      setState({
        storms: data.storms.map(adaptApiStorm),
        swaths: includeSwaths ? buildSwathFC(data.storms) : EMPTY_FC,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      // Honest failure — empty, not fabricated. The screens show a calm
      // empty/offline state rather than fake storms.
      setState({
        storms: [],
        swaths: EMPTY_FC,
        isLoading: false,
        error: err instanceof Error ? err : new Error(String(err)),
      });
    }
  };

  useEffect(() => {
    void fetchStorms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bbox.join(","), daysBack, limit, includeSwaths]);

  return { ...state, refresh: fetchStorms };
}
