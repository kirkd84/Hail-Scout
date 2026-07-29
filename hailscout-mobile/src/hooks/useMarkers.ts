/**
 * Canvassing markers — mobile client for `/v1/markers`.
 *
 * The mirror of the web app's useMarkers. Markers are stored server-side and
 * scoped to the org, so a pin dropped from the truck appears on the web map
 * (and vice-versa) — the sync the Settings screen advertises.
 *
 * Auth is required: without a token we hold an empty list rather than a
 * local cache, so we never show pins that aren't really saved.
 */

import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { useAuthToken } from "@/hooks/useAuthToken";
import type { Marker, MarkerStatus } from "@/lib/markers";

interface MarkerApi {
  id: string;
  lat: number | null;
  lng: number | null;
  status: string;
  notes: string | null;
  assignee_user_id: string | null;
  created_at: string;
  updated_at: string;
}

function adapt(api: MarkerApi): Marker {
  return {
    id: api.id,
    lat: api.lat ?? 0,
    lng: api.lng ?? 0,
    status: api.status as MarkerStatus,
    notes: api.notes ?? undefined,
    assignee_user_id: api.assignee_user_id,
    created_at: api.created_at,
    updated_at: api.updated_at,
  };
}

export function useMarkers() {
  const { token } = useAuthToken();
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      const t = await token();
      if (!t) {
        setMarkers([]);
        setIsLoading(false);
        return;
      }
      const rows = await apiRequest<MarkerApi[]>("/v1/markers", { token: t });
      setMarkers(rows.map(adapt));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const add = useCallback(
    async (input: {
      lng: number;
      lat: number;
      status?: MarkerStatus;
      notes?: string;
    }): Promise<Marker> => {
      const t = await token();
      if (!t) throw new Error("Sign in to drop pins.");
      const created = await apiRequest<MarkerApi>("/v1/markers", {
        method: "POST",
        token: t,
        body: JSON.stringify({
          lat: input.lat,
          lng: input.lng,
          status: input.status ?? "lead",
          notes: input.notes,
        }),
      });
      const m = adapt(created);
      setMarkers((prev) => [...prev, m]);
      return m;
    },
    [token],
  );

  const update = useCallback(
    async (id: string, patch: { status?: MarkerStatus; notes?: string }) => {
      const t = await token();
      if (!t) throw new Error("Sign in to edit pins.");
      const saved = await apiRequest<MarkerApi>(`/v1/markers/${id}`, {
        method: "PATCH",
        token: t,
        body: JSON.stringify(patch),
      });
      const m = adapt(saved);
      setMarkers((prev) => prev.map((x) => (x.id === id ? m : x)));
      return m;
    },
    [token],
  );

  const remove = useCallback(
    async (id: string) => {
      const t = await token();
      if (!t) throw new Error("Sign in to remove pins.");
      await apiRequest<unknown>(`/v1/markers/${id}`, { method: "DELETE", token: t });
      setMarkers((prev) => prev.filter((x) => x.id !== id));
    },
    [token],
  );

  return { markers, isLoading, error, refresh, add, update, remove };
}
