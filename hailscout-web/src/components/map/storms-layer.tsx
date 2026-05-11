"use client";

/**
 * Live-data storms layer.
 *
 * Renders hail-swath polygon bands AND storm centroids on the MapLibre
 * map from a `StormWithSwaths[]` array. Designed to swap in for
 * `<StormFixturesLayer>` once `/v1/storms?include=swaths` has data.
 *
 * Two render layers:
 *   - swath polygons (per-category color, painted smallest-first so
 *     larger-hail bands sit on top — same visual logic as HailTrace
 *     and Interactive Hail Maps).
 *   - centroids (colored circle sized by peak hail size).
 *
 * Filter behavior matches StormFixturesLayer:
 *   - `minSizeIn` hides storms / swath bands below the threshold
 *   - `startTimeMin` / `startTimeMax` window the time range
 */

import { useEffect, useMemo } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { StormWithSwaths } from "@/hooks/useStorms";

const SOURCE_BANDS = "hs-live-bands";
const SOURCE_CENTROIDS = "hs-live-centroids";
const LAYER_FILL = "hs-live-fill";
const LAYER_LINE = "hs-live-line";
const LAYER_CENTROID = "hs-live-centroid";
const LAYER_CENTROID_RING = "hs-live-centroid-ring";

interface Props {
  map: MapLibreMap | null;
  storms: StormWithSwaths[];
  visible?: boolean;
  /** Unix-millis cutoff. Storms started before this are hidden. */
  startTimeMin?: number | null;
  /** Hail size threshold in inches. Storms / bands below this are hidden. */
  minSizeIn?: number;
  /** Time scrubber cursor. Storms started after this are hidden. */
  startTimeMax?: number | null;
}

/** Map hail_size_category label (e.g. "1.5", "3.0+") → min inches. */
function categoryToMinInches(label: string): number {
  const n = parseFloat(label.replace("+", ""));
  return Number.isFinite(n) ? n : 0;
}

function buildCentroidFC(storms: StormWithSwaths[]): GeoJSON.FeatureCollection {
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

function buildBandsFC(storms: StormWithSwaths[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const s of storms) {
    if (!s.swaths) continue;
    for (const sw of s.swaths) {
      if (!sw.geometry) continue;
      features.push({
        type: "Feature",
        geometry: sw.geometry,
        properties: {
          storm_id: s.id,
          min_size_in: categoryToMinInches(sw.hail_size_category),
          start_time: s.start_time,
        },
      });
    }
  }
  // Smallest-hail bands drawn first so larger-hail bands stack on top.
  features.sort(
    (a, b) =>
      (Number(a.properties?.min_size_in) || 0) -
      (Number(b.properties?.min_size_in) || 0),
  );
  return { type: "FeatureCollection", features };
}

export function StormsLayer({
  map,
  storms,
  visible = true,
  startTimeMin = null,
  minSizeIn = 0,
  startTimeMax = null,
}: Props) {
  // Filtered storms (applied to both centroids and bands).
  const filtered = useMemo(() => {
    return storms.filter((s) => {
      if (s.max_hail_size_in < minSizeIn) return false;
      const t = new Date(s.start_time).getTime();
      if (startTimeMin !== null && t < startTimeMin) return false;
      if (startTimeMax !== null && t > startTimeMax) return false;
      return true;
    });
  }, [storms, minSizeIn, startTimeMin, startTimeMax]);

  // ── Layer setup (once per map / per style swap) ──────────────────
  useEffect(() => {
    if (!map) return;

    const addLayers = () => {
      if (map.getSource(SOURCE_BANDS)) return;

      // Bands source (loaded empty; populated by the data effect).
      map.addSource(SOURCE_BANDS, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: LAYER_FILL,
        type: "fill",
        source: SOURCE_BANDS,
        paint: {
          "fill-color": [
            "step", ["get", "min_size_in"],
            "#36C168",
            1.0, "#F2D530",
            1.5, "#EA7A2C",
            1.75, "#D9462F",
            2.0, "#A11F2A",
            2.5, "#D45BAA",
            2.75, "#8E3CA8",
            3.0, "#4A2070",
          ],
          "fill-opacity": [
            "interpolate", ["linear"], ["get", "min_size_in"],
            0.5, 0.34,
            1.0, 0.42,
            1.5, 0.52,
            2.0, 0.62,
            2.75, 0.72,
            3.0, 0.78,
          ],
        },
      });

      map.addLayer({
        id: LAYER_LINE,
        type: "line",
        source: SOURCE_BANDS,
        paint: {
          "line-color": [
            "step", ["get", "min_size_in"],
            "#1F8B47",
            1.0, "#B89A23",
            1.5, "#B85920",
            1.75, "#9B311F",
            2.0, "#741A1F",
            2.5, "#9C3F7A",
            2.75, "#62286F",
            3.0, "#2B1340",
          ],
          "line-width": [
            "interpolate", ["linear"], ["get", "min_size_in"],
            0.75, 0.4,
            1.5, 0.7,
            2.5, 1.1,
            3.0, 1.4,
          ],
          "line-opacity": 0.85,
        },
      });

      // Centroid source + layers — painted ON TOP of polygons.
      map.addSource(SOURCE_CENTROIDS, {
        type: "geojson",
        data: buildCentroidFC([]),
      });

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
          "circle-color": [
            "step", ["get", "peak_size_in"],
            "#36C168", 1.0, "#F2D530", 1.5, "#EA7A2C", 1.75, "#D9462F",
            2.0, "#A11F2A", 2.5, "#D45BAA", 2.75, "#8E3CA8", 3.0, "#4A2070",
          ],
          "circle-opacity": 0.18,
          "circle-stroke-width": 0,
        },
      });

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
          "circle-color": [
            "step", ["get", "peak_size_in"],
            "#36C168", 1.0, "#F2D530", 1.5, "#EA7A2C", 1.75, "#D9462F",
            2.0, "#A11F2A", 2.5, "#D45BAA", 2.75, "#8E3CA8", 3.0, "#4A2070",
          ],
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
      if (!map.getSource(SOURCE_BANDS)) addLayers();
    };
    map.on("styledata", onStyle);

    return () => {
      map.off("styledata", onStyle);
    };
  }, [map]);

  // ── Data effect: push filtered storms into both sources ─────────
  useEffect(() => {
    if (!map) return;
    const bsrc = map.getSource(SOURCE_BANDS);
    const csrc = map.getSource(SOURCE_CENTROIDS);
    if (!bsrc || !csrc) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (csrc as any).setData(buildCentroidFC(filtered));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (bsrc as any).setData(buildBandsFC(filtered));
  }, [map, filtered]);

  // ── Band-size filter (applied via setFilter on the layers) ───────
  useEffect(() => {
    if (!map) return;
    const bandFilter =
      minSizeIn > 0
        ? ["all", [">=", ["get", "min_size_in"], minSizeIn]]
        : null;
    if (map.getLayer(LAYER_FILL)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.setFilter(LAYER_FILL, bandFilter as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.setFilter(LAYER_LINE, bandFilter as any);
    }
  }, [map, minSizeIn]);

  // ── Visibility toggle ────────────────────────────────────────────
  useEffect(() => {
    if (!map) return;
    const v = visible ? "visible" : "none";
    for (const id of [LAYER_FILL, LAYER_LINE, LAYER_CENTROID, LAYER_CENTROID_RING]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", v);
    }
  }, [map, visible]);

  return null;
}
