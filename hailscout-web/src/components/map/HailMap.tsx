"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { Map as MapLibreMap } from "maplibre-gl";
import { useTheme } from "next-themes";
import { useMapTiles } from "@/hooks/useMapTiles";
import { MAP_CONFIG } from "@/lib/constants";
import { env } from "@/lib/env";
import type { BasemapId } from "./basemap-toggle";
import "maplibre-gl/dist/maplibre-gl.css";

interface HailMapProps {
  basemap?: BasemapId;
  /** When true, the cursor becomes a crosshair to signal "click to drop". */
  dropMode?: boolean;
  onMapReady?: (map: MapLibreMap) => void;
  onMarkerDrop?: (lat: number, lng: number) => void;
}

/**
 * HailMap — MapLibre rendering with MapTiler vector tiles.
 *
 * 4 basemap layers, swap-able via the BasemapToggle:
 *   • atlas      — Voyager (cream-tinted, navigation-grade, our default)
 *   • streets    — Streets v2 (light) / Streets v2 dark (dark mode)
 *   • satellite  — pure imagery
 *   • hybrid     — imagery + street labels overlaid
 *
 * Light/dark adapts only for atlas + streets (satellite stays imagery).
 *
 * Falls back to Carto rasters when NEXT_PUBLIC_MAPTILER_KEY is unset
 * so previews-without-key still load. In production, the key MUST be
 * present in Vercel env or you'll see the lower-quality fallback.
 */

const MAPTILER_KEY = env.NEXT_PUBLIC_MAPTILER_KEY;

function maptilerStyleUrl(style: string): string {
  return `https://api.maptiler.com/maps/${style}/style.json?key=${MAPTILER_KEY}`;
}

function pickMaptilerStyle(basemap: BasemapId, isDark: boolean): string {
  switch (basemap) {
    case "atlas":
      // Voyager has cream/teal tones that match our brand. No "voyager-dark"
      // exists — we map to streets-v2-dark for dark mode atlas.
      return isDark ? "streets-v2-dark" : "voyager";
    case "streets":
      return isDark ? "streets-v2-dark" : "streets-v2";
    case "satellite":
      return "satellite";
    case "hybrid":
      return "hybrid";
  }
}

const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &middot; &copy; <a href="https://carto.com/attributions">CARTO</a>';

function fallbackCartoStyle(isDark: boolean): maplibregl.StyleSpecification {
  const subdomains = ["a", "b", "c", "d"];
  const tiles = (theme: string) =>
    subdomains.map((s) => `https://${s}.basemaps.cartocdn.com/${theme}/{z}/{x}/{y}@2x.png`);

  if (isDark) {
    return {
      version: 8,
      sources: {
        "basemap-bg":     { type: "raster", tiles: tiles("dark_nolabels"),    tileSize: 256, attribution: CARTO_ATTRIBUTION },
        "basemap-labels": { type: "raster", tiles: tiles("dark_only_labels"), tileSize: 256 },
      },
      layers: [
        { id: "basemap-bg",     type: "raster", source: "basemap-bg" },
        { id: "basemap-labels", type: "raster", source: "basemap-labels" },
      ],
    };
  }
  return {
    version: 8,
    sources: { basemap: { type: "raster", tiles: tiles("rastertiles/voyager"), tileSize: 256, attribution: CARTO_ATTRIBUTION } },
    layers:  [{ id: "basemap", type: "raster", source: "basemap" }],
  };
}

export function HailMap({ basemap = "atlas", dropMode = false, onMapReady, onMarkerDrop }: HailMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Initialize the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialStyle = MAPTILER_KEY
      ? maptilerStyleUrl(pickMaptilerStyle(basemap, isDark))
      : fallbackCartoStyle(isDark);

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: initialStyle,
      center: MAP_CONFIG.DEFAULT_CENTER as [number, number],
      zoom: MAP_CONFIG.DEFAULT_ZOOM,
      minZoom: MAP_CONFIG.MIN_ZOOM,
      maxZoom: MAP_CONFIG.MAX_ZOOM,
      attributionControl: { compact: true },
      // Required for getCanvas().toDataURL() snapshots — used by the
      // Hail Impact Report PDF generator. Slight perf cost on each
      // frame; negligible for our use case.
      preserveDrawingBuffer: true,
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

    map.on("click", (e) => onMarkerDrop?.(e.lngLat.lat, e.lngLat.lng));

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hot-swap the style when basemap or theme changes.
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    const next = MAPTILER_KEY
      ? maptilerStyleUrl(pickMaptilerStyle(basemap, isDark))
      : fallbackCartoStyle(isDark);
    mapRef.current.setStyle(next);
  }, [basemap, isDark, mapReady]);

  // Cursor feedback for drop-pin mode
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.getCanvas().style.cursor = dropMode ? "crosshair" : "";
  }, [dropMode]);

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
