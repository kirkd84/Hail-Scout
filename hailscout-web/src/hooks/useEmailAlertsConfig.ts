"use client";

import { useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import useSWR from "swr";
import { apiClient } from "@/lib/api";

export interface EmailAlertsConfig {
  org_id: string;
  enabled: boolean;
  recipients: string[];
  min_size_in: number;
}

export interface EmailAlertsTestResult {
  ok: boolean;
  recipient_count: number;
  /** Non-null when the API skipped the send (e.g. RESEND_API_KEY missing). */
  note?: string | null;
}

/**
 * Org-level email alerts settings.
 *
 * The shape mirrors useSlackConfig deliberately — both surfaces are
 * just "channel = on/off + addressee list + threshold." Future channels
 * (Teams, generic webhook) can copy this hook verbatim.
 */
export function useEmailAlertsConfig() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const auth = isLoaded && isSignedIn === true;

  const swr = useSWR<EmailAlertsConfig>(
    auth ? "/v1/integrations/email-alerts" : null,
    async (url: string) => {
      const t = await getToken();
      return apiClient.get<EmailAlertsConfig>(url, t || undefined);
    },
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  const update = useCallback(
    async (patch: {
      enabled?: boolean;
      recipients?: string[];
      recipients_raw?: string;
      min_size_in?: number;
    }) => {
      if (!auth) return;
      const t = await getToken();
      const next = await apiClient.patch<EmailAlertsConfig>(
        "/v1/integrations/email-alerts",
        patch,
        t || undefined,
      );
      await swr.mutate(next);
      return next;
    },
    [auth, getToken, swr],
  );

  const test = useCallback(async () => {
    if (!auth) return { ok: false, recipient_count: 0 };
    const t = await getToken();
    return apiClient.post<EmailAlertsTestResult>(
      "/v1/integrations/email-alerts/test",
      {},
      t || undefined,
    );
  }, [auth, getToken]);

  return { config: swr.data, update, test };
}
