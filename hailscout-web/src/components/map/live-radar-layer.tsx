"use client";

/**
 * Live radar overlay for /app/map.
 *
 * Three MapLibre `image` sources, positioned by each frame's own bounds and
 * stacked so the picture reads the way a roofer thinks:
 *
 *   reflectivity — muted, underneath: where the storm is
 *   posh         — over it: hail is likely here
 *   mesh         — on top, hot: hail is FALLING here, and this big
 *
 * Stepping the loop swaps each source's image in place (`updateImage`) with
 * `raster-fade-duration: 0`, and every frame in the loop is pre-warmed into
 * the browser cache first, so playback doesn't flicker. Frames are immutable
 * and served with a year-long cache header, so MapLibre's own fetch is a
 * cache hit.
 *
 * Two ordering hazards this handles:
 *   • a basemap swap wipes every source — `styledata` catches it and the
 *     layers get re-added (the styleEpoch pattern from storms-raster-layer),
 *   • the historical swath surface re-inserts itself at the same label
 *     anchor whenever it double-buffers, which would bury the live layers.
 *     A debounced restack re-anchors ours on top, self-echo suppressed so
 *     moveLayer's own `styledata` can't loop.
 *
 * Never invents a frame: a product with nothing at the current moment is
 * removed from the map rather than filled in with a neighbouring scan.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Coordinates, ImageSource, Map as MapLibreMap } from "maplibre-gl";
import { firstSymbolLayerId } from "@/components/map/storms-raster-layer";
import {
  RADAR_PRODUCTS,
  radarFrameUrl,
  type RadarFrameBounds,
  type RadarProduct,
  type RadarStep,
} from "@/hooks/useRadarFrames";

interface LayerSpec {
  product: RadarProduct;
  source: string;
  layer: string;
  opacity: number;
  /** Linear smooths the storm surface; nearest keeps hail colors honest. */
  resampling: "linear" | "nearest";
}

// Listed bottom → top. Inserting each one at the same label anchor lands the
// last-added on top, so this array IS the stacking order.
const SPECS: LayerSpec[] = [
  {
    product: "reflectivity",
    source: "hs-radar-src-reflectivity",
    layer: "hs-radar-reflectivity",
    // Context only — it must never compete with the hail layers.
    opacity: 0.3,
    resampling: "linear",
  },
  {
    product: "posh",
    source: "hs-radar-src-posh",
    layer: "hs-radar-posh",
    opacity: 0.5,
    // Nearest, not linear: interpolating between color-coded bins would
    // paint in-between colors that mean a probability nobody measured.
    resampling: "nearest",
  },
  {
    product: "mesh",
    source: "hs-radar-src-mesh",
    layer: "hs-radar-mesh",
    opacity: 0.85,
    resampling: "nearest",
  },
];

/** How many frames to pre-warm at once. */
const PRELOAD_CONCURRENCY = 3;
/** Coalesce restack requests fired in a burst. */
const RESTACK_DEBOUNCE_MS = 120;
/** Ignore `styledata` for this long after our own moveLayer calls. */
const RESTACK_ECHO_MS = 500;

/** MapLibre wants the corners as [top-left, top-right, bottom-right, bottom-left]. */
function boundsToCorners(b: RadarFrameBounds): Coordinates {
  return [
    [b.min_lng, b.max_lat],
    [b.max_lng, b.max_lat],
    [b.max_lng, b.min_lat],
    [b.min_lng, b.min_lat],
  ];
}

function removeSpec(map: MapLibreMap, spec: LayerSpec) {
  try {
    if (map.getLayer(spec.layer)) map.removeLayer(spec.layer);
    if (map.getSource(spec.source)) map.removeSource(spec.source);
  } catch {
    /* style swapped mid-remove — the swap already took it */
  }
}

function removeAll(map: MapLibreMap) {
  for (const spec of SPECS) removeSpec(map, spec);
}

interface Props {
  map: MapLibreMap | null;
  /** The aligned moment to paint. null → nothing to draw. */
  step: RadarStep | null;
  /** Every step in the loop, pre-warmed so animation doesn't flicker. */
  steps?: RadarStep[];
  visible?: boolean;
}

