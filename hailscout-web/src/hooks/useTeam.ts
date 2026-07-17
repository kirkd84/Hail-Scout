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
  is_disabled?: boolean;
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

  const updateName = useCallback(
    async (userId: string, firstName: string, lastName: string) => {
      if (!auth) return;
      const t = await getToken();
      await apiClient.patch(
        `/v1/team/${userId}/name`,
        { first_name: firstName, last_name: lastName },
        t || undefined,
      );
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

  // Change a teammate's email (admin/owner). Must be unique across workspaces.
  const updateEmail = useCallback(
    async (userId: string, email: string) => {
      if (!auth) return;
      const t = await getToken();
      await apiClient.patch(`/v1/team/${userId}/email`, { email }, t || undefined);
      await swr.mutate();
    },
    [auth, getToken, swr],
  );

  // Email a teammate a set/reset-password link (admin/owner). Returns the
  // server's confirmation message. Doubles as initial-password setup for
  // SSO-only members.
  const sendPasswordReset = useCallback(
    async (userId: string): Promise<string> => {
      if (!auth) throw new Error("Not signed in");
      const t = await getToken();
      const r = await apiClient.post<{ ok: boolean; message: string }>(
        `/v1/team/${userId}/send-password-reset`,
        {},
        t || undefined,
      );
      return r.message;
    },
    [auth, getToken],
  );

  // Enable/disable a teammate. Disabling blocks sign-in + revokes sessions
  // immediately; the row (and history) is kept.
  const setActive = useCallback(
    async (userId: string, active: boolean) => {
      if (!auth) return;
      const t = await getToken();
      await apiClient.patch(`/v1/team/${userId}/active`, { active }, t || undefined);
      await swr.mutate();
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
    updateName,
    updateEmail,
    sendPasswordReset,
    setActive,
  };
}
