"use client";

import { useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import useSWR from "swr";
import { apiClient } from "@/lib/api";

export interface SlackConfig {
  org_id: string;
  enabled: boolean;
  /** A masked variant the API returns; never the plaintext. */
  webhook_masked: string | null;
}

export function useSlackConfig() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const auth = isLoaded && isSignedIn === true;

  const swr = useSWR<SlackConfig>(
    auth ? "/v1/integrations/slack" : null,
    async (url: string) => {
      const t = await getToken();
      return apiClient.get<SlackConfig>(url, t || undefined);
    },
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  const update = useCallback(
    async (patch: { webhook_url?: string | null; enabled?: boolean }) => {
      if (!auth) return;
      const t = await getToken();
      const next = await apiClient.patch<SlackConfig>(
        "/v1/integrations/slack",
        patch,
        t || undefined,
      );
      await swr.mutate(next);
      return next;
    },
    [auth, getToken, swr],
  );

  const test = useCallback(async () => {
    if (!auth) return { ok: false };
    const t = await getToken();
    return apiClient.post<{ ok: boolean }>(
      "/v1/integrations/slack/test",
      {},
      t || undefined,
    );
  }, [auth, getToken]);

  return { config: swr.data, update, test };
}
