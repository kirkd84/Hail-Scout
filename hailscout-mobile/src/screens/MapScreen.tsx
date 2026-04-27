import React, { useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
} from "react-native";
import MapLibreGL from "@maplibre/maplibre-react-native";
import { useUserLocation } from "@/hooks/useUserLocation";
import { HailMap } from "@/components/HailMap";
import { LocationButton } from "@/components/LocationButton";
import { ColorLegend } from "@/components/ColorLegend";

// Default center: continental US (roughly)
const DEFAULT_CENTER: [number, number] = [-95.7129, 37.0902];
const DEFAULT_ZOOM = 4;

export function MapScreen() {
  const { userLocation, permissionStatus, requestLocationPermission } =
    useUserLocation();
  const mapRef = useRef<MapLibreGL.MapView>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    // Request location permission on mount
    if (permissionStatus === "undetermined") {
      requestLocationPermission();
    }
  }, []);

  const handleLocationPress = async () => {
    if (userLocation && mapRef.current) {
      try {
        await mapRef.current.animateTo(
          [userLocation.longitude, userLocation.latitude],
          500
        );
      } catch (error) {
        console.warn("Failed to animate to user location:", error);
      }
    } else {
      // Request permission if we don't have it yet
      await requestLocationPermission();
    }
  };

  return (
    <View style={styles.container}>
      <HailMap
        ref={mapRef}
        initialRegion={{
          centerCoordinate: DEFAULT_CENTER,
          zoomLevel: DEFAULT_ZOOM,
          animationDuration: 0,
        }}
        onDidFinishLoadingMap={() => setMapLoaded(true)}
        userLocation={userLocation}
      />

      {mapLoaded && <ColorLegend />}

      <LocationButton
        onPress={handleLocationPress}
        disabled={
          permissionStatus !== "granted" &&
          permissionStatus !== "foreground"
        }
      />

      {!mapLoaded && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#0066cc" />
          <Text style={styles.loadingText}>Loading map...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
  },
});
