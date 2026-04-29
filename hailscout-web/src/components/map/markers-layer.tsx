"use client";

import { useEffect, useRef } from "react";
import type { Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";
import { MARKER_STATUSES, type Marker } from "@/lib/markers";

const SOURCE_ID = "hs-canvass-markers";
const HALO_LAYER = "hs-canvass-halo";
const DOT_LAYER  = "hs-canvass-dot";

interface Props {
  map: MapLibreMap | null;
  markers: Marker[];
  onMarkerClick?: (id: string) => void;
}

/**
 * Renders canvassing markers as colored dots (status-encoded) with a
 * subtle white-ringed halo. Clicking a dot fires onMarkerClick.
 */
export function MarkersLayer({ map, markers, onMarkerClick }: Props) {
  const handlersRef = useRef<{ click?: (e: MapMouseEvent) => void }>({});

  // Initial layer creation. Re-runs on style swap (we listen to styledata).
  useEffect(() => {
    if (!map) return;

    const colorStops: (string | number)[] = [];
    for (const s of MARKER_STATUSES) {
      colorStops.push(s.id, s.color);
    }
    const addLayers = () => {
      if (map.getSource(SOURCE_ID)) return;
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      // MapLibre's `match` expression types can't infer that ...colorStops
      // provides paired (input, output) entries from a generic spread.
      // The runtime contract is correct (alternating MarkerStatus -> hex),
      // so cast through unknown to satisfy the strict expression type.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const colorMatch: any = ["match", ["get", "status"], ...colorStops, "#888"];

      map.addLayer({
        id: HALO_LAYER,
        type: "circle",
        source: SOURCE_ID,
        paint: {
          "circle-radius": 11,
          "circle-color": colorMatch,
          "circle-opacity": 0.18,
        },
      });

      map.addLayer({
        id: DOT_LAYER,
        type: "circle",
        source: SOURCE_ID,
        paint: {
          "circle-radius": 6,
          "circle-color": colorMatch,
          "circle-stroke-color": "#FFFFFF",
          "circle-stroke-width": 2,
        },
      });

      // Click handler for markers
      const handler = (e: MapMouseEvent) => {
        const features = map.queryRenderedFeatures(e.point, { layers: [DOT_LAYER] });
        if (features.length > 0) {
          const id = features[0].properties?.id as string | undefined;
          if (id) {
            e.preventDefault();
            onMarkerClick?.(id);
          }
        }
      };
      map.on("click", handler);
      handlersRef.current.click = handler;

      // Cursor feedback
      map.on("mouseenter", DOT_LAYER, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", DOT_LAYER, () => {
        map.getCanvas().style.cursor = "";
      });
    };

    if (map.isStyleLoaded()) addLayers();
    else map.once("style.load", addLayers);

    const onStyle = () => {
      if (!map.getSource(SOURCE_ID)) addLayers();
    };
    map.on("styledata", onStyle);

    return () => {
      map.off("styledata", onStyle);
      if (handlersRef.current.click) map.off("click", handlersRef.current.click);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Push marker data into the source
  useEffect(() => {
    if (!map) return;
    const src = map.getSource(SOURCE_ID);
    if (!src) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (src as any).setData({
      type: "FeatureCollection",
      features: markers.map((m) => ({
        type: "Feature",
        id: m.id,
        geometry: { type: "Point", coordinates: [m.lng, m.lat] },
        properties: { ...m },
      })),
    });
  }, [map, markers]);

  return null;
}
