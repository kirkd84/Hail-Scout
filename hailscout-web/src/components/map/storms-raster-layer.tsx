"use client";

/**
 * Smooth hail-intensity raster layer (Phase 25 — beat the blobs).
 *
 * Renders the server-rendered viewport raster (one colorized PNG of
 * every storm's swaths, blurred into a continuous gradient) as a
 * MapLibre `image` source with `raster-resampling: linear`. The result
 * is the smooth, interpolated surface IHM/HailStrike show — replacing
 * the chunky discrete polygon bands.
 *
 * MapLibre `image` sources can't be updated in place when the image OR
 * the coordinates change, so on each new raster we remove + re-add the
 * source. Cheap (one small PNG) and avoids stale-coordinate artifacts.
 */

import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { ViewportRaster } from "@/hooks/useViewportRaster";

const SOURCE_ID = "hs-raster";
const LAYER_ID = "hs-raster-layer";

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
  const lastKeyRef = useRef<string | null>(null);

  // Re-add the layer after a basemap style swap (sources are wiped).
  useEffect(() => {
    if (!map) return;
    const onStyle = () => {
      if (!map.getSource(SOURCE_ID)) {
        lastKeyRef.current = null; // force re-add of the image
        setStyleEpoch((e) => e + 1);
      }
    };
    map.on("styledata", onStyle);
    return () => {
      map.off("styledata", onStyle);
    };
  }, [map]);

  // Push the raster image whenever it changes.
  useEffect(() => {
    if (!map || !raster) return;

    const apply = () => {
      // Skip if the same image is already mounted.
      const key = `${raster.image.length}:${raster.coordinates
        .flat()
        .join(",")}`;
      if (key === lastKeyRef.current && map.getSource(SOURCE_ID)) return;
      lastKeyRef.current = key;

      // Remove existing (image sources can't update coordinates in place)
      if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);

      map.addSource(SOURCE_ID, {
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
        id: LAYER_ID,
        type: "raster",
        source: SOURCE_ID,
        paint: {
          "raster-opacity": visible ? opacity : 0,
          // Linear resampling = the smooth interpolation between grid
          // cells. This is the single most important setting for the
          // "not blocky" look.
          "raster-resampling": "linear",
          "raster-fade-duration": 200,
        },
      });
    };

    if (map.isStyleLoaded()) apply();
    else map.once("style.load", apply);
  }, [map, raster, styleEpoch, opacity, visible]);

  // Visibility / opacity toggle without re-adding.
  useEffect(() => {
    if (!map || !map.getLayer(LAYER_ID)) return;
    map.setPaintProperty(LAYER_ID, "raster-opacity", visible ? opacity : 0);
  }, [map, visible, opacity, styleEpoch]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (!map) return;
      try {
        if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      } catch {
        /* style already torn down */
      }
    };
  }, [map]);

  return null;
}
