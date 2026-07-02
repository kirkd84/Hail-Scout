"use client";

import { useCallback } from "react";
import useSWR from "swr";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

export type ZoneKind = "radius" | "states" | "nationwide";

export interface AlertZone {
  id: string;
  org_id: string;
  user_id: string;
  name: string;
  kind: ZoneKind;
  center_lat: number | null;
  center_lng: number | null;
  radius_mi: number | null;
  states: string[] | null;
  min_hail_in: number | null;
  min_wind_mph: number | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface AlertZoneInput {
  name: string;
  kind: ZoneKind;
  center_lat?: number | null;
  center_lng?: number | null;
  radius_mi?: number | null;
  states?: string[] | null;
  min_hail_in?: number | null;
  min_wind_mph?: number | null;
  enabled?: boolean;
}

/** CRUD over /v1/alert-zones — the signed-in user's alarm zones. */
export function useAlertZones() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const auth = isLoaded && isSignedIn === true;

  const swr = useSWR<AlertZone[]>(
    auth ? "/v1/alert-zones" : null,
    async (url: string) => {
      const t = await getToken();
      return apiClient.get<AlertZone[]>(url, t || undefined);
    },
    { revalidateOnFocus: false, dedupingInterval: 30_000 },
  );

  const create = useCallback(
    async (body: AlertZoneInput) => {
      const t = await getToken();
      const zone = await apiClient.post<AlertZone>(
        "/v1/alert-zones", body, t || undefined,
      );
      await swr.mutate();
      return zone;
    },
    [getToken, swr],
  );

  const update = useCallback(
    async (id: string, patch: Partial<AlertZoneInput>) => {
      const t = await getToken();
      const zone = await apiClient.patch<AlertZone>(
        `/v1/alert-zones/${id}`, patch, t || undefined,
      );
      await swr.mutate();
      return zone;
    },
    [getToken, swr],
  );

  const remove = useCallback(
    async (id: string) => {
      const t = await getToken();
      await apiClient.delete(`/v1/alert-zones/${id}`, t || undefined);
      await swr.mutate();
    },
    [getToken, swr],
  );

  return {
    zones: swr.data ?? [],
    isLoading: !!auth && !swr.data && !swr.error,
    error: swr.error,
    refresh: swr.mutate,
    create,
    update,
    remove,
  };
}
