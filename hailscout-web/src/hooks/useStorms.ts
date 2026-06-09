"use client";

/**
 * Public storm hooks backed by /v1/storms*.
 *
 * Three primary entrypoints:
 *   - useStorms({ bbox, from, to })       → list within a viewport / date range
 *   - useStormDetail(id)                  → one storm + its hail swaths (GeoJSON)
 *   - useStormsAtPoint({ lat, lng })      → "what hit this address?"
 *
 * All three are unauthenticated — the API exposes them publicly so the
 * marketing site (live gallery, claim lookup) can render without a Clerk
 * session. Authenticated callers get the same data.
 *
 * Fixture fallback: when NEXT_PUBLIC_USE_FIXTURES === "1" we skip the
 * network entirely and return filtered fixtures. With `fallbackToFixtures:
 * true` the hook also substitutes fixtures when the API replies with an
 * empty list — useful for the post-deploy validation window before the
 * pipeline has filled the DB.
 */

import useSWR from "swr";
import { apiClient } from "@/lib/api";
import { STORM_FIXTURES, fixturesAtPoint, type StormFixture } from "@/lib/storm-fixtures";
import type { Storm } from "@/lib/api-types";

// ---- API response shapes (mirror hailscout-api/schemas/storm.py) ----

interface ApiGeoPoint {
  type: "Point";
  coordinates: [number, number]; // [lng, lat]
}

interface ApiGeoPolygon {
  type: "Polygon";
  coordinates: number[][][];
}

interface ApiGeoMultiPolygon {
  type: "MultiPolygon";
  coordinates: number[][][][];
}

interface ApiStorm {
  id: string;
  start_time: string;
  end_time: string;
  max_hail_size_in: number;
  source: string;
  centroid: ApiGeoPoint | null;
  bbox: ApiGeoPolygon | null;
  /** Phase 23 LSR confirmation fields. Always present on /v1/storms;
   *  default false / null. */
  lsr_confirmed?: boolean;
  lsr_observed_size_in?: number | null;
  lsr_observed_at?: string | null;
  /** Phase 23.5 quality fields. */
  confidence?: number;
  suspect?: boolean;
  suspect_reasons?: string[];
  /** Phase 31 Impact Score. */
  impact?: { score: number; label: string };
  /** Only populated when the request includes `include=swaths`. */
  swaths?: ApiHailSwath[];
}

interface ApiStormsListResponse {
  storms: ApiStorm[];
  cursor: string | null;
  total: number;
}

interface ApiHailSwath {
  id: string;
  hail_size_category: string;
  geometry: ApiGeoMultiPolygon | null;
  updated_at: string;
}

export interface ApiStormDetail extends ApiStorm {
  swaths: ApiHailSwath[];
}

interface ApiHailAtPointHit {
  id: string;
  start_time: string;
  end_time: string;
  max_hail_size_in: number;
  source: string;
  category_at_point: string;
}

interface ApiHailAtPointListResponse {
  lat: number;
  lng: number;
  hits: ApiHailAtPointHit[];
  total: number;
}

// ---- Shape adapter ----

/**
 * Flatten the API's GeoJSON `centroid` + `bbox` into the existing UI
 * Storm shape ({ centroid_lat/lng, bbox: { min/max_lat/lng } }).
 *
 * The new endpoints return geometry as proper GeoJSON; the existing UI
 * components expect flat numbers. Translate at the seam so consumers
 * can stay on the legacy shape until they're ready to take GeoJSON.
 */
export function adaptApiStorm(s: ApiStorm): Storm {
  const [centLng, centLat] = s.centroid?.coordinates ?? [0, 0];
  const ring = s.bbox?.coordinates?.[0] ?? [];
  const lngs = ring.map((p) => p[0]);
  const lats = ring.map((p) => p[1]);
  const minLng = lngs.length ? Math.min(...lngs) : 0;
  const maxLng = lngs.length ? Math.max(...lngs) : 0;
  const minLat = lats.length ? Math.min(...lats) : 0;
  const maxLat = lats.length ? Math.max(...lats) : 0;
  return {
    id: s.id,
    start_time: s.start_time,
    end_time: s.end_time,
    max_hail_size_in: s.max_hail_size_in,
    centroid_lat: centLat,
    centroid_lng: centLng,
    bbox: { min_lat: minLat, min_lng: minLng, max_lat: maxLat, max_lng: maxLng },
    source: s.source,
    lsr_confirmed: s.lsr_confirmed ?? false,
    lsr_observed_size_in: s.lsr_observed_size_in ?? null,
    lsr_observed_at: s.lsr_observed_at ?? null,
    confidence: s.confidence ?? 1,
    suspect: s.suspect ?? false,
    suspect_reasons: s.suspect_reasons ?? [],
    impact: s.impact,
  };
}

