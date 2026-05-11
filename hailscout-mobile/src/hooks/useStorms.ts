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

/** Cardinal-ish region label from a CONUS centroid. */
function regionLabel(lng: number, lat: number): string {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return "MRMS event";
  // Rough Plains / Midwest / South / Northeast / West buckets — good enough
  // for at-a-glance scanning. Per-cell clustering would replace this.
  let ns = "";
  if (lat >= 41) ns = "Northern";
  else if (lat >= 36) ns = "Central";
  else ns = "Southern";
  let ew = "";
  if (lng <= -105) ew = "Rockies";
  else if (lng <= -95) ew = "Plains";
  else if (lng <= -85) ew = "Midwest";
  else ew = "East";
  return `${ns} ${ew}`;
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
