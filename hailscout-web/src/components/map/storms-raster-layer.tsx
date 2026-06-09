"use client";

/**
 * Smooth hail-intensity raster layer (Phase 25 — beat the blobs).
 *
 * Renders the server-rendered viewport raster (one colorized PNG of every
 * storm's swaths, blurred into a continuous gradient) as a MapLibre `image`
 * source with `raster-resampling: linear`.
 *
 * MapLibre `image` sources can't update their coordinates in place, so a new
 * raster needs a fresh source. The naive approach (remove old → add new) leaves
 * a one-frame gap where NOTHING is on screen — that's the "swath vanishes for a
 * moment when I pan/zoom" flicker. Instead we DOUBLE-BUFFER across two slots:
 * add the new image on top, and retire the old slot only once the new one has
 * actually painted (`idle`). A raster is therefore always on screen.
 */

import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { ViewportRaster } from "@/hooks/useViewportRaster";

const SLOTS = [
  { src: "hs-raster-0", layer: "hs-raster-layer-0" },
  { src: "hs-raster-1", layer: "hs-raster-layer-1" },
] as const;

interface Props {
  map: MapLibreMap | null;
  raster?: ViewportRaster;
  visible?: boolean;
  /** Opacity of the raster surface (0-1). */
  opacity?: number;
}

export function StormsRasterLayer({
  map,
  raster,
  visible = true,
  opacity = 0.82,
}: Props) {
  const [styleEpoch, setStyleEpoch] = useState(0);
  const activeRef = useRef<number>(-1); // slot index currently showing the raster
  const lastKeyRef = useRef<string | null>(null);

  // Re-add the layer after a basemap style swap (sources are wiped).
  useEffect(() => {
    if (!map) return;
    const onStyle = () => {
      const present = SLOTS.some((s) => map.getSource(s.src));
      if (!present) {
        activeRef.current = -1; // force re-add of the image
        lastKeyRef.current = null;
        setStyleEpoch((e) => e + 1);
      }
    };
    map.on("styledata", onStyle);
    return () => {
      map.off("styledata", onStyle);
    };
  }, [map]);

  // Push each new raster into the INACTIVE slot, then retire the old slot once
  // the new image has painted — so a raster is always on screen (no flicker).
  useEffect(() => {
    if (!map || !raster) return;

    const apply = () => {
      const key = `${raster.image.length}:${raster.coordinates.flat().join(",")}`;
      if (key === lastKeyRef.current && activeRef.current >= 0) return;
      lastKeyRef.current = key;

      const prev = activeRef.current;
      const next = prev === 0 ? 1 : 0;
      const ns = SLOTS[next];

      // Clean the target slot in case a stale copy lingers there.
      if (map.getLayer(ns.layer)) map.removeLayer(ns.layer);
      if (map.getSource(ns.src)) map.removeSource(ns.src);

      map.addSource(ns.src, {
        type: "image",
        url: raster.image,
        // MapLibre wants an exact 4-corner tuple [TL,TR,BR,BL].
        coordinates: raster.coordinates as [
          [number, number],
          [number, number],
          [number, number],
          [number, number],
        ],
      });
      map.addLayer({
        id: ns.layer,
        type: "raster",
        source: ns.src,
        paint: {
          "raster-opacity": visible ? opacity : 0,
          // Linear resampling = the smooth interpolation between grid cells.
          "raster-resampling": "linear",
          // No fade — the new image pops straight in over the old one, which
          // is still beneath it until we retire it below. Zero-gap swap.
          "raster-fade-duration": 0,
        },
      });
      activeRef.current = next;

      // Retire the PREVIOUS slot once the new raster has rendered.
      if (prev >= 0) {
        const ps = SLOTS[prev];
        const retire = () => {
          // Guard: only remove if it's still the stale slot (rapid pans can
          // ping-pong back before idle fires).
          if (activeRef.current === prev) return;
          if (map.getLayer(ps.layer)) map.removeLayer(ps.layer);
          if (map.getSource(ps.src)) map.removeSource(ps.src);
        };
        map.once("idle", retire);
      }
    };

    if (map.isStyleLoaded()) apply();
    else map.once("style.load", apply);
  }, [map, raster, styleEpoch, opacity, visible]);

  // Visibility / opacity toggle without re-adding (acts on the active slot).
  useEffect(() => {
    if (!map) return;
    const a = activeRef.current;
    if (a < 0) return;
    const { layer } = SLOTS[a];
    if (map.getLayer(layer)) {
      map.setPaintProperty(layer, "raster-opacity", visible ? opacity : 0);
    }
  }, [map, visible, opacity, styleEpoch, raster]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (!map) return;
      try {
        for (const s of SLOTS) {
          if (map.getLayer(s.layer)) map.removeLayer(s.layer);
          if (map.getSource(s.src)) map.removeSource(s.src);
        }
      } catch {
        /* style already torn down */
      }
    };
  }, [map]);

  return null;
}
