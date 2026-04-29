"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { Map as MapLibreMap } from "maplibre-gl";
import { useTheme } from "next-themes";
import { useMapTiles } from "@/hooks/useMapTiles";
import { MAP_CONFIG } from "@/lib/constants";
import "maplibre-gl/dist/maplibre-gl.css";

interface HailMapProps {
  onMapReady?: (map: MapLibreMap) => void;
  onMarkerDrop?: (lat: number, lng: number) => void;
}

/**
 * Carto raster basemaps — composited as base + labels-overlay so street
 * names actually pop. Critical for crews navigating to cross streets in
 * a moving truck.
 *
 * Light mode: Voyager (single layer — has well-tuned road colors and
 * labels baked in. Cream-tinted, matches our Topographic palette.)
 *
 * Dark mode: dark_nolabels (base) + dark_only_labels (white labels) so
 * road names render in high-contrast white instead of the muddy gray
 * that ships in dark_all.
 *
 * When we move to MapTiler/Stadia/Mapbox we'll get vector tiles with
 * native zoom-aware label sizing — much higher quality. This is the
 * stop-gap until then.
 */
function buildCartoTileUrls(theme: string) {
  const subdomains = ["a", "b", "c", "d"];
  return subdomains.map(
    (s) => `https://${s}.basemaps.cartocdn.com/${theme}/{z}/{x}/{y}@2x.png`,
  );
}

const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &middot; &copy; <a href="https://carto.com/attributions">CARTO</a>';

function buildStyle(isDark: boolean): maplibregl.StyleSpecification {
  if (isDark) {
    return {
      version: 8,
      sources: {
        "basemap-bg": {
          type: "raster",
          tiles: buildCartoTileUrls("dark_nolabels"),
          tileSize: 256,
          attribution: ATTRIBUTION,
        },
        "basemap-labels": {
          type: "raster",
          tiles: buildCartoTileUrls("dark_only_labels"),
          tileSize: 256,
        },
      },
      layers: [
        { id: "basemap-bg",     type: "raster", source: "basemap-bg" },
        { id: "basemap-labels", type: "raster", source: "basemap-labels" },
      ],
    };
  }

  // Light mode — Voyager has road hierarchy and labels baked in already
  return {
    version: 8,
    sources: {
      basemap: {
        type: "raster",
        tiles: buildCartoTileUrls("rastertiles/voyager"),
        tileSize: 256,
        attribution: ATTRIBUTION,
      },
    },
    layers: [{ id: "basemap", type: "raster", source: "basemap" }],
  };
}

export function HailMap({ onMapReady, onMarkerDrop }: HailMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const { resolvedTheme } = useTheme();

  // Initialize the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const isDark = resolvedTheme === "dark";

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildStyle(isDark),
      center: MAP_CONFIG.DEFAULT_CENTER as [number, number],
      zoom: MAP_CONFIG.DEFAULT_ZOOM,
      minZoom: MAP_CONFIG.MIN_ZOOM,
      maxZoom: MAP_CONFIG.MAX_ZOOM,
      attributionControl: { compact: true },
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
      }),
      "top-right",
    );

    map.on("load", () => {
      mapRef.current = map;
      setMapReady(true);
      onMapReady?.(map);
    });

    map.on("click", (e) => {
      onMarkerDrop?.(e.lngLat.lat, e.lngLat.lng);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hot-swap basemap when the OS theme toggles.
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    const isDark = resolvedTheme === "dark";
    mapRef.current.setStyle(buildStyle(isDark));
  }, [resolvedTheme, mapReady]);

  // Vector tile overlays (hail swaths) — wired in via the hook.
  useMapTiles(mapRef.current);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ minHeight: "600px" }}
    />
  );
}