const isFixtureMode = () => process.env.NEXT_PUBLIC_USE_FIXTURES === "1";

// ---- Hooks ----

export interface UseStormsArgs {
  /** [minLng, minLat, maxLng, maxLat] in WGS84. */
  bbox: [number, number, number, number];
  /** ISO 8601 start (e.g. "2026-04-01"). */
  from: string;
  /** ISO 8601 end (e.g. "2026-05-01"). */
  to: string;
  limit?: number;
  /** Substitute filtered fixtures when the API replies with an empty list. */
  fallbackToFixtures?: boolean;
  /** When true, the response also includes each storm's hail swath polygons
   *  (simplified server-side via ST_Simplify). Used for polygon rendering on
   *  the map at low / medium zoom. Adds ~10-50KB per storm to the payload. */
  includeSwaths?: boolean;
  /** ST_SimplifyPreserveTopology tolerance in degrees when includeSwaths
   *  is true. Defaults to 0.02 (~2km) — preserves cell-level polygon
   *  shape. Use 0 for full precision. */
  swathSimplify?: number;
  /** Pipeline source filter — "MRMS" or "NEXRAD". Omit to return both. */
  source?: "MRMS" | "NEXRAD" | null;
  /** Min peak hail size (inches). Applied at the DB layer. */
  minSize?: number | null;
  /** Sort order. "recent" (default) sorts by start_time DESC; "peak"
   *  sorts by max_hail_size_in DESC — for leaderboards. */
  order?: "recent" | "peak";
  /** Include suspect/low-confidence cells the API hides by default. The map
   *  passes this when "Show unverified" is on. */
  includeUnconfirmed?: boolean;
}

/** Storm with optional swath payload (when fetched with includeSwaths). */
export interface StormWithSwaths extends Storm {
  swaths?: Array<{
    id: string;
    hail_size_category: string;
    geometry: { type: "MultiPolygon"; coordinates: number[][][][] } | null;
  }>;
}

export function useStorms(args: UseStormsArgs) {
  const {
    bbox,
    from,
    to,
    limit = 50,
    fallbackToFixtures = false,
    includeSwaths = false,
    swathSimplify = 0.02,
    source = null,
    minSize = null,
    order,
    includeUnconfirmed = false,
  } = args;
  const fixtureMode = isFixtureMode();

  const qsParams: Record<string, string> = {
    bbox: bbox.join(","),
    from,
    to,
    limit: String(limit),
  };
  if (includeSwaths) {
    qsParams.include = "swaths";
    qsParams.simplify = String(swathSimplify);
  }
  if (source) qsParams.source = source;
  if (minSize != null && minSize > 0) qsParams.min_size = String(minSize);
  if (order) qsParams.order = order;
  if (includeUnconfirmed) qsParams.include_unconfirmed = "true";
  const qs = new URLSearchParams(qsParams);
  const swrKey = fixtureMode ? null : `/v1/storms?${qs}`;
  const { data, error, isLoading, mutate } = useSWR<ApiStormsListResponse>(
    swrKey,
    (url: string) => apiClient.get<ApiStormsListResponse>(url),
    { revalidateOnFocus: false, dedupingInterval: 60_000, shouldRetryOnError: false },
  );

  if (fixtureMode) {
    return {
      storms: filterFixturesByBbox(bbox) as StormWithSwaths[],
      isLoading: false,
      error: null,
      refresh: mutate,
      usingFallback: true,
    };
  }

  const apiStorms: StormWithSwaths[] = (data?.storms ?? []).map((s) => ({
    ...adaptApiStorm(s),
    swaths: s.swaths?.map((sw) => ({
      id: sw.id,
      hail_size_category: sw.hail_size_category,
      geometry: sw.geometry,
    })),
  }));
  const usingFallback = fallbackToFixtures && !isLoading && apiStorms.length === 0;

  return {
    storms: usingFallback
      ? (filterFixturesByBbox(bbox) as StormWithSwaths[])
      : apiStorms,
    isLoading,
    error,
    refresh: mutate,
    /** True when the API came back empty and we substituted fixtures. */
    usingFallback,
  };
}

