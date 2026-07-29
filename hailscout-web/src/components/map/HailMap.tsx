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
  /**
   * Press-and-hold a spot (or right-click on desktop) → drop a pin there
   * WITHOUT arming drop mode first. Field ask: "when I press and hold a
   * house, I should be able to drop a pin on the house."
   */
  onLongPressDrop?: (lat: number, lng: number) => void;
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

export function HailMap({
  basemap = "atlas",
  dropMode = false,
  onMapReady,
  onMarkerDrop,
  onLongPressDrop,
}: HailMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // The map's click handler is registered ONCE on init, so it would
  // capture the first onMarkerDrop closure forever (which sees the
  // initial dropMode=false → never drops). Keep the latest callback in a
  // ref so the handler always invokes the current one.
  const onMarkerDropRef = useRef(onMarkerDrop);
  useEffect(() => {
    onMarkerDropRef.current = onMarkerDrop;
  }, [onMarkerDrop]);

  // Same once-registered-handler problem for the long-press callback and for
  // dropMode (the handler must read the CURRENT value, not the initial one).
  const onLongPressDropRef = useRef(onLongPressDrop);
  useEffect(() => {
    onLongPressDropRef.current = onLongPressDrop;
  }, [onLongPressDrop]);
  const dropModeRef = useRef(dropMode);
  useEffect(() => {
    dropModeRef.current = dropMode;
  }, [dropMode]);

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

    map.on("click", (e) => onMarkerDropRef.current?.(e.lngLat.lat, e.lngLat.lng));

    // ── Press-and-hold → drop a pin ──────────────────────────────────
    // Hold ~550ms without panning. Skipped while drop mode is armed (the
    // click handler above already places the pin then — otherwise a hold
    // would drop two). Right-click gives desktop parity, and the shared
    // de-dupe window stops a device that fires BOTH a synthetic
    // contextmenu and our touch timer from dropping twice.
    const LONG_PRESS_MS = 550;
    let pressTimer: ReturnType<typeof setTimeout> | null = null;
    let lastDropAt = 0;
    const clearPress = () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    };
    const fireLongPressDrop = (lat: number, lng: number) => {
      if (dropModeRef.current) return;
      const now = Date.now();
      if (now - lastDropAt < 800) return;
      lastDropAt = now;
      // Light haptic so the hold registers on phones that support it.
      try {
        navigator.vibrate?.(15);
      } catch {
        /* not supported — cosmetic only */
      }
      onLongPressDropRef.current?.(lat, lng);
    };

    map.on("touchstart", (e) => {
      clearPress();
      // Multi-touch = pinch/zoom, not a hold.
      if (e.points && e.points.length > 1) return;
      const { lat, lng } = e.lngLat;
      pressTimer = setTimeout(() => fireLongPressDrop(lat, lng), LONG_PRESS_MS);
    });
    // Any pan/zoom/lift cancels the pending hold.
    map.on("touchmove", clearPress);
    map.on("touchend", clearPress);
    map.on("touchcancel", clearPress);
    map.on("movestart", clearPress);
    map.on("contextmenu", (e) => fireLongPressDrop(e.lngLat.lat, e.lngLat.lng));

    return () => {
      clearPress();
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
