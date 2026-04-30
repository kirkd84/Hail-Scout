"use client";

import { useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import useSWR from "swr";
import { apiClient } from "@/lib/api";

export interface StormAlert {
  id: number;
  storm_id: string;
  storm_city: string | null;
  peak_size_in: number;
  storm_started_at: string;
  read_at: string | null;
  dismissed_at: string | null;
  created_at: string;
  address: string | null;
  address_label: string | null;
  monitored_address_id: number;
}

interface AlertsResponse {
  alerts: StormAlert[];
  unread_count: number;
  new_in_this_fetch: number;
}

/**
 * Polls /v1/alerts every 60s when signed in. Returns the live list,
 * unread counter, and mutation helpers (markRead / markAllRead / dismiss).
 *
 * Returns empty state when not signed in — alerts require server-side
 * generation against monitored addresses.
 */
export function useAlerts() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const auth = isLoaded && isSignedIn === true;

  const swr = useSWR<AlertsResponse>(
    auth ? "/v1/alerts" : null,
    async (url: string) => {
      const t = await getToken();
      return apiClient.get<AlertsResponse>(url, t || undefined);
    },
    {
      refreshInterval: 60_000,
      revalidateOnFocus: true,
      shouldRetryOnError: false,
    },
  );

  const markRead = useCallback(
    async (id: number) => {
      if (!auth) return;
      const t = await getToken();
      await apiClient.post(`/v1/alerts/${id}/read`, {}, t || undefined);
      await swr.mutate();
    },
    [auth, getToken, swr],
  );

  const markAllRead = useCallback(async () => {
    if (!auth) return;
    const t = await getToken();
    await apiClient.post(`/v1/alerts/read-all`, {}, t || undefined);
    await swr.mutate();
  }, [auth, getToken, swr]);

  const dismiss = useCallback(
    async (id: number) => {
      if (!auth) return;
      const t = await getToken();
      await apiClient.delete(`/v1/alerts/${id}`, t || undefined);
      await swr.mutate();
    },
    [auth, getToken, swr],
  );

  return {
    alerts: swr.data?.alerts ?? [],
    unreadCount: swr.data?.unread_count ?? 0,
    newInThisFetch: swr.data?.new_in_this_fetch ?? 0,
    isLoading: !!auth && !swr.data && !swr.error,
    refresh: swr.mutate,
    markRead,
    markAllRead,
    dismiss,
  };
}
