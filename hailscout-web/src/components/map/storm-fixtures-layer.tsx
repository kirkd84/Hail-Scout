"use client";

import { useEffect } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { fixturesAsGeoJSON, STORM_FIXTURES } from "@/lib/storm-fixtures";

const SOURCE_ID = "hs-storm-fixtures";
const FILL_LAYER_ID = "hs-storm-fixtures-fill";
const LINE_LAYER_ID = "hs-storm-fixtures-line";
const CENTROID_LAYER_ID = "hs-storm-fixtures-centroid";

interface Props {
  map: MapLibreMap | null;
  /** Whether to show the swath polygons. Default: true. */
  visible?: boolean;
}

/**
 * Renders the storm fixtures (10 hardcoded recent storms across the US
 * hail belt) as MapLibre layers on top of whichever basemap is active.
 *
 * The data is small enough to live entirely client-side; once the
 * tile-service / ingest pipeline ships, this layer becomes obsolete
 * and we render swaths from vector tiles instead.
 *
 * Color encoding: each polygon is filled with the topographic
 * hail-color "solid" stop matched to its max hail size. We bin via
 * a MapLibre data-driven `step` expression so the JS doesn't have to
 * iterate.
 */
export function StormFixturesLayer({ map, visible = true }: Props) {
  useEffect(() => {
    if (!map) return;

    const addLayers = () => {
      // Bail if the source already exists (e.g. style hot-swap re-runs this)
      if (map.getSource(SOURCE_ID)) return;

      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: fixturesAsGeoJSON() as GeoJSON.GeoJSON,
      });

      map.addLayer({
        id: FILL_LAYER_ID,
        type: "fill",
        source: SOURCE_ID,
        paint: {
          "fill-color": [
            "step",
            ["get", "max_hail_size_in"],
            "hsl(120, 30%, 42%)",
            1.0,  "hsl(42, 72%, 52%)",
            1.25, "hsl(30, 68%, 55%)",
            1.5,  "hsl(21, 65%, 55%)",
            1.75, "hsl(12, 60%, 48%)",
            2.0,  "hsl(0,  60%, 42%)",
            2.5,  "hsl(298, 40%, 35%)",
            3.0,  "hsl(245, 35%, 28%)",
          ],
          "fill-opacity": 0.32,
        },
      });

      map.addLayer({
        id: LINE_LAYER_ID,
        type: "line",
        source: SOURCE_ID,
        paint: {
          "line-color": [
            "step",
            ["get", "max_hail_size_in"],
            "hsl(120, 30%, 32%)",
            1.0,  "hsl(42, 72%, 38%)",
            1.25, "hsl(30, 68%, 38%)",
            1.5,  "hsl(21, 65%, 38%)",
            1.75, "hsl(12, 60%, 32%)",
            2.0,  "hsl(0,  60%, 30%)",
            2.5,  "hsl(298, 40%, 25%)",
            3.0,  "hsl(245, 35%, 18%)",
          ],
          "line-width": 1.4,
          "line-opacity": 0.85,
        },
      });

      // Centroid markers — small copper dots
      map.addSource(`${SOURCE_ID}-centroids`, {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: STORM_FIXTURES.map((s) => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [s.centroid_lng, s.centroid_lat] },
            properties: {
              id: s.id,
              city: s.city,
              max_hail_size_in: s.max_hail_size_in,
            },
          })),
        },
      });

      map.addLayer({
        id: CENTROID_LAYER_ID,
        type: "circle",
        source: `${SOURCE_ID}-centroids`,
        paint: {
          "circle-radius": 5,
          "circle-color": "hsl(21, 65%, 55%)",
          "circle-stroke-color": "hsl(36, 47%, 97%)",
          "circle-stroke-width": 2,
          "circle-opacity": 0.95,
        },
      });
    };

    if (map.isStyleLoaded()) {
      addLayers();
    } else {
      map.once("style.load", addLayers);
    }

    // Re-add on every styledata event (style swaps wipe sources)
    const onStyle = () => {
      if (!map.getSource(SOURCE_ID)) addLayers();
    };
    map.on("styledata", onStyle);

    return () => {
      map.off("styledata", onStyle);
      // Don't remove sources/layers on unmount — they persist with the map
    };
  }, [map]);

  // Toggle visibility without removing the layer
  useEffect(() => {
    if (!map || !map.getLayer(FILL_LAYER_ID)) return;
    const v = visible ? "visible" : "none";
    map.setLayoutProperty(FILL_LAYER_ID, "visibility", v);
    map.setLayoutProperty(LINE_LAYER_ID, "visibility", v);
    map.setLayoutProperty(CENTROID_LAYER_ID, "visibility", v);
  }, [map, visible]);

  return null;
}
