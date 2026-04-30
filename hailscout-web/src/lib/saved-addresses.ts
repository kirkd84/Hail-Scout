/**
 * Monitored addresses — localStorage-backed model.
 *
 * Mirrors the markers store pattern. Replaces nothing — there's no
 * monitored-addresses API endpoint yet. When `/v1/monitored-addresses`
 * ships, swap the storage layer.
 */

export interface SavedAddress {
  id: string;
  /** Pretty-formatted full address. */
  address: string;
  lat: number;
  lng: number;
  /** Optional nickname ("Mom's house", "Office"). */
  label?: string;
  /** Cached snapshot of last-known storm activity at this point. */
  last_storm_at?: string;
  last_storm_size_in?: number;
  /** When the user added it. */
  created_at: string;
}

const STORAGE_KEY = "hs.addresses.v1";

function readAll(): SavedAddress[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedAddress[]) : [];
  } catch {
    return [];
  }
}

function writeAll(addresses: SavedAddress[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(addresses));
  window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
}

export const addressesStore = {
  list(): SavedAddress[] {
    return readAll();
  },
  /** Returns the existing entry if (lat, lng) matches within ~50m, else null. */
  findNear(lat: number, lng: number): SavedAddress | null {
    const tol = 0.0005; // ~55 m
    return (
      readAll().find(
        (a) => Math.abs(a.lat - lat) < tol && Math.abs(a.lng - lng) < tol,
      ) ?? null
    );
  },
  add(input: Omit<SavedAddress, "id" | "created_at">): SavedAddress {
    const existing = this.findNear(input.lat, input.lng);
    if (existing) {
      // De-dupe: refresh meta on the existing entry instead of adding twice.
      const all = readAll();
      const idx = all.findIndex((a) => a.id === existing.id);
      all[idx] = { ...existing, ...input };
      writeAll(all);
      return all[idx];
    }
    const a: SavedAddress = {
      id: `ad_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      created_at: new Date().toISOString(),
      ...input,
    };
    const all = readAll();
    all.push(a);
    writeAll(all);
    return a;
  },
  update(id: string, patch: Partial<Omit<SavedAddress, "id" | "created_at">>): SavedAddress | null {
    const all = readAll();
    const idx = all.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...patch };
    writeAll(all);
    return all[idx];
  },
  remove(id: string) {
    writeAll(readAll().filter((a) => a.id !== id));
  },
  clear() {
    writeAll([]);
  },
};
