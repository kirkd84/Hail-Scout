"use client";

import { useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import useSWR from "swr";
import { apiClient } from "@/lib/api";

export interface SmsAlertsConfig {
  org_id: string;
  enabled: boolean;
  recipients: string[];
  /** Whether Twilio is configured server-side (controls UI messaging). */
  configured: boolean;
}

export interface SmsTestResult {
  ok: boolean;
  recipient_count: number;
  note?: string | null;
}

/** Org-level SMS alerts settings. Mirrors useEmailAlertsConfig. */
export function useSmsAlertsConfig() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const auth = isLoaded && isSignedIn === true;

  const swr = useSWR<SmsAlertsConfig>(
    auth ? "/v1/integrations/sms-alerts" : null,
    async (url: string) => {
      const t = await getToken();
      return apiClient.get<SmsAlertsConfig>(url, t || undefined);
    },
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  const update = useCallback(
    async (patch: { enabled?: boolean; recipients?: string[]; recipients_raw?: string }) => {
      if (!auth) return;
      const t = await getToken();
      const next = await apiClient.patch<SmsAlertsConfig>(
        "/v1/integrations/sms-alerts",
        patch,
        t || undefined,
      );
      await swr.mutate(next);
      return next;
    },
    [auth, getToken, swr],
  );

  const test = useCallback(async () => {
    if (!auth) return { ok: false, recipient_count: 0 } as SmsTestResult;
    const t = await getToken();
    return apiClient.post<SmsTestResult>(
      "/v1/integrations/sms-alerts/test",
      {},
      t || undefined,
    );
  }, [auth, getToken]);

  return { config: swr.data, update, test };
}
