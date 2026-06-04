"use client";

import useSWR from "swr";
import { apiClient } from "@/lib/api";

export interface ViewportRaster {
  storm_id: string;
  /** base64 PNG data URL */
  image: string;
  /** MapLibre image-source corners [TL, TR, BR, BL] as [lng, lat] */
  coordinates: [number, number][];
  width: number;
  height: number;
  peak_in: number;
}

interface Args {
  bbox: [number, number, number, number] | null; // minLng,minLat,maxLng,maxLat
  from: string;
  to: string;
  minSize?: number | null;
  source?: string | null;
  enabled?: boolean;
}

/**
 * Smooth viewport hail raster (Phase 25). Fetches one colorized image
 * covering the current map bounds — every storm's swaths burned into a
 * single continuous surface. Refetched whenever the bbox/date/filters
 * change. The map renders it as an image source with linear resampling.
 */
export function useViewportRaster({
  bbox,
  from,
  to,
  minSize = null,
  source = null,
  enabled = true,
}: Args) {
  // Round the bbox so small pixel-level pans don't thrash the cache.
  const key =
    enabled && bbox
      ? (() => {
          const r = (n: number) => Math.round(n * 100) / 100;
          const qs = new URLSearchParams({
            bbox: bbox.map(r).join(","),
            from,
            to,
          });
          if (minSize != null && minSize > 0) qs.set("min_size", String(minSize));
          if (source) qs.set("source", source);
          return `/v1/storms/raster?${qs}`;
        })()
      : null;

  const { data, error, isLoading } = useSWR<ViewportRaster>(
    key,
    (url: string) => apiClient.get<ViewportRaster>(url),
    { revalidateOnFocus: false, dedupingInterval: 30_000, keepPreviousData: true },
  );

  return { raster: data, error, isLoading };
}
