"use client";

import { useCallback, useEffect, useRef } from "react";
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

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://hail-scout-production.up.railway.app";

/**
 * Polls /v1/alerts and (if available) subscribes to the /v1/alerts/stream
 * SSE endpoint so new alerts arrive instantly without a poll.
 *
 * - Fetches once via SWR for the initial list + unread count.
 * - Opens an EventSource for live updates; on each "alert" event we
 *   bump newInThisFetch and revalidate the SWR cache.
 * - Falls back gracefully — if SSE never connects, the SWR fetch with
 *   refreshInterval keeps things fresh.
 */
export function useAlerts() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const auth = isLoaded && isSignedIn === true;
  const newInThisFetchRef = useRef(0);
  const liveCountRef = useRef(0);

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

  // Subscribe to SSE
  useEffect(() => {
    if (!auth) return;
    let cancelled = false;
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = async () => {
      if (cancelled) return;
      try {
        const t = await getToken();
        if (!t) return;
        // EventSource doesn't support custom headers, so we put the token
        // in the URL. The /alerts/stream route reads ?token= as a fallback.
        const url = `${API_BASE}/v1/alerts/stream?token=${encodeURIComponent(t)}`;
        es = new EventSource(url, { withCredentials: false });

        es.addEventListener("alert", () => {
          newInThisFetchRef.current += 1;
          liveCountRef.current += 1;
          void swr.mutate();
        });

        es.onerror = () => {
          es?.close();
          es = null;
          // Reconnect with backoff
          if (!cancelled) {
            reconnectTimer = setTimeout(connect, 8000);
          }
        };
      } catch {
        // Schedule a retry
        if (!cancelled) reconnectTimer = setTimeout(connect, 8000);
      }
    };
    void connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      es?.close();
    };
  }, [auth, getToken, swr]);

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

  // Effective new-count is whichever is larger: the server's per-fetch
  // counter or our locally-incremented SSE count. We reset the local
  // count once the consumer has read it (via consumeNewCount).
  const newInThisFetch = Math.max(
    swr.data?.new_in_this_fetch ?? 0,
    newInThisFetchRef.current,
  );

  const consumeNewCount = useCallback(() => {
    newInThisFetchRef.current = 0;
  }, []);

  return {
    alerts: swr.data?.alerts ?? [],
    unreadCount: swr.data?.unread_count ?? 0,
    newInThisFetch,
    consumeNewCount,
    isLoading: !!auth && !swr.data && !swr.error,
    refresh: swr.mutate,
    markRead,
    markAllRead,
    dismiss,
  };
}
