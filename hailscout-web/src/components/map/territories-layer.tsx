"use client";

import { useEffect } from "react";
import type { Map as MapLibreMap, GeoJSONSource } from "maplibre-gl";
import type { Territory } from "@/hooks/useTerritories";

const SOURCE_ID  = "hs-territories";
const FILL_LAYER = "hs-territories-fill";
const LINE_LAYER = "hs-territories-line";
const LABEL_LAYER = "hs-territories-label";

interface Props {
  map: MapLibreMap | null;
  territories: Territory[];
}

const PALETTE = [
  "#0F4C5C", "#D87C4A", "#4A6B3A", "#6B2D5C", "#A11F2A", "#1A6B36", "#7A4A0E", "#491657",
];

function colorFor(t: Territory, idx: number): string {
  if (t.color) return t.color;
  return PALETTE[idx % PALETTE.length];
}

export function TerritoriesLayer({ map, territories }: Props) {
  useEffect(() => {
    if (!map) return;
    const setup = () => {
      if (map.getSource(SOURCE_ID)) return;
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: FILL_LAYER,
        type: "fill",
        source: SOURCE_ID,
        paint: {
          "fill-color": ["get", "color"],
          "fill-opacity": 0.07,
        },
      });
      map.addLayer({
        id: LINE_LAYER,
        type: "line",
        source: SOURCE_ID,
        paint: {
          "line-color": ["get", "color"],
          "line-width": 1.6,
          "line-opacity": 0.85,
        },
      });
      map.addLayer({
        id: LABEL_LAYER,
        type: "symbol",
        source: SOURCE_ID,
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Bold", "Open Sans Bold", "Arial Unicode MS Bold"],
          "text-size": 11,
          "text-anchor": "center",
        },
        paint: {
          "text-color": ["get", "color"],
          "text-halo-color": "rgba(255,255,255,0.85)",
          "text-halo-width": 1.5,
        },
      });
    };
    if (map.isStyleLoaded()) setup();
    else map.once("style.load", setup);

    const onStyle = () => { if (!map.getSource(SOURCE_ID)) setup(); };
    map.on("styledata", onStyle);
    return () => { map.off("styledata", onStyle); };
  }, [map]);

  // Push features
  useEffect(() => {
    if (!map) return;
    const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    if (!src) return;
    const fc: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: territories.map((t, idx) => ({
        type: "Feature",
        id: t.id,
        geometry: { type: "Polygon", coordinates: [[...t.polygon, t.polygon[0]]] },
        properties: {
          id: t.id,
          name: t.name,
          color: colorFor(t, idx),
        },
      })),
    };
    src.setData(fc);
  }, [map, territories]);

  return null;
}
