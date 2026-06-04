"use client";

import useSWR from "swr";
import { apiClient } from "@/lib/api";
import type { ViewportRaster } from "@/hooks/useViewportRaster";

/**
 * Per-storm smooth raster (Phase 25). Fetches /v1/storms/{id}/raster —
 * one colorized image of a single storm's swath. Used to isolate the
 * selected storm on the map (replacing the all-storms viewport raster)
 * so "click a date → see just that swath" works. Returns undefined when
 * no storm is focused.
 */
export function useStormRaster(stormId?: string | null) {
  const key = stormId ? `/v1/storms/${stormId}/raster` : null;
  const { data } = useSWR<ViewportRaster>(
    key,
    (url: string) => apiClient.get<ViewportRaster>(url),
    { revalidateOnFocus: false, dedupingInterval: 300_000, shouldRetryOnError: false },
  );
  return data;
}
