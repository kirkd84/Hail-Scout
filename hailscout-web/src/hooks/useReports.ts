"use client";

import { useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import useSWR from "swr";
import { apiClient } from "@/lib/api";

export interface SavedReport {
  id: string;
  org_id: string;
  user_id: string;
  storm_id: string | null;
  storm_city: string | null;
  address: string | null;
  address_lat: number | null;
  address_lng: number | null;
  peak_size_in: number | null;
  storm_started_at: string | null;
  title: string | null;
  notes: string | null;
  created_at: string;
}

export interface OrgBranding {
  org_id?: string;
  company_name: string | null;
  primary: string | null;
  accent: string | null;
  logo_url: string | null;
}

export function useReports() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const auth = isLoaded && isSignedIn === true;

  const swr = useSWR<SavedReport[]>(
    auth ? "/v1/reports" : null,
    async (url: string) => {
      const t = await getToken();
      return apiClient.get<SavedReport[]>(url, t || undefined);
    },
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  const save = useCallback(
    async (input: Partial<Omit<SavedReport, "id" | "org_id" | "user_id" | "created_at">>) => {
      if (!auth) return null;
      const t = await getToken();
      const created = await apiClient.post<SavedReport>(
        "/v1/reports",
        input,
        t || undefined,
      );
      await swr.mutate();
      return created;
    },
    [auth, getToken, swr],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!auth) return;
      const t = await getToken();
      await apiClient.delete(`/v1/reports/${id}`, t || undefined);
      await swr.mutate();
    },
    [auth, getToken, swr],
  );

  return { reports: swr.data ?? [], isLoading: !!auth && !swr.data, save, remove };
}


export function useBranding() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const auth = isLoaded && isSignedIn === true;

  const swr = useSWR<OrgBranding>(
    auth ? "/v1/reports/branding" : null,
    async (url: string) => {
      const t = await getToken();
      return apiClient.get<OrgBranding>(url, t || undefined);
    },
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  const update = useCallback(
    async (patch: Partial<OrgBranding>) => {
      if (!auth) return;
      const t = await getToken();
      const next = await apiClient.patch<OrgBranding>(
        "/v1/reports/branding",
        patch,
        t || undefined,
      );
      await swr.mutate(next);
      return next;
    },
    [auth, getToken, swr],
  );

  return { branding: swr.data, update };
}
