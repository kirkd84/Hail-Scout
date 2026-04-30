"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import useSWR from "swr";
import { apiClient } from "@/lib/api";
import { addressesStore, type SavedAddress } from "@/lib/saved-addresses";

const LOCAL_KEY = "hs.addresses.v1";
const MIGRATED_KEY = "hs.addresses.migrated.v1";

interface AddressApi {
  id: number;
  address: string | null;
  label: string | null;
  lat: number | null;
  lng: number | null;
  alert_threshold_in: number | null;
  last_storm_at: string | null;
  last_storm_size_in: number | null;
  created_at: string;
  updated_at: string;
}

function adaptAddress(api: AddressApi): SavedAddress {
  return {
    id: String(api.id),
    address: api.address ?? "",
    lat: api.lat ?? 0,
    lng: api.lng ?? 0,
    label: api.label ?? undefined,
    last_storm_at: api.last_storm_at ?? undefined,
    last_storm_size_in: api.last_storm_size_in ?? undefined,
    created_at: api.created_at,
  };
}

export function useSavedAddresses() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const auth = isLoaded && isSignedIn === true;

  const swr = useSWR<AddressApi[]>(
    auth ? "/v1/monitored-addresses" : null,
    async (url: string) => {
      const t = await getToken();
      return apiClient.get<AddressApi[]>(url, t || undefined);
    },
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  const [local, setLocal] = useState<SavedAddress[]>([]);
  const reloadLocal = useCallback(() => setLocal(addressesStore.list()), []);
  useEffect(() => {
    if (!auth) reloadLocal();
  }, [auth, reloadLocal]);
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (!auth && (e.key === null || e.key === LOCAL_KEY)) reloadLocal();
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [auth, reloadLocal]);

  // Migration on first sign-in
  useEffect(() => {
    if (!auth) return;
    if (typeof window === "undefined") return;
    if (localStorage.getItem(MIGRATED_KEY) === "1") return;

    const localRows = addressesStore.list();
    if (localRows.length === 0) {
      localStorage.setItem(MIGRATED_KEY, "1");
      return;
    }
    (async () => {
      try {
        const t = await getToken();
        await apiClient.post(
          "/v1/monitored-addresses/bulk",
          {
            addresses: localRows.map((a) => ({
              address: a.address,
              lat: a.lat,
              lng: a.lng,
              label: a.label,
              last_storm_at: a.last_storm_at,
              last_storm_size_in: a.last_storm_size_in,
            })),
          },
          t || undefined,
        );
        localStorage.setItem(MIGRATED_KEY, "1");
        await swr.mutate();
      } catch {
        // try again next mount
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth]);

  const apiAddresses: SavedAddress[] = (swr.data ?? []).map(adaptAddress);
  const addresses = auth ? apiAddresses : local;

  const save = useCallback(
    async (input: Omit<SavedAddress, "id" | "created_at">): Promise<SavedAddress> => {
      if (auth) {
        const t = await getToken();
        const created = await apiClient.post<AddressApi>(
          "/v1/monitored-addresses",
          {
            address: input.address,
            lat: input.lat,
            lng: input.lng,
            label: input.label,
            last_storm_at: input.last_storm_at,
            last_storm_size_in: input.last_storm_size_in,
          },
          t || undefined,
        );
        await swr.mutate();
        return adaptAddress(created);
      }
      const a = addressesStore.add(input);
      reloadLocal();
      return a;
    },
    [auth, getToken, swr, reloadLocal],
  );

  const update = useCallback(
    async (id: string, patch: Partial<Omit<SavedAddress, "id" | "created_at">>) => {
      if (auth) {
        const t = await getToken();
        await apiClient.patch(
          `/v1/monitored-addresses/${id}`,
          {
            label: patch.label,
            last_storm_at: patch.last_storm_at,
            last_storm_size_in: patch.last_storm_size_in,
          },
          t || undefined,
        );
        await swr.mutate();
      } else {
        addressesStore.update(id, patch);
        reloadLocal();
      }
    },
    [auth, getToken, swr, reloadLocal],
  );

  const remove = useCallback(
    async (id: string) => {
      if (auth) {
        const t = await getToken();
        await apiClient.delete(`/v1/monitored-addresses/${id}`, t || undefined);
        await swr.mutate();
      } else {
        addressesStore.remove(id);
        reloadLocal();
      }
    },
    [auth, getToken, swr, reloadLocal],
  );

  const exists = useCallback(
    (lat: number, lng: number): boolean => {
      const tol = 0.0005;
      return addresses.some(
        (a) => Math.abs(a.lat - lat) < tol && Math.abs(a.lng - lng) < tol,
      );
    },
    [addresses],
  );

  return { addresses, save, update, remove, exists };
}
