"use client";

import { useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import useSWR from "swr";
import { apiClient } from "@/lib/api";

export interface TeamMember {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
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

  // Break-glass: clear a locked-out teammate's SMS 2FA so they can
  // re-enroll. Non-destructive (the account stays) — un-enrolls 2FA,
  // revokes their sessions + trusted devices, and is audit-logged
  // server-side. Owner/admin only; same-tenant enforced by the API.
  const resetMfa = useCallback(
    async (userId: string) => {
      if (!auth) return;
      const t = await getToken();
      await apiClient.post(
        `/v1/admin/users/${userId}/reset-mfa`,
        {},
        t || undefined,
      );
      await swr.mutate();
    },
    [auth, getToken, swr],
  );

  const invite = useCallback(
    async (email: string, role = "member") => {
      if (!auth) return;
      const t = await getToken();
      const member = await apiClient.post<TeamMember>(
        "/v1/team/invite",
        { email, role },
        t || undefined,
      );
      // The account is created immediately — refresh so it shows in the list.
      await swr.mutate();
      return member;
    },
    [auth, getToken, swr],
  );

  return {
    members: swr.data ?? [],
    isLoading: !!auth && !swr.data && !swr.error,
    error: swr.error,
    refresh: swr.mutate,
    updateRole,
    remove,
    resetMfa,
    invite,
  };
}
