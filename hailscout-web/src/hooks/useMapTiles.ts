/**
 * Hook for managing MapLibre GL JS vector tile layers.
 * Adds swath tiles from the hailscout-tiles service.
 */

"use client";

import { useEffect } from "react";
import { useRef } from "react";
import type { Map } from "maplibre-gl";
import { env } from "@/lib/env";
import { HAIL_SIZE_COLORS } from "@/lib/constants";

export function useMapTiles(map: Map | null) {
  const tilesAddedRef = useRef(false);

  useEffect(() => {
    if (!map || tilesAddedRef.current) return;

    // Wait for style to load
    map.on("style.load", () => {
      // Add vector tile source for current swaths
      // TODO: tiles.hailscout.com will provide this endpoint via the ML/Swath agent (PRD §2.5)
      if (!map.getSource("swaths")) {
        map.addSource("swaths", {
          type: "vector",
          tiles: [
            `${env.NEXT_PUBLIC_TILES_BASE_URL}/swaths/{z}/{x}/{y}.pbf`,
          ],
          minzoom: 6,
          maxzoom: 14,
        });

        // Add layer with color-based styling by hail size
        // Layer will render once tiles are served and data is available
        map.addLayer(
          {
            id: "swaths-layer",
            type: "fill",
            source: "swaths",
            "source-layer": "swaths",
            layout: {
              visibility: "visible",
            },
            paint: {
              "fill-color": [
                "case",
                ["==", ["feature-state", "hail_size"], 0.75],
                HAIL_SIZE_COLORS["0.75"],
                ["==", ["feature-state", "hail_size"], 1.0],
                HAIL_SIZE_COLORS["1.0"],
                ["==", ["feature-state", "hail_size"], 1.25],
                HAIL_SIZE_COLORS["1.25"],
                ["==", ["feature-state", "hail_size"], 1.5],
                HAIL_SIZE_COLORS["1.5"],
                ["==", ["feature-state", "hail_size"], 1.75],
                HAIL_SIZE_COLORS["1.75"],
                ["==", ["feature-state", "hail_size"], 2.0],
                HAIL_SIZE_COLORS["2.0"],
                ["==", ["feature-state", "hail_size"], 2.5],
                HAIL_SIZE_COLORS["2.5"],
                HAIL_SIZE_COLORS["3.0+"], // default for 3.0+
              ],
              "fill-opacity": 0.6,
            },
          },
          "water" // Insert before water layer
        );

        // Optional: add a 1px border
        map.addLayer(
          {
            id: "swaths-border",
            type: "line",
            source: "swaths",
            "source-layer": "swaths",
            paint: {
              "line-color": "#000",
              "line-width": 1,
              "line-opacity": 0.3,
            },
          },
          "water"
        );
      }

      tilesAddedRef.current = true;
    });

    return () => {
      // Cleanup on unmount
      if (map) {
        map.off("style.load", () => {});
      }
    };
  }, [map]);
}
