"use client";

import { useEffect } from "react";
import type { Map as MapLibreMap, ExpressionSpecification } from "maplibre-gl";
import { fixturesAsGeoJSON, STORM_FIXTURES } from "@/lib/storm-fixtures";
import { hailStepStops, hailStrokeStepStops } from "@/lib/hail";

const SOURCE_BANDS    = "hs-fx-bands";
const SOURCE_CENTROIDS = "hs-fx-centroids";
const LAYER_FILL      = "hs-fx-fill";
const LAYER_LINE      = "hs-fx-line";
const LAYER_CENTROID  = "hs-fx-centroid";
const LAYER_CENTROID_RING = "hs-fx-centroid-ring";

interface Props {
  map: MapLibreMap | null;
  visible?: boolean;
}

/**
 * Renders nested concentric hail bands per storm. Smaller hail bands
 * paint first (larger area, lighter color); larger-hail bands paint
 * on top (smaller area, darker color) — same visual logic as
 * HailTrace and Interactive Hail Maps.
 *
 * Color encoding: industry-standard `step` expression keyed off the
 * `min_size_in` property (green → yellow → orange → red → magenta →
 * purple). See `lib/hail.ts` for the canonical palette.
 */
export function StormFixturesLayer({ map, visible = true }: Props) {
  useEffect(() => {
    if (!map) return;

    const fillStepExpr: ExpressionSpecification = [
      "step",
      ["coalesce", ["get", "min_size_in"], 0],
      ...(hailStepStops() as (number | string)[]),
    ] as unknown as ExpressionSpecification;

    const strokeStepExpr: ExpressionSpecification = [
      "step",
      ["coalesce", ["get", "min_size_in"], 0],
      ...(hailStrokeStepStops() as (number | string)[]),
    ] as unknown as ExpressionSpecification;

    const addLayers = () => {
      if (map.getSource(SOURCE_BANDS)) return;

      // Sort source data so larger bands draw last (on top)
      const fc = fixturesAsGeoJSON();
      fc.features.sort(
        (a, b) =>
          (Number(a.properties?.min_size_in) || 0) -
          (Number(b.properties?.min_size_in) || 0),
      );

      map.addSource(SOURCE_BANDS, { type: "geojson", data: fc as GeoJSON.GeoJSON });

      map.addLayer({
        id: LAYER_FILL,
        type: "fill",
        source: SOURCE_BANDS,
        paint: {
          "fill-color": fillStepExpr,
          "fill-opacity": [
            "interpolate",
            ["linear"],
            ["get", "min_size_in"],
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
          "line-color": strokeStepExpr,
          "line-width": [
            "interpolate",
            ["linear"],
            ["get", "min_size_in"],
            0.75, 0.4,
            1.5, 0.7,
            2.5, 1.1,
            3.0, 1.4,
          ],
          "line-opacity": 0.85,
        },
      });

      // Storm centroids — small white-bordered dots sized by peak hail
      map.addSource(SOURCE_CENTROIDS, {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: STORM_FIXTURES.map((s) => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [s.centroid_lng, s.centroid_lat] },
            properties: {
              id: s.id,
              city: s.city,
              peak_size_in: s.max_hail_size_in,
              start_time: s.start_time,
            },
          })),
        },
      });

      // Halo ring (lighter, larger) — adds the "you are here" feel
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
            3.5,  20,
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

    // Re-add on every basemap-style swap (sources are wiped on setStyle)
    const onStyle = () => {
      if (!map.getSource(SOURCE_BANDS)) addLayers();
    };
    map.on("styledata", onStyle);

    return () => {
      map.off("styledata", onStyle);
    };
  }, [map]);

  // Visibility toggle
  useEffect(() => {
    if (!map) return;
    const layers = [LAYER_FILL, LAYER_LINE, LAYER_CENTROID_RING, LAYER_CENTROID];
    const v = visible ? "visible" : "none";
    for (const id of layers) {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, "visibility", v);
      }
    }
  }, [map, visible]);

  return null;
}
