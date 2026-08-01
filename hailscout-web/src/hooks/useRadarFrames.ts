"use client";

/**
 * Live radar frames backed by /v1/radar/frames.
 *
 * Three products stack into one answer to "is hail falling, where, how big":
 *   reflectivity — where the storm is (context, drawn underneath)
 *   posh         — hail is LIKELY here
 *   mesh         — hail is FALLING here, and this big (the hero layer)
 *
 * Public / unauthenticated, same posture as /v1/storms, so the map renders
 * the live layers without a session.
 *
 * Honesty rule (same as useStorms): frames are NEVER invented. A product the
 * pipeline hasn't written yet, a failed request, or a genuinely quiet sky all
 * yield an empty list — the layer draws nothing and the control says so out
 * loud. There is no fixture path here at all.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { apiClient } from "@/lib/api";
import { env } from "@/lib/env";

export type RadarProduct = "reflectivity" | "posh" | "mesh";

/** Draw order, bottom → top: context first, the hero layer last. */
export const RADAR_PRODUCTS: RadarProduct[] = ["reflectivity", "posh", "mesh"];

export interface RadarFrameBounds {
  min_lat: number;
  min_lng: number;
  max_lat: number;
  max_lng: number;
}

export interface RadarFrame {
  id: string;
  product: RadarProduct;
  /** ISO 8601 UTC — the moment the radar was valid. */
  valid_time: string;
  bounds: RadarFrameBounds;
  width: number;
  height: number;
  /** Inches (mesh), percent (posh), dBZ (reflectivity) — may be null. */
  peak_value: number | null;
  /** API-relative path to the immutable PNG. */
  url: string;
}

interface ApiRadarFramesResponse {
  frames?: RadarFrame[];
}

/** Newest-first frame list per product. */
export type RadarFrameSet = Record<RadarProduct, RadarFrame[]>;

/** One aligned moment: the three products as they looked at the same time. */
export interface RadarStep {
  /** ISO valid time of this step (taken from the spine product). */
  at: string;
  reflectivity: RadarFrame | null;
  posh: RadarFrame | null;
  mesh: RadarFrame | null;
}

/** Shared empty result — returned before the first fetch and when disabled. */
const EMPTY_SET: RadarFrameSet = { reflectivity: [], posh: [], mesh: [] };

/** Frames land about every 2 minutes, so 12 ≈ 24 minutes of loop history. */
const FRAME_LIMIT = 12;
/** Poll cadence for new frames. */
const REFRESH_MS = 60_000;
/** Animation speed — one loop step per 500ms. */
const STEP_MS = 500;
/**
 * How far apart two products' valid times may be and still count as "the
 * same moment". MRMS publishes each product on its own ~2-minute cycle, so
 * they rarely land on the identical second; beyond this window we'd be
 * pairing a hail frame with a storm frame from a different scan, so we
 * render nothing for the missing product instead.
 */
const ALIGN_TOLERANCE_MS = 6 * 60_000;

/** Absolute URL for a frame's PNG (the API returns a relative path). */
export function radarFrameUrl(frame: RadarFrame): string {
  return frame.url.startsWith("http")
    ? frame.url
    : `${env.NEXT_PUBLIC_API_BASE_URL}${frame.url}`;
}

/** Drop anything malformed, then sort newest first. */
function normalizeFrames(
  frames: RadarFrame[] | undefined,
  product: RadarProduct,
): RadarFrame[] {
  if (!Array.isArray(frames)) return [];
  return frames
    .filter((f) => {
      if (!f || typeof f.url !== "string" || !f.url) return false;
      if (Number.isNaN(Date.parse(f.valid_time))) return false;
      const b = f.bounds;
      return (
        !!b &&
        Number.isFinite(b.min_lat) &&
        Number.isFinite(b.min_lng) &&
        Number.isFinite(b.max_lat) &&
        Number.isFinite(b.max_lng) &&
        b.max_lat > b.min_lat &&
        b.max_lng > b.min_lng
      );
    })
    // Trust our own product filter over the row's label — the layer keys
    // off it to decide which slot to paint into.
    .map((f) => ({ ...f, product }))
    .sort((a, b) => Date.parse(b.valid_time) - Date.parse(a.valid_time));
}

/**
 * One request per product, in parallel. A single product failing (not
 * ingested yet, transient 5xx) must not blank the other two — but if EVERY
 * product fails that's the API being unreachable, not a quiet sky, so we
 * throw and let the control say "unavailable" rather than "no radar".
 */
async function fetchFrameSet(limit: number): Promise<RadarFrameSet> {
  const results = await Promise.all(
    RADAR_PRODUCTS.map(async (product) => {
      try {
        const res = await apiClient.get<ApiRadarFramesResponse>(
          `/v1/radar/frames?product=${product}&limit=${limit}`,
        );
        return { product, frames: normalizeFrames(res?.frames, product), ok: true };
      } catch {
        return { product, frames: [] as RadarFrame[], ok: false };
      }
    }),
  );

  if (results.every((r) => !r.ok)) {
    throw new Error("Live radar is unreachable");
  }

  const set: RadarFrameSet = { reflectivity: [], posh: [], mesh: [] };
  for (const r of results) set[r.product] = r.frames;
  return set;
}

/** Closest frame to `t`, or null when nothing lands inside the tolerance. */
function nearestFrame(frames: RadarFrame[], t: number): RadarFrame | null {
  let best: RadarFrame | null = null;
  let bestDelta = Infinity;
  for (const f of frames) {
    const delta = Math.abs(Date.parse(f.valid_time) - t);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = f;
    }
  }
  return bestDelta <= ALIGN_TOLERANCE_MS ? best : null;
}

