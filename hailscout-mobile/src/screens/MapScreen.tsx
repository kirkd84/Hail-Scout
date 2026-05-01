import React, { useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  useColorScheme,
} from "react-native";
import MapLibreGL from "@maplibre/maplibre-react-native";
import { useUserLocation } from "@/hooks/useUserLocation";
import { theme, SPACING, RADIUS } from "@/lib/tokens";
import { AppHeader } from "@/components/AppHeader";
import { LocationButton } from "@/components/LocationButton";
import { ColorLegend } from "@/components/ColorLegend";

const DEFAULT_CENTER: [number, number] = [-98.58, 39.8];
const DEFAULT_ZOOM = 4;

const STYLE_LIGHT = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";
const STYLE_DARK  = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

export function MapScreen() {
  const scheme = useColorScheme();
  const t = theme(scheme);
  const styleUrl = scheme === "dark" ? STYLE_DARK : STYLE_LIGHT;

  const { userLocation, permissionStatus, requestLocationPermission } = useUserLocation();
  const cameraRef = useRef<MapLibreGL.Camera>(null);

  useEffect(() => {
    if (permissionStatus === "undetermined") void requestLocationPermission();
  }, [permissionStatus, requestLocationPermission]);

  const onMyLocation = async () => {
    if (userLocation && cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: [userLocation.longitude, userLocation.latitude],
        zoomLevel: 13,
        animationDuration: 700,
      });
    } else {
      await requestLocationPermission();
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      <AppHeader eyebrow="Atlas" title="Hail map" subtitle="Live MRMS · pinch to zoom" />

      <View style={styles.mapWrap}>
        <MapLibreGL.MapView
          style={StyleSheet.absoluteFill}
          styleURL={styleUrl}
          attributionEnabled
          logoEnabled={false}
        >
          <MapLibreGL.Camera
            ref={cameraRef}
            zoomLevel={DEFAULT_ZOOM}
            centerCoordinate={DEFAULT_CENTER}
          />
          {userLocation && (
            <MapLibreGL.UserLocation visible animated showsUserHeadingIndicator />
          )}
        </MapLibreGL.MapView>

        <View style={[styles.fab, { backgroundColor: t.bgLift, borderColor: t.border }]}>
          <LocationButton onPress={onMyLocation} hasLocation={!!userLocation} />
        </View>
        <View style={[styles.legendWrap, { backgroundColor: t.bgLift, borderColor: t.border }]}>
          <ColorLegend />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  mapWrap: { flex: 1, position: "relative" },
  fab: {
    position: "absolute",
    right: SPACING.lg,
    top: SPACING.lg,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    padding: 10,
  },
  legendWrap: {
    position: "absolute",
    left: SPACING.lg,
    bottom: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.sm,
  },
});
