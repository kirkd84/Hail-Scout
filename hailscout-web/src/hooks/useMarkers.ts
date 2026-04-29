"use client";

import { useEffect, useState, useCallback } from "react";
import { markersStore, type Marker, type MarkerStatus } from "@/lib/markers";

const KEY = "hs.markers.v1";

/**
 * Reactive hook around the localStorage-backed marker store.
 * Listens for `storage` events so multi-tab edits stay in sync.
 */
export function useMarkers() {
  const [markers, setMarkers] = useState<Marker[]>([]);

  const reload = useCallback(() => setMarkers(markersStore.list()), []);

  useEffect(() => {
    reload();
    const handler = (e: StorageEvent) => {
      if (e.key === null || e.key === KEY) reload();
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [reload]);

  const add = useCallback(
    (input: { lng: number; lat: number; status?: MarkerStatus; notes?: string }) => {
      const m = markersStore.add({
        lng: input.lng,
        lat: input.lat,
        status: input.status ?? "lead",
        notes: input.notes,
      });
      reload();
      return m;
    },
    [reload],
  );

  const update = useCallback(
    (id: string, patch: Partial<Pick<Marker, "status" | "notes">>) => {
      markersStore.update(id, patch);
      reload();
    },
    [reload],
  );

  const remove = useCallback(
    (id: string) => {
      markersStore.remove(id);
      reload();
    },
    [reload],
  );

  const clear = useCallback(() => {
    markersStore.clear();
    reload();
  }, [reload]);

  return { markers, add, update, remove, clear };
}
