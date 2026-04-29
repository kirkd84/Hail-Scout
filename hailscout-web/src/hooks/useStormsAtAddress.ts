"use client";

import { useAuth } from "@clerk/nextjs";
import useSWR from "swr";
import { apiClient } from "@/lib/api";
import type { HailAtAddressResponse } from "@/lib/api-types";
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
  // Fixture city fallback — match against city names in the address text
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
 * Storm-at-address hook.
 *
 * Strategy:
 *  1. Try the API (`/v1/hail-at-address?address=...`) — production path
 *  2. On 401/404/network error, fall back to client-side geocode +
 *     fixture polygon hit-test so the demo still works pre-data-pipeline
 */
export function useStormsAtAddress(
  address?: string,
  options?: { lat?: number; lng?: number },
) {
  const { getToken } = useAuth();

  const queryParams = new URLSearchParams();
  if (address) queryParams.append("address", address);
  if (options?.lat !== undefined && options?.lng !== undefined) {
    queryParams.append("lat", options.lat.toString());
    queryParams.append("lng", options.lng.toString());
  }

  const endpoint = queryParams.toString()
    ? `/v1/hail-at-address?${queryParams}`
    : null;

  const { data, error, isLoading, mutate } = useSWR<HailAtAddressResponse>(
    endpoint,
    async (url: string) => {
      const token = await getToken();
      try {
        return await apiClient.get<HailAtAddressResponse>(url, token || undefined);
      } catch (apiErr) {
        // Fixture fallback — lets the demo work pre-data-pipeline.
        if (!address) throw apiErr;
        const geo = await geocode(address);
        if (!geo) throw apiErr;
        const hits = fixturesAtPoint(geo.lng, geo.lat);
        return {
          lat: geo.lat,
          lng: geo.lng,
          address: geo.pretty,
          storms: hits,
          events: [],
        };
      }
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
      shouldRetryOnError: false,
    },
  );

  return { data, isLoading, error, mutate };
}
