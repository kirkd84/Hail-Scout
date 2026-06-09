"use client";

import { useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import useSWR from "swr";
import { apiClient } from "@/lib/api";

export interface ApiTokenRow {
  id: string;
  name: string;
  prefix: string;
  scope: string;
  last_used_at: string | null;
  created_at: string;
  revoked: boolean;
}

export interface ApiTokenCreated extends ApiTokenRow {
  /** Plaintext — returned ONCE, on creation. */
  token: string;
}

export function useApiTokens() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const auth = isLoaded && isSignedIn === true;

  const swr = useSWR<ApiTokenRow[]>(
    auth ? "/v1/tokens" : null,
    async (url: string) => {
      const t = await getToken();
      return apiClient.get<ApiTokenRow[]>(url, t || undefined);
    },
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  const create = useCallback(
    async (name: string): Promise<ApiTokenCreated | undefined> => {
      if (!auth) return;
      const t = await getToken();
      const row = await apiClient.post<ApiTokenCreated>(
        "/v1/tokens",
        { name },
        t || undefined,
      );
      await swr.mutate();
      return row;
    },
    [auth, getToken, swr],
  );

  const revoke = useCallback(
    async (id: string) => {
      if (!auth) return;
      const t = await getToken();
      await apiClient.delete(`/v1/tokens/${id}`, t || undefined);
      await swr.mutate();
    },
    [auth, getToken, swr],
  );

  return {
    tokens: swr.data ?? [],
    isLoading: !!auth && !swr.data && !swr.error,
    create,
    revoke,
  };
}
