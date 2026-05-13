"use client";

/**
 * NEXRAD station overlay for /app/map.
 *
 * Renders each WSR-88D site in CONUS_NEXRAD_STATIONS as a small
 * teal-glow dot. Visible from zoom 4+, label appears at zoom 6+.
 *
 * Purpose: gives users a visual preview of where sub-km radar
 * coverage will come from once the Phase 18 NEXRAD service is
 * online. Until then, the dots are aspirational — but visible
 * proof that the pipeline knows where to fetch from.
 */

import { useEffect, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { CONUS_NEXRAD_STATIONS } from "@/lib/nexrad-stations";

const SOURCE_ID = "hs-nexrad-stations";
const LAYER_DOT = "hs-nexrad-dot";
const LAYER_GLOW = "hs-nexrad-glow";
const LAYER_LABEL = "hs-nexrad-label";

interface Props {
  map: MapLibreMap | null;
  visible?: boolean;
}

export function NexradStationsLayer({ map, visible = true }: Props) {
  // styleEpoch bumps on basemap swap; data effect re-pushes the
  // FeatureCollection onto the recreated source.
  const [styleEpoch, setStyleEpoch] = useState(0);

  useEffect(() => {
    if (!map) return;

    const addLayers = () => {
      if (map.getSource(SOURCE_ID)) return;

      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: CONUS_NEXRAD_STATIONS.map((s) => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [s.lng, s.lat] },
            properties: {
              code: s.code,
              name: s.name,
              label: `${s.code} · ${s.name}`,
              state: s.state,
            },
          })),
        },
      });

      // Soft halo underneath the dot — implies coverage footprint.
      map.addLayer({
        id: LAYER_GLOW,
        type: "circle",
        source: SOURCE_ID,
        minzoom: 4,
        paint: {
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            4, 6,
            7, 14,
            10, 28,
          ],
          // Teal — different from MRMS/NEXRAD hail-cell colors so the
          // stations layer reads as infrastructure, not weather.
          "circle-color": "#0F4C5C",
          "circle-opacity": 0.10,
          "circle-stroke-width": 0,
          "circle-blur": 0.3,
        },
      });

      // Solid dot
      map.addLayer({
        id: LAYER_DOT,
        type: "circle",
        source: SOURCE_ID,
        minzoom: 4,
        paint: {
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            4, 2.5,
            7, 4,
            10, 6,
          ],
          "circle-color": "#0F4C5C",
          "circle-stroke-color": "#FAF7F1",
          "circle-stroke-width": 1.2,
          "circle-opacity": 0.85,
        },
      });

      // Label — code + name, kicks in at zoom 6
      map.addLayer({
        id: LAYER_LABEL,
        type: "symbol",
        source: SOURCE_ID,
        minzoom: 6,
        layout: {
          "text-field": ["get", "code"],
          "text-anchor": "left",
          "text-offset": [0.7, 0],
          "text-size": [
            "interpolate", ["linear"], ["zoom"],
            6, 9,
            10, 12,
          ],
          "text-allow-overlap": false,
          "text-padding": 3,
        },
        paint: {
          "text-color": "#0F4C5C",
          "text-halo-color": "#FAF7F1",
          "text-halo-width": 1.2,
          "text-halo-blur": 0.2,
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

  // Bump styleEpoch so the visibility effect re-runs after a style swap.
  useEffect(() => {
    if (!map) return;
    const v = visible ? "visible" : "none";
    for (const id of [LAYER_GLOW, LAYER_DOT, LAYER_LABEL]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", v);
    }
  }, [map, visible, styleEpoch]);

  return null;
}
