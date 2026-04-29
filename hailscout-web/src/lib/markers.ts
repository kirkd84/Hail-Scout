/**
 * Canvassing marker model + localStorage persistence.
 *
 * Replaces nothing — there's no markers API endpoint yet. When the
 * `/v1/markers` endpoint ships, swap the storage layer for a real
 * fetch but keep this module's interface.
 *
 * Status enum mirrors `MARKER_STATUS_OPTIONS` from constants.ts so
 * the existing UI palette (lead/knocked/no_answer/appt/contract/not_interested)
 * stays consistent across the app.
 */

export type MarkerStatus =
  | "lead"
  | "knocked"
  | "no_answer"
  | "appt"
  | "contract"
  | "not_interested";

export interface Marker {
  id: string;
  lng: number;
  lat: number;
  status: MarkerStatus;
  notes?: string;
  /** ISO timestamp. */
  created_at: string;
  /** ISO timestamp. */
  updated_at: string;
}

export const MARKER_STATUSES: { id: MarkerStatus; label: string; color: string; outline: string }[] = [
  { id: "lead",            label: "Lead",            color: "#3B82F6", outline: "#1D4ED8" },
  { id: "knocked",         label: "Knocked",         color: "#EAB308", outline: "#A16207" },
  { id: "no_answer",       label: "No answer",       color: "#6B7280", outline: "#374151" },
  { id: "appt",            label: "Appointment",     color: "#A855F7", outline: "#6B21A8" },
  { id: "contract",        label: "Contract",        color: "#22C55E", outline: "#15803D" },
  { id: "not_interested",  label: "Not interested",  color: "#EF4444", outline: "#991B1B" },
];

export function statusInfo(status: MarkerStatus) {
  return MARKER_STATUSES.find((s) => s.id === status) ?? MARKER_STATUSES[0];
}

const STORAGE_KEY = "hs.markers.v1";

function nowIso() {
  return new Date().toISOString();
}

function readAll(): Marker[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Marker[]) : [];
  } catch {
    return [];
  }
}

function writeAll(markers: Marker[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(markers));
  // Cross-tab sync — useStorage hook listens for this.
  window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
}

export const markersStore = {
  list(): Marker[] {
    return readAll();
  },
  add(input: Omit<Marker, "id" | "created_at" | "updated_at">): Marker {
    const m: Marker = {
      id: `mk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      created_at: nowIso(),
      updated_at: nowIso(),
      ...input,
    };
    const all = readAll();
    all.push(m);
    writeAll(all);
    return m;
  },
  update(id: string, patch: Partial<Pick<Marker, "status" | "notes">>): Marker | null {
    const all = readAll();
    const idx = all.findIndex((m) => m.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...patch, updated_at: nowIso() };
    writeAll(all);
    return all[idx];
  },
  remove(id: string) {
    writeAll(readAll().filter((m) => m.id !== id));
  },
  clear() {
    writeAll([]);
  },
  /** GeoJSON FeatureCollection for MapLibre rendering. */
  asGeoJSON(): GeoJSON.FeatureCollection {
    return {
      type: "FeatureCollection",
      features: readAll().map((m) => ({
        type: "Feature",
        id: m.id,
        geometry: { type: "Point", coordinates: [m.lng, m.lat] },
        properties: { ...m },
      })),
    };
  },
};
