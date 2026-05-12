/**
 * useStorms — mobile-side storm fetcher backed by the live API.
 *
 * Mirrors the web hook (hailscout-web/src/hooks/useStorms.ts) but trims
 * to what HomeScreen needs:
 *   - List of recent storms across CONUS
 *   - "live" tagging for events that started in the last 2 hours
 *
 * Returns the same MobileStorm shape the screen used to import from
 * lib/storm-fixtures.ts so the call site only changes its import.
 *
 * The /v1/storms endpoint is public — no token needed.
 */

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import type { MobileStorm } from "@/lib/storm-fixtures";
import { STORMS as FIXTURE_STORMS } from "@/lib/storm-fixtures";

interface ApiStorm {
  id: string;
  start_time: string;
  end_time: string;
  max_hail_size_in: number;
  source: string;
  centroid: { type: "Point"; coordinates: [number, number] } | null;
  bbox: unknown;
}

interface ApiStormsListResponse {
  storms: ApiStorm[];
  cursor: string | null;
  total: number;
}

/**
 * Nearest-metro label. Inlined small lookup of major US metros so we
 * don't need a runtime geocode call. Always returns the closest one
 * (no distance cutoff), to match the web app's behavior.
 */
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
  const MILES_PER_DEG = 69.0;
  for (const m of METROS) {
    const dLat = (lat - m.lat) * MILES_PER_DEG;
    const meanLatRad = ((lat + m.lat) / 2) * (Math.PI / 180);
    const dLng = (lng - m.lng) * MILES_PER_DEG * Math.cos(meanLatRad);
    const d = Math.sqrt(dLat * dLat + dLng * dLng);
    if (d < bestDist) { bestDist = d; best = m; }
  }
  return `${best.name}, ${best.state}`;
}

function adaptApiStorm(s: ApiStorm): MobileStorm {
  const [lng, lat] = s.centroid?.coordinates ?? [0, 0];
  const startMs = new Date(s.start_time).getTime();
  const ageMs = Date.now() - startMs;
  return {
    id: s.id,
    city: regionLabel(lng, lat),
    centroid_lat: lat,
    centroid_lng: lng,
    peak_size_in: s.max_hail_size_in,
    start_time: s.start_time,
    end_time: s.end_time,
    is_live: ageMs >= 0 && ageMs < 2 * 60 * 60 * 1000, // last 2 hours
  };
}

interface UseStormsState {
  storms: MobileStorm[];
  isLoading: boolean;
  error: Error | null;
  usingFallback: boolean;
}

/**
 * Fetches storms over a CONUS-wide bbox spanning the last 30 days by
 * default. Pull-to-refresh callers can call `refresh()` to re-trigger.
 */
export function useStorms(opts?: {
  bbox?: [number, number, number, number];
  daysBack?: number;
  limit?: number;
}): UseStormsState & { refresh: () => Promise<void> } {
  const bbox = opts?.bbox ?? ([-125, 24, -66, 50] as [number, number, number, number]);
  const daysBack = opts?.daysBack ?? 30;
  const limit = opts?.limit ?? 50;

  const [state, setState] = useState<UseStormsState>({
    storms: [],
    isLoading: true,
    error: null,
    usingFallback: false,
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
      });
      const data = await apiRequest<ApiStormsListResponse>(`/v1/storms?${qs}`);
      const mapped = data.storms.map(adaptApiStorm);
      if (mapped.length === 0) {
        // Fall back to fixtures so a quiet API doesn't leave a blank screen.
        setState({ storms: FIXTURE_STORMS, isLoading: false, error: null, usingFallback: true });
      } else {
        setState({ storms: mapped, isLoading: false, error: null, usingFallback: false });
      }
    } catch (err) {
      // Network / API error → fixture fallback, so the demo keeps working.
      setState({
        storms: FIXTURE_STORMS,
        isLoading: false,
        error: err instanceof Error ? err : new Error(String(err)),
        usingFallback: true,
      });
    }
  };

  useEffect(() => {
    void fetchStorms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bbox.join(","), daysBack, limit]);

  return {
    ...state,
    refresh: fetchStorms,
  };
}
