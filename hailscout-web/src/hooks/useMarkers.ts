"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import useSWR from "swr";
import { apiClient } from "@/lib/api";
import { markersStore, type Marker, type MarkerStatus } from "@/lib/markers";

const LOCAL_KEY = "hs.markers.v1";
const MIGRATED_KEY = "hs.markers.migrated.v1";

interface MarkerApi {
  id: string;
  lat: number | null;
  lng: number | null;
  status: string;
  notes: string | null;
  client_id: string | null;
  created_at: string;
  updated_at: string;
}

function adaptMarker(api: MarkerApi): Marker {
  return {
    id: api.id,
    lat: api.lat ?? 0,
    lng: api.lng ?? 0,
    status: api.status as MarkerStatus,
    notes: api.notes ?? undefined,
    created_at: api.created_at,
    updated_at: api.updated_at,
  };
}

/**
 * Reactive markers hook.
 *
 * When signed in: SWR-cached fetch of `/v1/markers`. Mutations call the API
 * and revalidate. On first sign-in, any rows in localStorage are bulk-pushed
 * to the API so the user keeps anything they dropped pre-auth.
 *
 * When not signed in: falls back to the localStorage store (the original
 * behaviour from when this hook shipped).
 */
export function useMarkers() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const auth = isLoaded && isSignedIn === true;

  const swr = useSWR<MarkerApi[]>(
    auth ? "/v1/markers" : null,
    async (url: string) => {
      const t = await getToken();
      return apiClient.get<MarkerApi[]>(url, t || undefined);
    },
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  // Local fallback (anonymous users)
  const [local, setLocal] = useState<Marker[]>([]);
  const reloadLocal = useCallback(() => setLocal(markersStore.list()), []);
  useEffect(() => {
    if (!auth) reloadLocal();
  }, [auth, reloadLocal]);
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (!auth && (e.key === null || e.key === LOCAL_KEY)) reloadLocal();
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [auth, reloadLocal]);

  // One-time migration of localStorage rows on first sign-in
  useEffect(() => {
    if (!auth) return;
    if (typeof window === "undefined") return;
    if (localStorage.getItem(MIGRATED_KEY) === "1") return;

    const localRows = markersStore.list();
    if (localRows.length === 0) {
      localStorage.setItem(MIGRATED_KEY, "1");
      return;
    }
    (async () => {
      try {
        const t = await getToken();
        await apiClient.post(
          "/v1/markers/bulk",
          {
            markers: localRows.map((m) => ({
              client_id: m.id,
              lat: m.lat,
              lng: m.lng,
              status: m.status,
              notes: m.notes,
            })),
          },
          t || undefined,
        );
        localStorage.setItem(MIGRATED_KEY, "1");
        await swr.mutate();
      } catch {
        // Try again on next mount
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth]);

  const apiMarkers: Marker[] = (swr.data ?? []).map(adaptMarker);
  const markers = auth ? apiMarkers : local;

  const add = useCallback(
    async (input: { lng: number; lat: number; status?: MarkerStatus; notes?: string }): Promise<Marker> => {
      if (auth) {
        const t = await getToken();
        const created = await apiClient.post<MarkerApi>(
          "/v1/markers",
          {
            lat: input.lat,
            lng: input.lng,
            status: input.status ?? "lead",
            notes: input.notes,
          },
          t || undefined,
        );
        await swr.mutate();
        return adaptMarker(created);
      }
      const m = markersStore.add({
        lng: input.lng,
        lat: input.lat,
        status: input.status ?? "lead",
        notes: input.notes,
      });
      reloadLocal();
      return m;
    },
    [auth, getToken, swr, reloadLocal],
  );

  const update = useCallback(
    async (id: string, patch: Partial<Pick<Marker, "status" | "notes">>) => {
      if (auth) {
        const t = await getToken();
        await apiClient.patch(`/v1/markers/${id}`, patch, t || undefined);
        await swr.mutate();
      } else {
        markersStore.update(id, patch);
        reloadLocal();
      }
    },
    [auth, getToken, swr, reloadLocal],
  );

  const remove = useCallback(
    async (id: string) => {
      if (auth) {
        const t = await getToken();
        await apiClient.delete(`/v1/markers/${id}`, t || undefined);
        await swr.mutate();
      } else {
        markersStore.remove(id);
        reloadLocal();
      }
    },
    [auth, getToken, swr, reloadLocal],
  );

  const clear = useCallback(async () => {
    if (auth) {
      const t = await getToken();
      const all = swr.data ?? [];
      await Promise.all(
        all.map((m) =>
          apiClient.delete(`/v1/markers/${m.id}`, t || undefined).catch(() => null),
        ),
      );
      await swr.mutate();
    } else {
      markersStore.clear();
      reloadLocal();
    }
  }, [auth, getToken, swr, reloadLocal]);

  return { markers, add, update, remove, clear };
}
