"use client";

import { useCallback } from "react";
import useSWR from "swr";
import { useAuth } from "@/hooks/useAuth";
import { apiClient, ApiError } from "@/lib/api";

/**
 * SMS two-factor state + actions (LOGIN-STANDARD §4 — text codes only).
 * Backs Settings → Security and the forced /mfa/enroll page. The MFA
 * status/start/verify endpoints also accept the restricted enroll-scoped
 * token, so this hook works for past-grace owners/admins too.
 */

export interface MfaStatus {
  enrolled: boolean;
  enrolled_at: string | null;
  /** Masked, e.g. "•••-•••-4567". */
  phone: string | null;
  /** False → codes are LOGGED server-side until RepLine is configured. */
  sms_configured: boolean;
  trusted_devices: number;
}

/** Human message out of an ApiError (FastAPI puts it in body.detail). */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const d = err.detail as { detail?: unknown } | null;
    if (d && typeof d.detail === "string") return d.detail;
  }
  return fallback;
}

export function useMfa() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const auth = isLoaded && isSignedIn === true;

  const swr = useSWR<MfaStatus>(
    auth ? "/v1/auth/mfa/status" : null,
    async (url: string) => {
      const t = await getToken();
      return apiClient.get<MfaStatus>(url, t || undefined);
    },
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  const call = useCallback(
    async <T>(path: string, body: unknown): Promise<T> => {
      const t = await getToken();
      return apiClient.post<T>(path, body, t || undefined);
    },
    [getToken],
  );

  /** Begin enrollment: text a code to `phone` (E.164). */
  const smsStart = useCallback(
    (phone: string) =>
      call<{ sent: boolean; phone: string }>("/v1/auth/mfa/sms/start", { phone }),
    [call],
  );

  /**
   * Confirm enrollment → one-time recovery codes. Deliberately does NOT
   * revalidate status here: the enroll flow must stay mounted to show the
   * codes exactly once — callers refresh via `refresh()` on done.
   */
  const smsVerify = useCallback(
    (code: string) =>
      call<{
        ok: boolean;
        recovery_codes: string[];
        relogin_required: boolean;
      }>("/v1/auth/mfa/sms/verify", { code }),
    [call],
  );

  /** Text a fresh code to the ENROLLED phone (for disable / regenerate). */
  const smsSend = useCallback(
    () => call<{ sent: boolean; phone: string }>("/v1/auth/mfa/sms/send", {}),
    [call],
  );

  const disable = useCallback(
    async (code: string) => {
      const res = await call<{ ok: boolean }>("/v1/auth/mfa/disable", { code });
      await swr.mutate();
      return res;
    },
    [call, swr],
  );

  const regenerateRecovery = useCallback(
    (code: string) =>
      call<{ recovery_codes: string[] }>("/v1/auth/mfa/recovery/regenerate", {
        code,
      }),
    [call],
  );

  const forgetTrustedDevices = useCallback(async () => {
    const res = await call<{ ok: boolean }>("/v1/auth/mfa/trusted-devices/forget", {});
    await swr.mutate();
    return res;
  }, [call, swr]);

  return {
    status: swr.data ?? null,
    isLoading: !!auth && !swr.data && !swr.error,
    refresh: swr.mutate,
    smsStart,
    smsVerify,
    smsSend,
    disable,
    regenerateRecovery,
    forgetTrustedDevices,
  };
}
