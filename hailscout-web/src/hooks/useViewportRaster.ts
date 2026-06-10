"use client";

import useSWR from "swr";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

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
  /** Include suspect/low-confidence cells in the surface (default false). */
  includeUnconfirmed?: boolean;
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
  includeUnconfirmed = false,
}: Args) {
  // Round the bbox so small pixel-level pans don't thrash the cache.
  const key =
    enabled && bbox
      ? (() => {
          // Render a margin BEYOND the visible viewport so panning/zooming
          // stays covered by the current image while the next one loads —
          // this is what kills the "swath vanishes for a few seconds" flicker.
          const PAD = 0.45;
          const [w, s, e, n] = bbox;
          const dx = (e - w) * PAD;
          const dy = (n - s) * PAD;
          const clampLng = (v: number) => Math.max(-180, Math.min(180, v));
          const clampLat = (v: number) => Math.max(-85, Math.min(85, v));
          const padded = [
            clampLng(w - dx),
            clampLat(s - dy),
            clampLng(e + dx),
            clampLat(n + dy),
          ];
          const r = (x: number) => Math.round(x * 100) / 100;
          // Screen-resolution raster: width × devicePixelRatio, rounded to
          // 256 so window resizes don't churn the cache key. The padded
          // bbox is ~1.9× the viewport, so add headroom before capping.
          const px =
            typeof window !== "undefined"
              ? Math.min(
                  2048,
                  Math.max(
                    1024,
                    Math.round(
                      (window.innerWidth * (window.devicePixelRatio || 1) * 1.4) / 256,
                    ) * 256,
                  ),
                )
              : 1536;
          const qs = new URLSearchParams({
            bbox: padded.map(r).join(","),
            from,
            to,
            width: String(px),
          });
          if (minSize != null && minSize > 0) qs.set("min_size", String(minSize));
          if (source) qs.set("source", source);
          if (includeUnconfirmed) qs.set("include_unconfirmed", "true");
          return `/v1/storms/raster?${qs}`;
        })()
      : null;

  const { getToken } = useAuth();
  const { data, error, isLoading } = useSWR<ViewportRaster>(
    key,
    // Authenticated fetch: the API caps raster width at 1024 for anonymous
    // callers (CPU-abuse guard) — signed-in users get full retina res.
    async (url: string) => {
      const t = await getToken();
      return apiClient.get<ViewportRaster>(url, t || undefined);
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
      keepPreviousData: true,
      // Track the storms list's 2-min live refresh so the smooth surface
      // doesn't lag the cells/centroids during active weather.
      refreshInterval: 120_000,
    },
  );

  return { raster: data, error, isLoading };
}
