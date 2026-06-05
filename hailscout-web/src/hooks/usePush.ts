"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import useSWR from "swr";
import { apiClient } from "@/lib/api";

export interface PushConfig {
  org_id: string;
  enabled: boolean;
  configured: boolean;
  vapid_public_key: string | null;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Web-push settings: the org-level toggle + this device's subscription state.
 * Subscribing prompts for notification permission, registers with the service
 * worker's PushManager, and stores the subscription server-side.
 */
export function usePush() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const auth = isLoaded && isSignedIn === true;

  const swr = useSWR<PushConfig>(
    auth ? "/v1/integrations/push" : null,
    async (url: string) => {
      const t = await getToken();
      return apiClient.get<PushConfig>(url, t || undefined);
    },
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  const [supported, setSupported] = useState(false);
  const [subscribedHere, setSubscribedHere] = useState(false);

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window;
    setSupported(ok);
    if (!ok) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribedHere(!!sub))
      .catch(() => {});
  }, []);

  const setEnabled = useCallback(
    async (enabled: boolean) => {
      if (!auth) return;
      const t = await getToken();
      const next = await apiClient.patch<PushConfig>(
        "/v1/integrations/push",
        { enabled },
        t || undefined,
      );
      await swr.mutate(next);
      return next;
    },
    [auth, getToken, swr],
  );

  const subscribeHere = useCallback(async () => {
    if (!supported) throw new Error("Push isn't supported on this device.");
    const key = swr.data?.vapid_public_key;
    if (!key) throw new Error("Push isn't configured on the server yet.");
    const perm = await Notification.requestPermission();
    if (perm !== "granted") throw new Error("Notification permission was denied.");
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
    });
    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      throw new Error("Subscription was incomplete.");
    }
    const t = await getToken();
    await apiClient.post(
      "/v1/integrations/push/subscribe",
      { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth },
      t || undefined,
    );
    setSubscribedHere(true);
  }, [supported, swr.data, getToken]);

  const unsubscribeHere = useCallback(async () => {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      const t = await getToken();
      try {
        await apiClient.post("/v1/integrations/push/unsubscribe", { endpoint }, t || undefined);
      } catch {
        /* best-effort */
      }
    }
    setSubscribedHere(false);
  }, [getToken]);

  const test = useCallback(async () => {
    const t = await getToken();
    return apiClient.post<{ ok: boolean; sent: number }>(
      "/v1/integrations/push/test",
      {},
      t || undefined,
    );
  }, [getToken]);

  return {
    config: swr.data,
    supported,
    subscribedHere,
    setEnabled,
    subscribeHere,
    unsubscribeHere,
    test,
  };
}
