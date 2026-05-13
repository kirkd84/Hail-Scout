import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
} from "react-native";
import MapLibreGL from "@maplibre/maplibre-react-native";
import { useUserLocation } from "@/hooks/useUserLocation";
import { useStorms } from "@/hooks/useStorms";
import { theme, SPACING, RADIUS } from "@/lib/tokens";
import { AppHeader } from "@/components/AppHeader";
import { LocationButton } from "@/components/LocationButton";
import { ColorLegend } from "@/components/ColorLegend";
import type { MobileStorm } from "@/lib/storm-fixtures";

const DEFAULT_CENTER: [number, number] = [-98.58, 39.8];
const DEFAULT_ZOOM = 4;

const STYLE_LIGHT = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";
const STYLE_DARK  = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

/**
 * Hail-size step expression — used for both centroid color and the
 * tap-target halo. Matches the web app's topographic palette so the
 * two platforms read consistent.
 */
const HAIL_COLOR_STEPS: (number | string)[] = [
  "step",
  ["get", "peak_size_in"],
  "#5DCAA5",
  1.0,  "#E2B843",
  1.25, "#D88A3D",
  1.5,  "#C46434",
  1.75, "#A8412D",
  2.0,  "#822424",
  2.5,  "#5B2059",
  3.0,  "#1F1B33",
];

function buildFeatureCollection(storms: MobileStorm[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: storms.map((s) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [s.centroid_lng, s.centroid_lat],
      },
      properties: {
        id: s.id,
        city: s.city,
        peak_size_in: s.peak_size_in,
        start_time: s.start_time,
      },
    })),
  };
}

export function MapScreen() {
  const scheme = useColorScheme();
  const t = theme(scheme);
  const styleUrl = scheme === "dark" ? STYLE_DARK : STYLE_LIGHT;

  const { userLocation, permissionStatus, requestLocationPermission } = useUserLocation();
  const cameraRef = useRef<MapLibreGL.Camera>(null);

  // 30 days CONUS — same window the home screen uses
  const { storms } = useStorms({ daysBack: 30 });
  const fc = useMemo(() => buildFeatureCollection(storms), [storms]);

  const [selected, setSelected] = useState<MobileStorm | null>(null);

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

  /** Pan + zoom to a tapped storm so the user sees the cell footprint. */
  const flyToStorm = (s: MobileStorm) => {
    if (!cameraRef.current) return;
    cameraRef.current.setCamera({
      centerCoordinate: [s.centroid_lng, s.centroid_lat],
      zoomLevel: 8,
      animationDuration: 900,
    });
    setSelected(s);
  };

  /** Tap on a feature from the centroid layer. MapLibre RN bundles the
   *  hit feature in event.features[0]. Look it up in our local list to
   *  show the inline card. */
  const onMapPress = (e: { features?: GeoJSON.Feature[] }) => {
    const f = e.features?.[0];
    if (!f) return;
    const id = f.properties?.id as string | undefined;
    if (!id) return;
    const hit = storms.find((s) => s.id === id);
    if (hit) flyToStorm(hit);
  };

  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      <AppHeader
        eyebrow="Atlas"
        title="Hail map"
        subtitle={`${storms.length} cells · past 30 days`}
      />

      <View style={styles.mapWrap}>
        <MapLibreGL.MapView
          style={StyleSheet.absoluteFill}
          styleURL={styleUrl}
          attributionEnabled
          logoEnabled={false}
          onPress={() => setSelected(null)}
        >
          <MapLibreGL.Camera
            ref={cameraRef}
            zoomLevel={DEFAULT_ZOOM}
            centerCoordinate={DEFAULT_CENTER}
          />
          {userLocation && (
            <MapLibreGL.UserLocation visible animated showsUserHeadingIndicator />
          )}

          {/* Storm centroids: halo + solid dot, sized + colored by
              peak hail. ShapeSource feeds both layers. */}
          <MapLibreGL.ShapeSource
            id="hs-storms"
            shape={fc}
            onPress={onMapPress}
          >
            <MapLibreGL.CircleLayer
              id="hs-storms-halo"
              minZoomLevel={3}
              style={{
                circleRadius: [
                  "interpolate",
                  ["linear"],
                  ["get", "peak_size_in"],
                  0.75, 8,
                  1.75, 12,
                  3.0, 18,
                ],
                circleColor: HAIL_COLOR_STEPS,
                circleOpacity: 0.18,
                circleStrokeWidth: 0,
              }}
            />
            <MapLibreGL.CircleLayer
              id="hs-storms-dot"
              minZoomLevel={3}
              style={{
                circleRadius: [
                  "interpolate",
                  ["linear"],
                  ["get", "peak_size_in"],
                  0.75, 4,
                  1.75, 5,
                  3.0, 7,
                ],
                circleColor: HAIL_COLOR_STEPS,
                circleStrokeColor: "#FAF7F1",
                circleStrokeWidth: 1.4,
                circleOpacity: 1,
              }}
            />
          </MapLibreGL.ShapeSource>
        </MapLibreGL.MapView>

        <View style={[styles.fab, { backgroundColor: t.bgLift, borderColor: t.border }]}>
          <LocationButton onPress={onMyLocation} hasLocation={!!userLocation} />
        </View>

        <View style={[styles.legendWrap, { backgroundColor: t.bgLift, borderColor: t.border }]}>
          <ColorLegend />
        </View>

        {selected && (
          <View
            style={[
              styles.cardWrap,
              { backgroundColor: t.bgLift, borderColor: t.border },
            ]}
          >
            <View style={styles.cardRow}>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: peakColorHex(selected.peak_size_in) },
                ]}
              >
                <Text style={[styles.badgeSize, { color: badgeTextColor(selected.peak_size_in) }]}>
                  {selected.peak_size_in.toFixed(2)}″
                </Text>
                <Text style={[styles.badgeObj, { color: badgeTextColor(selected.peak_size_in) }]}>
                  {peakObjectLabel(selected.peak_size_in)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardCity, { color: t.fg }]}>{selected.city}</Text>
                <Text style={[styles.cardDate, { color: t.fgMuted }]}>
                  {new Date(selected.start_time).toLocaleDateString(undefined, {
                    month: "short",
                    day: "2-digit",
                    year: "numeric",
                  })}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelected(null)}
                style={styles.closeBtn}
              >
                <Text style={[styles.closeX, { color: t.fgMuted }]}>×</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Helpers shared with the home-screen badge styling ──────────────
