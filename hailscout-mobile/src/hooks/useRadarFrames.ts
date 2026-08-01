/**
 * useRadarFrames — live radar imagery for the map, straight off the API.
 *
 * Mirrors the web hook. The API bakes each MRMS scan into a georeferenced
 * PNG; we just fetch the newest frame per product and hand the URL + corner
 * coordinates to MapLibre.
 *
 * Three products, stacked bottom-to-top on the map:
 *   reflectivity — where the storm is (context, muted)
 *   posh         — hail is likely here
 *   mesh         — hail is falling here, and how big (the hero layer)
 *
 * NO fixture fallback, same rule as useStorms: a source that returns nothing
 * yields nothing. A roofer driving toward a fabricated hail blob is a trust
 * killer. Each product is fetched independently, so one dead product (or a
 * stalled ingest) still leaves the others on screen; `error` is only set when
 * every product failed.
 *
 * /v1/radar is public — no token needed.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE, apiRequest } from "@/lib/api";

export type RadarProduct = "reflectivity" | "posh" | "mesh";

/** Bottom-to-top draw order — mesh last so hail size sits on top. */
export const RADAR_PRODUCTS: RadarProduct[] = ["reflectivity", "posh", "mesh"];

export interface RadarFrame {
  id: string;
  product: RadarProduct;
  /** ISO timestamp of the scan. */
  validTime: string;
  /** Absolute PNG URL, ready for MapLibre's ImageSource. */
  url: string;
  /** Corner coordinates, [lng, lat] — MapLibre wants TL, TR, BR, BL. */
  coordinates: [
    [number, number],
    [number, number],
    [number, number],
    [number, number],
  ];
  /** Peak value in the frame (inches for mesh), null when the API omits it. */
  peakValue: number | null;
}

interface ApiRadarFrame {
  id: string;
  product: string;
  valid_time: string;
  bounds: { min_lat: number; min_lng: number; max_lat: number; max_lng: number } | null;
  width: number;
  height: number;
  peak_value: number | null;
  url: string;
}

interface ApiRadarFramesResponse {
  frames: ApiRadarFrame[];
}

/** MRMS publishes about every two minutes — poll on that cadence. */
const REFRESH_MS = 120_000;

const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/**
 * API row → render-ready frame. Returns null for anything we can't place on
 * the map (missing/garbage bounds) rather than guessing at coordinates.
 */
function adaptFrame(api: ApiRadarFrame | undefined, product: RadarProduct): RadarFrame | null {
  if (!api) return null;
  const b = api.bounds;
  if (!b || !isNum(b.min_lat) || !isNum(b.min_lng) || !isNum(b.max_lat) || !isNum(b.max_lng)) {
    return null;
  }
  if (b.max_lat <= b.min_lat || b.max_lng <= b.min_lng) return null;
  if (!api.url || !api.valid_time) return null;

  return {
    id: api.id,
    product,
    validTime: api.valid_time,
    url: api.url.startsWith("http") ? api.url : `${API_BASE}${api.url}`,
    coordinates: [
      [b.min_lng, b.max_lat], // top-left
      [b.max_lng, b.max_lat], // top-right
      [b.max_lng, b.min_lat], // bottom-right
      [b.min_lng, b.min_lat], // bottom-left
    ],
    peakValue: isNum(api.peak_value) ? api.peak_value : null,
  };
}

export type RadarFrameMap = Partial<Record<RadarProduct, RadarFrame>>;

interface UseRadarFramesState {
  /** Newest frame per product; a product is simply absent when it has none. */
  latest: RadarFrameMap;
  /** ISO time of the freshest scan across products, null when we have none. */
  newestValidTime: string | null;
  isLoading: boolean;
  /** Set only when every product failed — one bad product degrades quietly. */
  error: Error | null;
}

const EMPTY: RadarFrameMap = {};

export function useRadarFrames(opts?: {
  /** Skip fetching entirely while the layer is switched off (saves data). */
  enabled?: boolean;
  products?: RadarProduct[];
}): UseRadarFramesState & { refresh: () => Promise<void> } {
  const enabled = opts?.enabled ?? true;
  const products = opts?.products ?? RADAR_PRODUCTS;
  const productKey = products.join(",");

  const [state, setState] = useState<UseRadarFramesState>({
    latest: EMPTY,
    newestValidTime: null,
    isLoading: false,
    error: null,
  });

  // Guards against a slow response landing after the screen unmounted, or
  // after the layer was switched off (`runId` is bumped on every toggle).
  const aliveRef = useRef(true);
  const runIdRef = useRef(0);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const fetchFrames = useCallback(async () => {
    const list = productKey.split(",") as RadarProduct[];
    const runId = runIdRef.current;
    setState((s) => ({ ...s, isLoading: true }));

    // allSettled, not all: a 500 on one product must not blank the map.
    const results = await Promise.allSettled(
      list.map((product) =>
        apiRequest<ApiRadarFramesResponse>(
          `/v1/radar/frames?product=${product}&limit=1`,
        ).then((data) => adaptFrame(data.frames?.[0], product)),
      ),
    );
    if (!aliveRef.current || runId !== runIdRef.current) return;

    const latest: RadarFrameMap = {};
    let newest: string | null = null;
    let newestMs = -Infinity; // compare parsed times, not ISO strings
    let failures = 0;
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        failures += 1;
        return;
      }
      const frame = r.value;
      if (!frame) return;
      latest[list[i]] = frame;
      const ms = new Date(frame.validTime).getTime();
      if (Number.isFinite(ms) && ms > newestMs) {
        newestMs = ms;
        newest = frame.validTime;
      }
    });

    setState({
      latest,
      newestValidTime: newest,
      isLoading: false,
      error:
        failures === list.length && list.length > 0
          ? new Error("Live radar is unavailable right now.")
          : null,
    });
  }, [productKey]);

  useEffect(() => {
    // Invalidate anything still in flight from the previous on/off state.
    runIdRef.current += 1;
    if (!enabled) {
      // Drop what we hold so a stale frame can't reappear when toggled back on.
      setState({ latest: EMPTY, newestValidTime: null, isLoading: false, error: null });
      return;
    }
    void fetchFrames();
    const id = setInterval(() => void fetchFrames(), REFRESH_MS);
    return () => clearInterval(id);
  }, [enabled, fetchFrames]);

  return { ...state, refresh: fetchFrames };
}
