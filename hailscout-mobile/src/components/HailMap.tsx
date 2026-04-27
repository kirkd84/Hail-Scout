import React, { forwardRef } from "react";
import { StyleSheet } from "react-native";
import MapLibreGL from "@maplibre/maplibre-react-native";

export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export interface MapRegion {
  centerCoordinate: [number, number];
  zoomLevel: number;
  animationDuration: number;
}

export interface HailMapProps {
  initialRegion: MapRegion;
  onDidFinishLoadingMap?: () => void;
  userLocation?: UserLocation | null;
}

/**
 * HailMap Component
 *
 * Wraps MapLibre GL for React Native with:
 * - User location blue dot (via UserLocation component)
 * - OpenStreetMap base tiles
 * - Placeholder for swath vector tiles (TODO: Month 3)
 *
 * Vector tile source is commented out and should be wired in Month 3
 * when the tiles repo is ready. The tile URL pattern is:
 *   ${TILES_BASE_URL}/swaths/{z}/{x}/{y}.pbf
 */
export const HailMap = forwardRef<MapLibreGL.MapView, HailMapProps>(
  ({ initialRegion, onDidFinishLoadingMap, userLocation }, ref) => {
    return (
      <MapLibreGL.MapView
        ref={ref}
        style={styles.map}
        styleURL={
          "https://demotiles.maplibre.org/style.json"
        }
        zoomLevel={initialRegion.zoomLevel}
        centerCoordinate={initialRegion.centerCoordinate}
        onDidFinishLoadingMap={onDidFinishLoadingMap}
      >
        {/* TODO: Month 3 — Wire up swath vector tiles from TILES_BASE_URL */}
        {/*
        <MapLibreGL.ShapeSource
          id="swaths-source"
          url={`${env.TILES_BASE_URL}/swaths.pbf`}
        >
          <MapLibreGL.LineLayer
            id="swaths-outline"
            style={{
              lineColor: "#0066cc",
              lineWidth: 2,
            }}
          />
        </MapLibreGL.ShapeSource>
        */}

        {/* User location blue dot */}
        {userLocation && (
          <MapLibreGL.UserLocation
            visible={true}
            androidRenderMode="native"
            iosShowsUserHeadingIndicator={true}
          />
        )}

        {/* Compass */}
        <MapLibreGL.Compass position={{ top: 16, right: 16 }} />

        {/* Scale bar */}
        <MapLibreGL.ScaleBar position={{ bottom: 16, left: 16 }} />
      </MapLibreGL.MapView>
    );
  }
);

HailMap.displayName = "HailMap";

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
