"use client";

/**
 * Storm density heatmap.
 *
 * MapLibre native `type: "heatmap"` layer fed by the same Storm
 * centroid set the StormsLayer renders as discrete dots. Two big
 * differences:
 *
 * 1. Each storm contributes a *weighted* density value based on its
 *    peak hail size — bigger storms produce hotter spots. The
 *    `heatmap-weight` expression scales from 0.05 (0.5" pea) to 1.0
 *    (3.0"+ softball), so the heatmap doesn't get washed out by the
 *    high count of light-hail cells.
 *
 * 2. Radius + intensity ramp with zoom so the heatmap is readable at
 *    CONUS scale AND zoomed in. Below zoom 8 we mostly want a
 *    density wash; above zoom 8 individual cells should start
 *    resolving back into separate hot spots.
 *
 * Used as an alternative view mode on /app/map. When active, the
 * regular cells layer typically hides itself so the heatmap reads
 * cleanly.
 */

import { useEffect, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Storm } from "@/lib/api-types";

const SOURCE_ID = "hs-heatmap";
const LAYER_HEAT = "hs-heatmap-heat";
const LAYER_DOTS = "hs-heatmap-dots"; // tiny solid dots at high zoom

interface Props {
  map: MapLibreMap | null;
  storms: Storm[];
  visible?: boolean;
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
      },
    })),
  };
}

export function StormsHeatmapLayer({ map, storms, visible = true }: Props) {
  const [styleEpoch, setStyleEpoch] = useState(0);

  useEffect(() => {
    if (!map) return;

    const addLayers = () => {
      if (map.getSource(SOURCE_ID)) return;
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: buildFeatureCollection([]),
      });

      map.addLayer({
        id: LAYER_HEAT,
        type: "heatmap",
        source: SOURCE_ID,
        maxzoom: 14,
        paint: {
          // Weight = how much each storm pushes density up. Severe
          // storms (≥ 2.0") count for 5-20× a single penny-tier cell.
          "heatmap-weight": [
            "interpolate", ["linear"], ["get", "peak_size_in"],
            0.5, 0.05,
            1.0, 0.20,
            1.5, 0.50,
            2.0, 0.80,
            3.0, 1.00,
          ],
          // Intensity bumps with zoom so heatmap stays vivid as
          // points spread apart. At z3 a few weights are enough; at
          // z10 we need more to keep the same color saturation.
          "heatmap-intensity": [
            "interpolate", ["linear"], ["zoom"],
            3, 0.6,
            6, 1.4,
            10, 3.0,
          ],
          // Topographic-palette gradient: teal (low) → amber → copper
          // → brick → plum (high). Matches the hail-size palette so
          // the heatmap colors read consistent with the per-cell view.
          "heatmap-color": [
            "interpolate", ["linear"], ["heatmap-density"],
            0.00, "rgba(0,0,0,0)",
            0.10, "rgba(93,202,165,0.35)",
            0.25, "rgba(226,184,67,0.55)",
            0.45, "rgba(216,138,61,0.70)",
            0.65, "rgba(196,100,52,0.80)",
            0.80, "rgba(168,65,45,0.85)",
            0.92, "rgba(130,36,36,0.90)",
            1.00, "rgba(31,27,51,0.92)",
          ],
          // Pixel radius scales with zoom — wider at low zoom for a
          // continental wash, tighter at high zoom for cell resolution.
          "heatmap-radius": [
            "interpolate", ["linear"], ["zoom"],
            3, 18,
            6, 32,
            10, 60,
          ],
          // Fade out as we zoom past 10 so individual cells take over.
          "heatmap-opacity": [
            "interpolate", ["linear"], ["zoom"],
            7, 1,
            12, 0.4,
            14, 0,
          ],
        },
      });

      // Tiny dot layer that takes over at high zoom — gives the user
      // something to interact with when heatmap fades out.
      map.addLayer({
        id: LAYER_DOTS,
        type: "circle",
        source: SOURCE_ID,
        minzoom: 10,
        paint: {
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            10, 3,
            14, 6,
          ],
          "circle-color": [
            "step", ["get", "peak_size_in"],
            "#5DCAA5", 1.0, "#E2B843", 1.5, "#C46434",
            2.0, "#822424", 3.0, "#1F1B33",
          ],
          "circle-stroke-color": "#FAF7F1",
          "circle-stroke-width": 1.2,
          "circle-opacity": [
            "interpolate", ["linear"], ["zoom"],
            10, 0,
            12, 0.85,
            14, 1.0,
          ],
        },
      });
    };

    if (map.isStyleLoaded()) {
      addLayers();
    } else {
      map.once("style.load", addLayers);
    }

    const onStyle = () => {
      if (!map.getSource(SOURCE_ID)) {
        addLayers();
        setStyleEpoch((e) => e + 1);
      }
    };
    map.on("styledata", onStyle);
    return () => {
      map.off("styledata", onStyle);
    };
  }, [map]);

  // Push data on storms / style change
  useEffect(() => {
    if (!map) return;
    const src = map.getSource(SOURCE_ID);
    if (!src) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (src as any).setData(buildFeatureCollection(storms));
  }, [map, storms, styleEpoch]);

  // Visibility toggle
  useEffect(() => {
    if (!map) return;
    const v = visible ? "visible" : "none";
    for (const id of [LAYER_HEAT, LAYER_DOTS]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", v);
    }
  }, [map, visible, styleEpoch]);

  return null;
}
