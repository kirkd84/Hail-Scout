/**
 * Hook for searching storms at a given address via the API.
 * Uses SWR for caching and automatic revalidation.
 */

"use client";

import { useAuth } from "@clerk/nextjs";
import useSWR from "swr";
import { apiClient } from "@/lib/api";
import type { HailAtAddressResponse } from "@/lib/api-types";

export function useStormsAtAddress(
  address?: string,
  options?: { lat?: number; lng?: number }
) {
  const { getToken } = useAuth();

  // Build query string
  const queryParams = new URLSearchParams();
  if (address) {
    queryParams.append("address", address);
  }
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
      return apiClient.get<HailAtAddressResponse>(url, token || undefined);
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // 1 minute
    }
  );

  return {
    data,
    isLoading,
    error,
    mutate,
  };
}
