"use client";

import useSWR from "swr";
import { apiClient } from "@/lib/api";

export interface AreaExposure {
  available: boolean;
  area_name: string | null;
  county_name: string | null;
  population: number | null;
  housing_units: number | null;
  median_home_value: number | null;
  median_household_income: number | null;
  note: string | null;
}

/**
 * Area demographics for a point (Phase 28) — the lead-prospecting layer.
 * Population / households / home value / income for the neighborhood,
 * from free US Census data. No-auth, cached hard (demographics are
 * near-static). Returns undefined while loading; the panel hides itself
 * when there's nothing meaningful to show.
 */
export function useExposure(lat?: number | null, lng?: number | null) {
  const key =
    lat != null && lng != null
      ? `/v1/public/exposure?lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}`
      : null;
  const { data } = useSWR<AreaExposure>(
    key,
    (url: string) => apiClient.get<AreaExposure>(url),
    { revalidateOnFocus: false, dedupingInterval: 600_000, shouldRetryOnError: false },
  );
  return data;
}