export function useStormDetail(id: string | null | undefined) {
  const fixtureMode = isFixtureMode();
  const swrKey = fixtureMode || !id ? null : `/v1/storms/${id}`;

  const { data, error, isLoading, mutate } = useSWR<ApiStormDetail>(
    swrKey,
    (url: string) => apiClient.get<ApiStormDetail>(url),
    { revalidateOnFocus: false, dedupingInterval: 60_000, shouldRetryOnError: false },
  );

  if (fixtureMode || !id) {
    const fixture = id ? STORM_FIXTURES.find((f) => f.id === id) : undefined;
    return {
      detail: fixture ? fixtureToDetail(fixture) : null,
      isLoading: false,
      error: null,
      refresh: mutate,
    };
  }

  return { detail: data ?? null, isLoading, error, refresh: mutate };
}

export interface UseStormsAtPointArgs {
  lat: number;
  lng: number;
  from?: string;
  to?: string;
  limit?: number;
  /** Substitute fixture-polygon hits when the API returns an empty list. */
  fallbackToFixtures?: boolean;
}

export function useStormsAtPoint(args: UseStormsAtPointArgs | null) {
  const fixtureMode = isFixtureMode();
  const enabled = !!args && !fixtureMode;

  const qs =
    args && enabled
      ? new URLSearchParams({
          lat: String(args.lat),
          lng: String(args.lng),
          ...(args.from ? { from: args.from } : {}),
          ...(args.to ? { to: args.to } : {}),
          limit: String(args.limit ?? 50),
        })
      : null;

  const { data, error, isLoading, mutate } = useSWR<ApiHailAtPointListResponse>(
    qs ? `/v1/storms/at-point?${qs}` : null,
    (url: string) => apiClient.get<ApiHailAtPointListResponse>(url),
    { revalidateOnFocus: false, dedupingInterval: 60_000, shouldRetryOnError: false },
  );

  if (!args) {
    return { hits: [], isLoading: false, error: null, refresh: mutate };
  }

  if (fixtureMode) {
    return {
      hits: fixturesAtPoint(args.lng, args.lat).map(fixtureToHit),
      isLoading: false,
      error: null,
      refresh: mutate,
      usingFallback: true,
    };
  }

  const hits = data?.hits ?? [];
  const usingFallback =
    args.fallbackToFixtures && !isLoading && hits.length === 0;

  return {
    hits: usingFallback ? fixturesAtPoint(args.lng, args.lat).map(fixtureToHit) : hits,
    isLoading,
    error,
    refresh: mutate,
    usingFallback,
  };
}

// ---- Fixture helpers ----

function filterFixturesByBbox(bbox: [number, number, number, number]): Storm[] {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return STORM_FIXTURES.filter(
    (f) =>
      f.centroid_lng >= minLng &&
      f.centroid_lng <= maxLng &&
      f.centroid_lat >= minLat &&
      f.centroid_lat <= maxLat,
  );
}

function fixtureToHit(s: Storm): ApiHailAtPointHit {
  return {
    id: s.id,
    start_time: s.start_time,
    end_time: s.end_time,
    max_hail_size_in: s.max_hail_size_in,
    source: s.source,
    category_at_point: String(s.max_hail_size_in),
  };
}

function fixtureToDetail(fixture: StormFixture): ApiStormDetail {
  const bbox = fixture.bbox;
  return {
    id: fixture.id,
    start_time: fixture.start_time,
    end_time: fixture.end_time,
    max_hail_size_in: fixture.max_hail_size_in,
    source: fixture.source,
    centroid: {
      type: "Point",
      coordinates: [fixture.centroid_lng, fixture.centroid_lat],
    },
    bbox: {
      type: "Polygon",
      coordinates: [
        [
          [bbox.min_lng, bbox.min_lat],
          [bbox.max_lng, bbox.min_lat],
          [bbox.max_lng, bbox.max_lat],
          [bbox.min_lng, bbox.max_lat],
          [bbox.min_lng, bbox.min_lat],
        ],
      ],
    },
    swaths: fixture.bands.map((band, i) => ({
      id: `${fixture.id}-band-${i}`,
      hail_size_category: String(band.min_size_in),
      geometry: {
        type: "MultiPolygon",
        coordinates: [[band.ring]],
      },
      updated_at: fixture.end_time,
    })),
  };
}
