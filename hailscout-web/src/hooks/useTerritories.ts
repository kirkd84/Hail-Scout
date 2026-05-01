"use client";

import { useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import useSWR from "swr";
import { apiClient } from "@/lib/api";

export interface Territory {
  id: string;
  org_id: string;
  name: string;
  color: string | null;
  polygon: [number, number][];
  assignee_user_id: string | null;
  assignee_email: string | null;
  notes: string | null;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

export function useTerritories() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const auth = isLoaded && isSignedIn === true;

  const swr = useSWR<Territory[]>(
    auth ? "/v1/territories" : null,
    async (url: string) => {
      const t = await getToken();
      return apiClient.get<Territory[]>(url, t || undefined);
    },
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  const create = useCallback(
    async (input: {
      name: string;
      polygon: [number, number][];
      color?: string;
      assignee_user_id?: string;
      notes?: string;
    }): Promise<Territory | null> => {
      if (!auth) return null;
      const t = await getToken();
      const created = await apiClient.post<Territory>(
        "/v1/territories",
        input,
        t || undefined,
      );
      await swr.mutate();
      return created;
    },
    [auth, getToken, swr],
  );

  const update = useCallback(
    async (id: string, patch: Partial<Omit<Territory, "id" | "org_id" | "created_at" | "updated_at">>) => {
      if (!auth) return;
      const t = await getToken();
      await apiClient.patch(`/v1/territories/${id}`, patch, t || undefined);
      await swr.mutate();
    },
    [auth, getToken, swr],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!auth) return;
      const t = await getToken();
      await apiClient.delete(`/v1/territories/${id}`, t || undefined);
      await swr.mutate();
    },
    [auth, getToken, swr],
  );

  return {
    territories: swr.data ?? [],
    isLoading: !!auth && !swr.data && !swr.error,
    create,
    update,
    remove,
  };
}