function peakColorHex(inches: number): string {
  if (inches >= 3.0)  return "#1F1B33";
  if (inches >= 2.5)  return "#5B2059";
  if (inches >= 2.0)  return "#822424";
  if (inches >= 1.75) return "#A8412D";
  if (inches >= 1.5)  return "#C46434";
  if (inches >= 1.25) return "#D88A3D";
  if (inches >= 1.0)  return "#E2B843";
  return "#5DCAA5";
}
function badgeTextColor(inches: number): string {
  return inches >= 1.5 ? "#FAF7F1" : "#2B2620";
}
function peakObjectLabel(inches: number): string {
  if (inches >= 3.0)  return "SOFTBALL";
  if (inches >= 2.75) return "BASEBALL";
  if (inches >= 2.5)  return "TENNIS";
  if (inches >= 2.0)  return "HEN EGG";
  if (inches >= 1.75) return "GOLF BALL";
  if (inches >= 1.5)  return "WALNUT";
  if (inches >= 1.25) return "HALF $";
  if (inches >= 1.0)  return "QUARTER";
  return "PENNY";
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
  cardWrap: {
    position: "absolute",
    left: SPACING.lg,
    right: SPACING.lg,
    bottom: SPACING.lg + 64, // sit above the legend
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
  },
  cardRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  badge: {
    width: 54,
    height: 54,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeSize: { fontFamily: "Courier", fontSize: 14, fontWeight: "600" },
  badgeObj:  { fontFamily: "Courier", fontSize: 8,  letterSpacing: 0.6, marginTop: 2 },
  cardCity:  { fontFamily: "serif", fontSize: 17, fontWeight: "500", letterSpacing: -0.3 },
  cardDate:  { fontFamily: "Courier", fontSize: 11, marginTop: 4 },
  closeBtn:  { padding: 4 },
  closeX:    { fontSize: 22, lineHeight: 22 },
});
