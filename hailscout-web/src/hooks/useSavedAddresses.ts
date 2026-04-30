"use client";

import { useEffect, useState, useCallback } from "react";
import {
  addressesStore,
  type SavedAddress,
} from "@/lib/saved-addresses";

const KEY = "hs.addresses.v1";

export function useSavedAddresses() {
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);

  const reload = useCallback(() => setAddresses(addressesStore.list()), []);

  useEffect(() => {
    reload();
    const handler = (e: StorageEvent) => {
      if (e.key === null || e.key === KEY) reload();
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [reload]);

  const save = useCallback(
    (input: Omit<SavedAddress, "id" | "created_at">) => {
      const a = addressesStore.add(input);
      reload();
      return a;
    },
    [reload],
  );

  const update = useCallback(
    (id: string, patch: Partial<Omit<SavedAddress, "id" | "created_at">>) => {
      addressesStore.update(id, patch);
      reload();
    },
    [reload],
  );

  const remove = useCallback(
    (id: string) => {
      addressesStore.remove(id);
      reload();
    },
    [reload],
  );

  const exists = useCallback(
    (lat: number, lng: number) => addressesStore.findNear(lat, lng) !== null,
    [],
  );

  return { addresses, save, update, remove, exists };
}
