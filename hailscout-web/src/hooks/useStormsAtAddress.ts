"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { apiClient } from "@/lib/api";
import type { HailAtAddressResponse, Verification } from "@/lib/api-types";
import { fixturesAtPoint, STORM_FIXTURES } from "@/lib/storm-fixtures";

/**
 * Geocode a free-text address to lat/lng using MapTiler's geocoder if a
 * key is present, otherwise fall back to a tiny lookup table of known
 * fixture cities. Pure browser-side fetch.
 */
async function geocode(address: string): Promise<{ lat: number; lng: number; pretty: string } | null> {
  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  if (key) {
    try {
      const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(address)}.json?key=${key}&country=us&limit=1`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`geocode ${res.status}`);
      const json = await res.json();
      const feat = json?.features?.[0];
      if (feat?.center && Array.isArray(feat.center)) {
        const [lng, lat] = feat.center as [number, number];
        return { lng, lat, pretty: feat.place_name || address };
      }
    } catch {
      // fall through to fixture fallback
    }
  }
  const lower = address.toLowerCase();
  for (const f of STORM_FIXTURES) {
    const cityKey = f.city.split(",")[0].toLowerCase();
    if (lower.includes(cityKey)) {
      return { lat: f.centroid_lat + 0.02, lng: f.centroid_lng + 0.02, pretty: `${address} (≈ ${f.city})` };
    }
  }
  return null;
}

/**
 * /v1/storms/at-point response shape (live API).
 */
interface ApiHailAtPointHit {
  id: string;
  start_time: string;
  end_time: string;
  max_hail_size_in: number;
  source: string;
  category_at_point: string;
  size_at_point?: number | null;
  lsr_confirmed?: boolean;
  lsr_observed_size_in?: number | null;
  hail_confirmed?: boolean;
  peak_dbz?: number | null;
  confidence?: number;
  suspect?: boolean;
  verification?: Verification;
}
interface ApiHailAtPointListResponse {
  lat: number;
  lng: number;
  hits: ApiHailAtPointHit[];
  total: number;
}

/**
 * Adapt the at-point hit shape to the legacy Storm shape so the existing
 * UI (address-search.tsx, map page) doesn't need to change at the seam.
 * Centroid + bbox aren't returned by /v1/storms/at-point — we use the
 * query point itself as a placeholder; consumers that need precise
 * geometry should call useStormDetail(id) instead.
 */
function hitToStormShape(hit: ApiHailAtPointHit, lat: number, lng: number) {
  // For an address lookup, the Storm object represents "this storm AT
  // this point", so its headline size is the size that fell HERE
  // (size_at_point), not the storm's peak miles away. We keep the
  // global peak in `storm_peak_size_in` for optional context.
  const atPoint = hit.size_at_point ?? hit.max_hail_size_in;
  return {
    id: hit.id,
    start_time: hit.start_time,
    end_time: hit.end_time,
    max_hail_size_in: atPoint,
    storm_peak_size_in: hit.max_hail_size_in,
    size_at_point: hit.size_at_point ?? null,
    centroid_lat: lat,
    centroid_lng: lng,
    bbox: { min_lat: lat - 0.01, min_lng: lng - 0.01, max_lat: lat + 0.01, max_lng: lng + 0.01 },
    source: hit.source,
    // Carry the multi-source verification through to the result card +
    // the report. Present on live API hits; absent on fixture fallback.
    lsr_confirmed: hit.lsr_confirmed,
    hail_confirmed: hit.hail_confirmed,
    peak_dbz: hit.peak_dbz,
    confidence: hit.confidence,
    suspect: hit.suspect,
    verification: hit.verification,
  };
}

/**
 * Storm-at-address hook (Phase 16.8 migration).
 *
 * Old behavior: called /v1/hail-at-address (legacy, response-shape
 * mismatched with the web's local type — silently broken once data
 * landed).
 *
 * New behavior:
 *   1. Geocode address → lat/lng (MapTiler or fixture fallback)
 *   2. Call /v1/storms/at-point?lat=&lng= (the live endpoint)
 *   3. If the API returns no hits, fall back to fixture polygon
 *      hit-test so the demo still works without crashing
 *
 * Returns the legacy `HailAtAddressResponse` shape so existing
 * consumers (address-search, map page) keep working.
 */
export function useStormsAtAddress(
  address?: string,
  options?: { lat?: number; lng?: number },
) {
  const { getToken } = useAuth();
  const [resolved, setResolved] = useState<{ lat: number; lng: number; pretty: string } | null>(null);
  const [resolveError, setResolveError] = useState<Error | null>(null);

  // Resolve the (lat,lng) for either an address or explicit coords.
  useEffect(() => {
    let cancelled = false;
    setResolveError(null);
    if (options?.lat !== undefined && options?.lng !== undefined) {
      setResolved({ lat: options.lat, lng: options.lng, pretty: address ?? `${options.lat}, ${options.lng}` });
      return;
    }
    if (!address) {
      setResolved(null);
      return;
    }
    void (async () => {
      const g = await geocode(address);
      if (cancelled) return;
      if (!g) {
        setResolved(null);
        setResolveError(new Error(`Could not geocode "${address}"`));
        return;
      }
      setResolved(g);
    })();
    return () => {
      cancelled = true;
    };
  }, [address, options?.lat, options?.lng]);

  // Hit the live at-point endpoint once we have a resolved lat/lng.
  const qs = resolved
    ? new URLSearchParams({ lat: String(resolved.lat), lng: String(resolved.lng) })
    : null;
  const swrKey = qs ? `/v1/storms/at-point?${qs}` : null;
  const { data, error, isLoading, mutate } = useSWR<ApiHailAtPointListResponse>(
    swrKey,
    async (url: string) => {
      const token = await getToken();
      return apiClient.get<ApiHailAtPointListResponse>(url, token || undefined);
    },
    { revalidateOnFocus: false, dedupingInterval: 60_000, shouldRetryOnError: false },
  );

  // Compose the legacy HailAtAddressResponse shape from (resolved, data).
  let response: HailAtAddressResponse | undefined = undefined;
  if (resolved) {
    const apiHits = data?.hits ?? [];
    if (apiHits.length > 0) {
      response = {
        lat: resolved.lat,
        lng: resolved.lng,
        address: resolved.pretty,
        storms: apiHits.map((h) => hitToStormShape(h, resolved.lat, resolved.lng)),
        events: [],
      };
    } else if (!isLoading) {
      // No live hits → fall back to fixture polygon hit-test so the
      // demo isn't blank during the pre-data window.
      const fixtureHits = fixturesAtPoint(resolved.lng, resolved.lat);
      response = {
        lat: resolved.lat,
        lng: resolved.lng,
        address: resolved.pretty,
        storms: fixtureHits,
        events: [],
      };
    }
  }

  return {
    data: response,
    isLoading: isLoading || (!!address && resolved === null && !resolveError),
    error: error || resolveError,
    mutate,
  };
}
