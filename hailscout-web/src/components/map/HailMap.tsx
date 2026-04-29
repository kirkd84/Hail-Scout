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
 * Carto Positron / Dark-Matter basemaps.
 *
 * We use Carto's free CDN basemaps instead of raw OSM tiles because:
 *  - OSM rate-limits Vercel egress (the previous reason the map was blank)
 *  - Positron is a clean, paper-feel cartographic style — perfect for our
 *    "atlas / field guide" brand direction
 *  - dark_all matches our dark-mode design system
 *
 * Carto's tile usage policy: free for non-commercial / low-volume traffic;
 * for production we should swap to a self-hosted tile service or MapTiler.
 */
const CARTO_LIGHT = [
  "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  "https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
];
const CARTO_DARK = [
  "https://a.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png",
  "https://b.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png",
  "https://c.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png",
  "https://d.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png",
];
const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &middot; &copy; <a href="https://carto.com/attributions">CARTO</a>';

function buildStyle(isDark: boolean): maplibregl.StyleSpecification {
  const tiles = isDark ? CARTO_DARK : CARTO_LIGHT;
  return {
    version: 8,
    sources: {
      basemap: {
        type: "raster",
        // {r} renders as @2x on Retina, empty otherwise
        tiles: tiles.map((t) => t.replace("{r}", "@2x")),
        tileSize: 256,
        attribution: CARTO_ATTRIBUTION,
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
      "top-right"
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

  // Hot-swap basemap when the user toggles light/dark mode.
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
