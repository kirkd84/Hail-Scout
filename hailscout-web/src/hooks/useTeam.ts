"use client";

import { useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import useSWR from "swr";
import { apiClient } from "@/lib/api";

export interface TeamMember {
  id: string;
  email: string;
  role: string;
  is_super_admin: boolean;
  created_at: string;
}

export function useTeam() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const auth = isLoaded && isSignedIn === true;

  const swr = useSWR<TeamMember[]>(
    auth ? "/v1/team" : null,
    async (url: string) => {
      const t = await getToken();
      return apiClient.get<TeamMember[]>(url, t || undefined);
    },
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  const updateRole = useCallback(
    async (userId: string, role: string) => {
      if (!auth) return;
      const t = await getToken();
      await apiClient.patch(`/v1/team/${userId}/role`, { role }, t || undefined);
      await swr.mutate();
    },
    [auth, getToken, swr],
  );

  const remove = useCallback(
    async (userId: string) => {
      if (!auth) return;
      const t = await getToken();
      await apiClient.delete(`/v1/team/${userId}`, t || undefined);
      await swr.mutate();
    },
    [auth, getToken, swr],
  );

  const invite = useCallback(
    async (email: string, role = "member") => {
      if (!auth) return;
      const t = await getToken();
      return apiClient.post<{ status: string; message: string }>(
        "/v1/team/invite",
        { email, role },
        t || undefined,
      );
    },
    [auth, getToken],
  );

  return {
    members: swr.data ?? [],
    isLoading: !!auth && !swr.data && !swr.error,
    error: swr.error,
    refresh: swr.mutate,
    updateRole,
    remove,
    invite,
  };
}