/**
 * Align the three products onto one timeline, oldest → newest so playback
 * runs forward. The spine is the hero layer when we have it (hail size is
 * what the loop is FOR); we fall back down the stack when it's empty.
 */
function buildRadarSteps(set: RadarFrameSet): RadarStep[] {
  const spine = set.mesh.length
    ? set.mesh
    : set.posh.length
      ? set.posh
      : set.reflectivity;
  if (!spine.length) return [];

  return [...spine]
    .sort((a, b) => Date.parse(a.valid_time) - Date.parse(b.valid_time))
    .map((f) => {
      const t = Date.parse(f.valid_time);
      return {
        at: f.valid_time,
        reflectivity: nearestFrame(set.reflectivity, t),
        posh: nearestFrame(set.posh, t),
        mesh: nearestFrame(set.mesh, t),
      };
    });
}

export interface LiveRadarState {
  /** Whether the overlay is switched on (drives the fetch too). */
  enabled: boolean;
  toggle: () => void;
  /** Aligned loop, oldest → newest. Empty means empty. */
  steps: RadarStep[];
  /** The moment currently painted on the map, or null when there's nothing. */
  current: RadarStep | null;
  /** Index of `current` within `steps`; -1 when there are no frames. */
  index: number;
  /** True when the newest frame is showing. */
  atNow: boolean;
  /** Snap back to the newest frame and keep following it. */
  snapToNow: () => void;
  playing: boolean;
  togglePlay: () => void;
  /** Newest valid time across all products — drives "updated 2 min ago". */
  newestAt: string | null;
  isLoading: boolean;
  /** Set only when every product failed, i.e. the API is unreachable. */
  error: unknown;
}

/**
 * Everything the live-radar layer and its control need, in one place: the
 * polled frames, the aligned loop, and the playback cursor.
 *
 * Nothing is fetched until `enabled` is true — the overlay is opt-in, so a
 * rep who never turns it on never pays for it.
 */
export function useLiveRadar(options: { limit?: number } = {}): LiveRadarState {
  const { limit = FRAME_LIMIT } = options;

  const [enabled, setEnabled] = useState(false);
  const [playing, setPlaying] = useState(false);
  /**
   * The step the user is parked on, by valid time. null means "follow the
   * newest frame" — pinning by time rather than index so an incoming refresh
   * (which drops the oldest frame and shifts every index) doesn't silently
   * move them to a different moment.
   */
  const [pinnedAt, setPinnedAt] = useState<string | null>(null);
  // Re-render every 30s so "updated 3 min ago" keeps counting while paused.
  const [, setAgeTick] = useState(0);

  const { data, error, isLoading } = useSWR<RadarFrameSet>(
    enabled ? `live-radar:${limit}` : null,
    () => fetchFrameSet(limit),
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
      shouldRetryOnError: false,
      keepPreviousData: true,
      refreshInterval: REFRESH_MS,
    },
  );

  const frames = data ?? EMPTY_SET;
  const steps = useMemo(() => buildRadarSteps(frames), [frames]);

  const index = useMemo(() => {
    if (!steps.length) return -1;
    if (!pinnedAt) return steps.length - 1;
    const i = steps.findIndex((s) => s.at === pinnedAt);
    // Pinned frame aged out of the window → fall back to the newest.
    return i === -1 ? steps.length - 1 : i;
  }, [steps, pinnedAt]);

  const current = index >= 0 ? steps[index] : null;
  const atNow = steps.length > 0 && index === steps.length - 1;

  const newestAt = useMemo(() => {
    let best: string | null = null;
    for (const product of RADAR_PRODUCTS) {
      // Lists are normalized newest-first, so [0] is the freshest.
      const f = frames[product][0];
      if (f && (!best || Date.parse(f.valid_time) > Date.parse(best))) {
        best = f.valid_time;
      }
    }
    return best;
  }, [frames]);

  // Switching off also resets playback, so turning it back on starts at now.
  useEffect(() => {
    if (enabled) return;
    setPlaying(false);
    setPinnedAt(null);
  }, [enabled]);

  // Advance the loop. Landing on the newest step un-pins, so an idle loop
  // keeps following "now" as fresh frames arrive instead of freezing on an
  // id that's about to age out.
  useEffect(() => {
    if (!playing || steps.length < 2) return;
    const timer = window.setInterval(() => {
      setPinnedAt((prev) => {
        const cur = prev
          ? steps.findIndex((s) => s.at === prev)
          : steps.length - 1;
        const next = cur < 0 || cur >= steps.length - 1 ? 0 : cur + 1;
        return next === steps.length - 1 ? null : steps[next].at;
      });
    }, STEP_MS);
    return () => window.clearInterval(timer);
  }, [playing, steps]);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => setAgeTick((t) => t + 1), 30_000);
    return () => window.clearInterval(timer);
  }, [enabled]);

  const toggle = useCallback(() => setEnabled((v) => !v), []);

  const snapToNow = useCallback(() => setPinnedAt(null), []);

  const togglePlay = useCallback(() => setPlaying((v) => !v), []);

  return {
    enabled,
    toggle,
    steps,
    current,
    index,
    atNow,
    snapToNow,
    playing,
    togglePlay,
    newestAt,
    isLoading: enabled && isLoading,
    error: enabled ? error : null,
  };
}
