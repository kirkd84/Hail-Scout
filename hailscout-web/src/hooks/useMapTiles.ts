"use client";

/**
 * Hail-swath vector tile layer (production source).
 *
 * Adds a vector source pointing at the tile service (`tiles.hailscout.com`)
 * and renders swaths colored by hail size. The tile service isn't deployed
 * yet, so we silently swallow source errors — the StormFixturesLayer
 * provides demo data on top of whatever this tries to render.
 *
 * Once the tile service is live, drop the silent error swallow and let
 * MapLibre report normally.
 */
import { useEffect, useRef } from "react";
import type { Map } from "maplibre-gl";
import { env } from "@/lib/env";

const TILE_SOURCE_ID = "hs-swaths";
const TILE_FILL_LAYER = "hs-swaths-fill";

export function useMapTiles(map: Map | null) {
  const addedRef = useRef(false);

  useEffect(() => {
    if (!map) return;

    const addTiles = () => {
      if (addedRef.current) return;
      if (map.getSource(TILE_SOURCE_ID)) return;

      try {
        map.addSource(TILE_SOURCE_ID, {
          type: "vector",
          tiles: [`${env.NEXT_PUBLIC_TILES_BASE_URL}/swaths/{z}/{x}/{y}.pbf`],
          minzoom: 6,
          maxzoom: 14,
        });

        map.addLayer({
          id: TILE_FILL_LAYER,
          type: "fill",
          source: TILE_SOURCE_ID,
          "source-layer": "swaths",
          paint: {
            "fill-color": [
              "step",
              ["coalesce", ["get", "max_size_in"], 0],
              "hsl(120, 30%, 42%)",
              1.0,  "hsl(42, 72%, 52%)",
              1.25, "hsl(30, 68%, 55%)",
              1.5,  "hsl(21, 65%, 55%)",
              1.75, "hsl(12, 60%, 48%)",
              2.0,  "hsl(0, 60%, 42%)",
              2.5,  "hsl(298, 40%, 35%)",
              3.0,  "hsl(245, 35%, 28%)",
            ],
            "fill-opacity": 0.45,
          },
        });

        addedRef.current = true;
      } catch {
        // Silent — tile service not deployed yet
      }
    };

    if (map.isStyleLoaded()) {
      addTiles();
    } else {
      map.once("style.load", addTiles);
    }

    // Re-add on style swaps (basemap toggle wipes sources)
    const onStyle = () => {
      addedRef.current = false;
      if (!map.getSource(TILE_SOURCE_ID)) addTiles();
    };
    map.on("styledata", onStyle);

    // Suppress the loud-error log when fetches 404. Map continues working.
    const onError = (e: { error?: Error; sourceId?: string }) => {
      if (e.sourceId === TILE_SOURCE_ID) e.error = undefined;
    };
    map.on("error", onError);

    return () => {
      map.off("styledata", onStyle);
      map.off("error", onError);
    };
  }, [map]);
}
