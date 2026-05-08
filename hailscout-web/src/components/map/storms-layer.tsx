"use client";

/**
 * Live-data storms layer.
 *
 * Renders storm centroids (colored circles, sized + colored by peak hail
 * size) on the MapLibre map from a `Storm[]` array. Designed to swap in
 * for `<StormFixturesLayer>` once the live `/v1/storms` API has data.
 *
 * For now this layer renders centroids only; band-style polygon
 * rendering needs a `/v1/storms?include=swaths` API addition (so the
 * client doesn't have to fetch swaths one storm at a time). That's
 * the next iteration.
 *
 * Filter behavior matches StormFixturesLayer:
 *   - `minSizeIn` hides storms below the threshold
 *   - `startTimeMin` / `startTimeMax` window the time range
 */

import { useEffect } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Storm } from "@/lib/api-types";

const SOURCE_CENTROIDS = "hs-live-centroids";
const LAYER_CENTROID = "hs-live-centroid";
const LAYER_CENTROID_RING = "hs-live-centroid-ring";

interface Props {
  map: MapLibreMap | null;
  storms: Storm[];
  visible?: boolean;
  /** Unix-millis cutoff. Storms started before this are hidden. */
  startTimeMin?: number | null;
  /** Hail size threshold in inches. Storms below this are hidden. */
  minSizeIn?: number;
  /** Time scrubber cursor. Storms started after this are hidden. */
  startTimeMax?: number | null;
}

function buildFeatureCollection(storms: Storm[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: storms.map((s) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [s.centroid_lng, s.centroid_lat] },
      properties: {
        id: s.id,
        peak_size_in: s.max_hail_size_in,
        start_time: s.start_time,
      },
    })),
  };
}

export function StormsLayer({
  map,
  storms,
  visible = true,
  startTimeMin = null,
  minSizeIn = 0,
  startTimeMax = null,
}: Props) {
  // ── Layer setup (once per map / per style swap) ──────────────────
  useEffect(() => {
    if (!map) return;

    const addLayers = () => {
      if (map.getSource(SOURCE_CENTROIDS)) return;

      map.addSource(SOURCE_CENTROIDS, {
        type: "geojson",
        data: buildFeatureCollection([]),
      });

      // Halo ring — soft glow underneath
      map.addLayer({
        id: LAYER_CENTROID_RING,
        type: "circle",
        source: SOURCE_CENTROIDS,
        minzoom: 4,
        paint: {
          "circle-radius": [
            "interpolate", ["linear"], ["get", "peak_size_in"],
            0.75, 8,
            1.75, 12,
            2.75, 16,
            3.5, 20,
          ],
          "circle-color": ["step", ["get", "peak_size_in"], "#36C168", 1.0, "#F2D530", 1.5, "#EA7A2C", 1.75, "#D9462F", 2.0, "#A11F2A", 2.5, "#D45BAA", 2.75, "#8E3CA8", 3.0, "#4A2070"],
          "circle-opacity": 0.18,
          "circle-stroke-width": 0,
        },
      });

      // Solid centroid dot
      map.addLayer({
        id: LAYER_CENTROID,
        type: "circle",
        source: SOURCE_CENTROIDS,
        paint: {
          "circle-radius": [
            "interpolate", ["linear"], ["get", "peak_size_in"],
            0.75, 4,
            1.75, 5,
            3.5, 7,
          ],
          "circle-color": ["step", ["get", "peak_size_in"], "#36C168", 1.0, "#F2D530", 1.5, "#EA7A2C", 1.75, "#D9462F", 2.0, "#A11F2A", 2.5, "#D45BAA", 2.75, "#8E3CA8", 3.0, "#4A2070"],
          "circle-stroke-color": "#FAF7F1",
          "circle-stroke-width": 1.6,
          "circle-opacity": 1,
        },
      });
    };

    if (map.isStyleLoaded()) {
      addLayers();
    } else {
      map.once("style.load", addLayers);
    }

    // Re-add on basemap-style swap (sources are wiped on setStyle)
    const onStyle = () => {
      if (!map.getSource(SOURCE_CENTROIDS)) addLayers();
    };
    map.on("styledata", onStyle);

    return () => {
      map.off("styledata", onStyle);
    };
  }, [map]);

  // ── Source data: storms + time/size filtering ────────────────────
  useEffect(() => {
    if (!map) return;
    const src = map.getSource(SOURCE_CENTROIDS);
    if (!src) return;
    const filtered = storms.filter((s) => {
      if (s.max_hail_size_in < minSizeIn) return false;
      const t = new Date(s.start_time).getTime();
      if (startTimeMin !== null && t < startTimeMin) return false;
      if (startTimeMax !== null && t > startTimeMax) return false;
      return true;
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (src as any).setData(buildFeatureCollection(filtered));
  }, [map, storms, minSizeIn, startTimeMin, startTimeMax]);

  // ── Visibility toggle ────────────────────────────────────────────
  useEffect(() => {
    if (!map) return;
    const v = visible ? "visible" : "none";
    for (const id of [LAYER_CENTROID, LAYER_CENTROID_RING]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", v);
    }
  }, [map, visible]);

  return null;
}
