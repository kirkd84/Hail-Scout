/**
 * Lightweight client-side geocoder using MapTiler.
 *
 * Two paths:
 *  - searchAddress(): single best result for submit-on-enter
 *  - searchAddressSuggestions(): debounced autocomplete (5 results)
 *
 * Both fall back to the local fixture-city table so the demo works
 * without a key. Country is locked to US for relevance.
 */

import { STORM_FIXTURES } from "./storm-fixtures";

export interface GeocodeResult {
  /** Pretty-formatted full address. */
  pretty: string;
  /** Short label for autocomplete rows ("Dallas", "32114 Cedar Ln"). */
  short: string;
  /** Optional context like state / city. */
  context?: string;
  lat: number;
  lng: number;
  /** Provider id — useful for keying React lists. */
  id: string;
}

const KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;

function fixtureFallback(query: string, max: number): GeocodeResult[] {
  const lower = query.toLowerCase().trim();
  if (!lower) return [];
  return STORM_FIXTURES.filter((f) =>
    f.city.toLowerCase().split(",")[0].includes(lower) ||
    f.city.toLowerCase().includes(lower),
  )
    .slice(0, max)
    .map((f) => ({
      id: `fx-${f.id}`,
      pretty: `${query} (≈ ${f.city})`,
      short: query,
      context: f.city,
      lat: f.centroid_lat + 0.02,
      lng: f.centroid_lng + 0.02,
    }));
}

interface MaptilerFeature {
  id: string;
  text?: string;
  place_name?: string;
  center?: [number, number];
  context?: { id: string; text: string }[];
}

function adaptFeatures(features: MaptilerFeature[]): GeocodeResult[] {
  return features
    .filter((f) => f.center && Array.isArray(f.center))
    .map((f) => {
      const [lng, lat] = f.center as [number, number];
      const ctx = (f.context ?? [])
        .map((c) => c.text)
        .filter(Boolean)
        .join(", ");
      return {
        id: f.id,
        pretty: f.place_name || f.text || "",
        short: f.text || f.place_name || "",
        context: ctx,
        lat,
        lng,
      };
    });
}

export async function searchAddress(query: string): Promise<GeocodeResult | null> {
  const all = await searchAddressSuggestions(query, 1);
  return all[0] ?? null;
}

export async function searchAddressSuggestions(
  query: string,
  limit = 5,
): Promise<GeocodeResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  if (!KEY) return fixtureFallback(trimmed, limit);

  try {
    const url = new URL(
      `https://api.maptiler.com/geocoding/${encodeURIComponent(trimmed)}.json`,
    );
    url.searchParams.set("key", KEY);
    url.searchParams.set("country", "us");
    url.searchParams.set("autocomplete", "true");
    url.searchParams.set("limit", String(limit));
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`maptiler ${res.status}`);
    const json = await res.json();
    const features = (json?.features ?? []) as MaptilerFeature[];
    const adapted = adaptFeatures(features);
    if (adapted.length === 0) return fixtureFallback(trimmed, limit);
    return adapted;
  } catch {
    return fixtureFallback(trimmed, limit);
  }
}
