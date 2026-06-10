"use client";

import { useEffect, useState } from "react";
import type { Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";
import { MARKER_STATUSES, type Marker } from "@/lib/markers";

const SOURCE_ID = "hs-canvass-markers";
const HALO_LAYER = "hs-canvass-halo";
const DOT_LAYER  = "hs-canvass-dot";
const CLUSTER_LAYER = "hs-canvass-cluster";
const CLUSTER_COUNT_LAYER = "hs-canvass-cluster-count";

interface Props {
  map: MapLibreMap | null;
  markers: Marker[];
  onMarkerClick?: (id: string) => void;
}

/**
 * Renders canvassing markers as colored dots (status-encoded) with a
 * subtle white-ringed halo. At zoom < 11, nearby markers cluster into
 * cream-and-copper bubbles with a count label; click a cluster to zoom in.
 */
export function MarkersLayer({ map, markers, onMarkerClick }: Props) {
  // Bumped when a basemap style swap wipes + recreates the source, so the
  // data effect re-pushes markers into the fresh (empty) source. Without
  // this, markers vanished after any basemap toggle.
  const [styleEpoch, setStyleEpoch] = useState(0);

  // Initial layer creation
  useEffect(() => {
    if (!map) return;

    const colorStops: (string | number)[] = [];
    for (const s of MARKER_STATUSES) {
      colorStops.push(s.id, s.color);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const colorMatch: any = ["match", ["get", "status"], ...colorStops, "#888"];

    const addLayers = () => {
      if (map.getSource(SOURCE_ID)) return;
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterRadius: 40,
        clusterMaxZoom: 11,
      });

      // Cluster bubble — cream fill, copper border, sized by point_count
      map.addLayer({
        id: CLUSTER_LAYER,
        type: "circle",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#FAF7F1",
          "circle-stroke-color": "#D87C4A",
          "circle-stroke-width": 2,
          "circle-opacity": 0.95,
          "circle-radius": [
            "step",
            ["get", "point_count"],
            14,   //  default (1-9)
            10,   //  threshold
            18,   //  10-49
            50,   //  threshold
            22,   //  50-249
            250,  //  threshold
            28,   //  250+
          ],
        },
      });

      // Cluster count label
      map.addLayer({
        id: CLUSTER_COUNT_LAYER,
        type: "symbol",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-font": ["Noto Sans Bold", "Open Sans Bold", "Arial Unicode MS Bold"],
          "text-size": 12,
        },
        paint: {
          "text-color": "#0F4C5C",
        },
      });

      // Unclustered halo
      map.addLayer({
        id: HALO_LAYER,
        type: "circle",
        source: SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-radius": 11,
          "circle-color": colorMatch,
          "circle-opacity": 0.18,
        },
      });

      // Unclustered dot
      map.addLayer({
        id: DOT_LAYER,
        type: "circle",
        source: SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-radius": 6,
          "circle-color": colorMatch,
          "circle-stroke-color": "#FFFFFF",
          "circle-stroke-width": 2,
        },
      });

    };

    // Listeners are bound ONCE here (not inside addLayers): layer-scoped
    // MapLibre listeners are keyed by layer id and keep working after a
    // basemap style swap recreates the layer — re-binding them in
    // addLayers stacked a duplicate set per swap, so one click fired N
    // handlers after N basemap toggles.
    const clusterClick = (e: MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, { layers: [CLUSTER_LAYER] });
      if (features.length === 0) return;
      const feat = features[0];
      const clusterId = feat.properties?.cluster_id;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const src = map.getSource(SOURCE_ID) as any;
      if (!src || clusterId === undefined) return;
      src.getClusterExpansionZoom(clusterId, (err: Error | null, zoom: number) => {
        if (err) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const coords = (feat.geometry as any).coordinates as [number, number];
        map.easeTo({ center: coords, zoom: Math.min(zoom + 0.5, 16), duration: 600 });
      });
    };
    const click = (e: MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, { layers: [DOT_LAYER] });
      if (features.length > 0) {
        const id = features[0].properties?.id as string | undefined;
        if (id) {
          e.preventDefault();
          onMarkerClick?.(id);
        }
      }
    };
    const enter = () => { map.getCanvas().style.cursor = "pointer"; };
    const leave = () => { map.getCanvas().style.cursor = ""; };

    if (map.isStyleLoaded()) addLayers();
    else map.once("style.load", addLayers);

    map.on("click", CLUSTER_LAYER, clusterClick);
    map.on("click", click);
    map.on("mouseenter", DOT_LAYER, enter);
    map.on("mouseleave", DOT_LAYER, leave);
    map.on("mouseenter", CLUSTER_LAYER, enter);
    map.on("mouseleave", CLUSTER_LAYER, leave);

    const onStyle = () => {
      if (!map.getSource(SOURCE_ID)) {
        addLayers();
        setStyleEpoch((e) => e + 1);
      }
    };
    map.on("styledata", onStyle);

    return () => {
      map.off("styledata", onStyle);
      map.off("style.load", addLayers);
      map.off("click", CLUSTER_LAYER, clusterClick);
      map.off("click", click);
      map.off("mouseenter", DOT_LAYER, enter);
      map.off("mouseleave", DOT_LAYER, leave);
      map.off("mouseenter", CLUSTER_LAYER, enter);
      map.off("mouseleave", CLUSTER_LAYER, leave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Push marker data into the source (re-runs after a basemap swap via
  // styleEpoch so the recreated source isn't left empty).
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
