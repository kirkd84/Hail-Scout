"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { Map as MapLibreMap } from "maplibre-gl";
import { useMapTiles } from "@/hooks/useMapTiles";
import { MAP_CONFIG } from "@/lib/constants";
import "maplibre-gl/dist/maplibre-gl.css";

interface HailMapProps {
  onMapReady?: (map: MapLibreMap) => void;
  onMarkerDrop?: (lat: number, lng: number) => void;
}

export function HailMap({ onMapReady, onMarkerDrop }: HailMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors",
          },
        },
        layers: [
          {
            id: "osm",
            type: "raster",
            source: "osm",
          },
        ],
      },
      center: MAP_CONFIG.DEFAULT_CENTER as [number, number],
      zoom: MAP_CONFIG.DEFAULT_ZOOM,
      minZoom: MAP_CONFIG.MIN_ZOOM,
      maxZoom: MAP_CONFIG.MAX_ZOOM,
    });

    // Add controls
    map.addControl(new maplibregl.NavigationControl(), "top-right");
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

    // Handle map clicks for marker dropping
    map.on("click", (e) => {
      onMarkerDrop?.(e.lngLat.lat, e.lngLat.lng);
    });

    return () => {
      map.remove();
    };
  }, [onMapReady, onMarkerDrop]);

  // Add vector tile layers
  useMapTiles(mapRef.current);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ minHeight: "600px" }}
    />
  );
}
