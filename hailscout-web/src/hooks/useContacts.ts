"use client";

import { useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import useSWR from "swr";
import { apiClient } from "@/lib/api";

export type ContactStatus = "prospect" | "customer" | "lost";

export interface CrmContact {
  id: string;
  org_id: string;
  monitored_address_id: number | null;
  name: string;
  email: string | null;
  phone: string | null;
  status: ContactStatus;
  notes: string | null;
  follow_up_at: string | null;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

interface ListOpts {
  addressId?: number | null;
  status?: ContactStatus | null;
}

export function useContacts(opts: ListOpts = {}) {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const auth = isLoaded && isSignedIn === true;

  const params = new URLSearchParams();
  if (opts.addressId != null) params.set("address_id", String(opts.addressId));
  if (opts.status) params.set("status", opts.status);
  const qs = params.toString();
  const path = `/v1/customers${qs ? `?${qs}` : ""}`;

  const swr = useSWR<CrmContact[]>(
    auth ? path : null,
    async (url: string) => {
      const t = await getToken();
      return apiClient.get<CrmContact[]>(url, t || undefined);
    },
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  const create = useCallback(
    async (input: {
      name: string;
      monitored_address_id?: number | null;
      email?: string | null;
      phone?: string | null;
      status?: ContactStatus;
      notes?: string | null;
      follow_up_at?: string | null;
    }): Promise<CrmContact | null> => {
      if (!auth) return null;
      const t = await getToken();
      const created = await apiClient.post<CrmContact>(
        "/v1/customers",
        { status: "prospect", ...input },
        t || undefined,
      );
      await swr.mutate();
      return created;
    },
    [auth, getToken, swr],
  );

  const update = useCallback(
    async (
      id: string,
      patch: Partial<
        Pick<
          CrmContact,
          | "name"
          | "email"
          | "phone"
          | "status"
          | "notes"
          | "follow_up_at"
          | "monitored_address_id"
        >
      >,
    ) => {
      if (!auth) return;
      const t = await getToken();
      await apiClient.patch(`/v1/customers/${id}`, patch, t || undefined);
      await swr.mutate();
    },
    [auth, getToken, swr],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!auth) return;
      const t = await getToken();
      await apiClient.delete(`/v1/customers/${id}`, t || undefined);
      await swr.mutate();
    },
    [auth, getToken, swr],
  );

  return {
    contacts: swr.data ?? [],
    isLoading: !!auth && !swr.data && !swr.error,
    error: swr.error,
    refresh: swr.mutate,
    create,
    update,
    remove,
  };
}
