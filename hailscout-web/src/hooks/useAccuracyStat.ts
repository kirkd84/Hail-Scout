"use client";

import useSWR from "swr";
import { apiClient } from "@/lib/api";

export interface AccuracyStat {
  /** Null until the verified-pair sample is large enough to publish. */
  headline: string | null;
  confirmed_events: number;
  sample_size: number;
  within_quarter_inch: number | null;
  within_half_inch: number | null;
  detection_rate: number | null;
  mae_in: number | null;
  correlation: number | null;
  confirmed_pairs: number;
  min_size_in: number;
}

/**
 * Public, no-auth accuracy stat (Phase 24). Measured radar-vs-ground-truth
 * agreement, surfaced as a credibility line on the claim page. Cheap to
 * poll; the API returns a null headline when the sample is too small,
 * and the UI simply hides the line in that case.
 */
export function useAccuracyStat() {
  const { data } = useSWR<AccuracyStat>(
    "/v1/public/accuracy",
    (url: string) => apiClient.get<AccuracyStat>(url),
    { revalidateOnFocus: false, dedupingInterval: 600_000, shouldRetryOnError: false },
  );
  return data;
}