export function LiveRadarLayer({ map, step, steps = [], visible = true }: Props) {
  const [styleEpoch, setStyleEpoch] = useState(0);
  /** Frame id currently painted per product — skips redundant image swaps. */
  const paintedRef = useRef<Partial<Record<RadarProduct, string>>>({});
  /** True while we have at least one source on the map. */
  const mountedLayersRef = useRef(false);
  /** Frame ids already sent to the cache warmer. */
  const preloadedRef = useRef<Set<string>>(new Set());
  const restackTimerRef = useRef<number | null>(null);
  const restackEchoUntilRef = useRef(0);

  // Re-anchor our three layers just under the basemap labels, in order, so
  // they sit above whatever else was inserted at the same anchor since.
  const scheduleRestack = useCallback(() => {
    if (!map || restackTimerRef.current != null) return;
    restackTimerRef.current = window.setTimeout(() => {
      restackTimerRef.current = null;
      const anchor = firstSymbolLayerId(map);
      try {
        for (const spec of SPECS) {
          if (map.getLayer(spec.layer)) map.moveLayer(spec.layer, anchor);
        }
      } catch {
        /* style swapped mid-restack — the re-add path will redo the order */
      }
      // moveLayer fires `styledata` a frame later; ignore that echo so the
      // restack can't retrigger itself forever.
      restackEchoUntilRef.current = Date.now() + RESTACK_ECHO_MS;
    }, RESTACK_DEBOUNCE_MS);
  }, [map]);

  // A basemap swap wipes every source. Bump the epoch so the paint effect
  // re-adds them; also restack when someone else inserts at our anchor.
  useEffect(() => {
    if (!map) return;
    const onStyle = () => {
      if (!mountedLayersRef.current) return;
      if (Date.now() < restackEchoUntilRef.current) return;
      const present = SPECS.some((s) => map.getSource(s.source));
      if (!present) {
        mountedLayersRef.current = false;
        paintedRef.current = {};
        setStyleEpoch((e) => e + 1);
        return;
      }
      scheduleRestack();
    };
    map.on("styledata", onStyle);
    return () => {
      map.off("styledata", onStyle);
    };
  }, [map, scheduleRestack]);

  // Paint the current moment.
  useEffect(() => {
    if (!map) return;

    // Switched off, or nothing to show — tear the overlay down rather than
    // park a stale frame under a zero opacity.
    if (!visible || !step) {
      if (mountedLayersRef.current) {
        removeAll(map);
        mountedLayersRef.current = false;
        paintedRef.current = {};
      }
      return;
    }

    const apply = () => {
      let restack = false;

      for (const spec of SPECS) {
        const frame = step[spec.product];

        // No frame for this product at this moment: draw nothing. Reaching
        // for the neighbouring scan would put hail on the map at a time it
        // wasn't falling.
        if (!frame) {
          if (map.getSource(spec.source)) {
            removeSpec(map, spec);
            delete paintedRef.current[spec.product];
            restack = true;
          }
          continue;
        }

        const url = radarFrameUrl(frame);
        const coordinates = boundsToCorners(frame.bounds);

        // A style swap can land between two iterations of this loop, which
        // turns addSource/updateImage into a throw. One product failing to
        // paint must not take the map (or the other two) down — the next
        // step, or the styleEpoch re-add, picks it back up.
        try {
          const existing = map.getSource<ImageSource>(spec.source);

          if (existing) {
            if (paintedRef.current[spec.product] !== frame.id) {
              // Coordinates go along for the ride — frames can shift extent
              // between scans, and updateImage sets both in one pass.
              existing.updateImage({ url, coordinates });
              paintedRef.current[spec.product] = frame.id;
            }
            continue;
          }

          map.addSource(spec.source, { type: "image", url, coordinates });
          map.addLayer(
            {
              id: spec.layer,
              type: "raster",
              source: spec.source,
              paint: {
                "raster-opacity": spec.opacity,
                "raster-resampling": spec.resampling,
                // No cross-fade: stepping the loop should cut, not dissolve.
                "raster-fade-duration": 0,
              },
            },
            firstSymbolLayerId(map),
          );
          paintedRef.current[spec.product] = frame.id;
          mountedLayersRef.current = true;
          restack = true;
        } catch {
          delete paintedRef.current[spec.product];
        }
      }

      if (restack) scheduleRestack();
    };

    // isStyleLoaded() reads false during any tile/data churn, and
    // once("style.load") only fires on a real basemap swap — so poll until
    // the style is ready instead of risking a paint that silently never
    // happens (the same trap storms-raster-layer documents).
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const tryApply = () => {
      if (map.isStyleLoaded()) {
        apply();
        return;
      }
      retryTimer = setTimeout(tryApply, 200);
    };
    tryApply();

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [map, step, visible, styleEpoch, scheduleRestack]);

  // Warm the browser cache for the whole loop, newest moment first, so
  // stepping through it paints instantly. Failures are swallowed on purpose:
  // a frame we can't pre-fetch just loads normally (or stays blank).
  useEffect(() => {
    if (!visible || !steps.length) return;

    const seen = preloadedRef.current;
    const queue: string[] = [];
    for (let i = steps.length - 1; i >= 0; i--) {
      for (const product of RADAR_PRODUCTS) {
        const frame = steps[i][product];
        if (!frame || seen.has(frame.id)) continue;
        seen.add(frame.id);
        queue.push(radarFrameUrl(frame));
      }
    }
    if (!queue.length) return;

    let cancelled = false;
    const worker = async () => {
      while (!cancelled) {
        const url = queue.shift();
        if (!url) return;
        try {
          await fetch(url, { cache: "force-cache" });
        } catch {
          /* offline / CORS / 404 — MapLibre will surface it the same way */
        }
      }
    };
    void Promise.all(
      Array.from({ length: PRELOAD_CONCURRENCY }, () => worker()),
    );

    return () => {
      cancelled = true;
    };
  }, [visible, steps]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (restackTimerRef.current != null) {
        window.clearTimeout(restackTimerRef.current);
        restackTimerRef.current = null;
      }
      if (!map) return;
      removeAll(map);
      mountedLayersRef.current = false;
      paintedRef.current = {};
    };
  }, [map]);

  return null;
}
