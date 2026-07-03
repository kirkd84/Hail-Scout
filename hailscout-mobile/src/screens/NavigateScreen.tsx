import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  useColorScheme,
} from "react-native";
import MapLibreGL from "@maplibre/maplibre-react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { useUserLocation } from "@/hooks/useUserLocation";
import { useStorms } from "@/hooks/useStorms";
import { useAuthToken } from "@/hooks/useAuthToken";
import { fetchRoute } from "@/lib/routing";
import {
  buildNavRoute,
  guide,
  fmtDistance,
  type NavRoute,
  type Progress,
} from "@/lib/nav-guidance";
import { theme, RADIUS, SPACING } from "@/lib/tokens";
import type { AppStackParamList } from "@/navigation/types";

type SpeechLike = {
  speak: (text: string, opts?: Record<string, unknown>) => void;
  stop: () => void;
};
let Speech: SpeechLike | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Speech = require("expo-speech") as SpeechLike;
} catch {
  Speech = null;
}

const STYLE_LIGHT = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";
const STYLE_DARK = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SWATH_COLOR_STEPS: any = [
  "step",
  ["get", "min_size_in"],
  "#5DCAA5",
  1.0, "#E2B843",
  1.25, "#D88A3D",
  1.5, "#C46434",
  1.75, "#A8412D",
  2.0, "#822424",
  2.5, "#5B2059",
  3.0, "#1F1B33",
];

export function NavigateScreen() {
  const scheme = useColorScheme();
  const t = theme(scheme);
  const styleUrl = scheme === "dark" ? STYLE_DARK : STYLE_LIGHT;
  const navigation = useNavigation();
  const { params } = useRoute<RouteProp<AppStackParamList, "Navigate">>();
  const { destLng, destLat, label } = params;

  const { userLocation, permissionStatus, requestLocationPermission } = useUserLocation();
  const { swaths } = useStorms({ daysBack: 30, includeSwaths: true });
  const { token } = useAuthToken();
  const cameraRef = useRef<React.ElementRef<typeof MapLibreGL.Camera>>(null);

  const [nav, setNav] = useState<NavRoute | null>(null);
  const [routeErr, setRouteErr] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [muted, setMuted] = useState(false);
  const rerouting = useRef(false);
  const lastReroute = useRef(0);
  const spokenStep = useRef(-1);

  useEffect(() => {
    if (permissionStatus !== "granted") void requestLocationPermission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadRoute = useCallback(
    async (fromLng: number, fromLat: number) => {
      try {
        const tok = await token();
        const r = await fetchRoute(
          { lng: fromLng, lat: fromLat },
          { lng: destLng, lat: destLat },
          tok,
        );
        setNav(buildNavRoute(r));
        setRouteErr(null);
      } catch (e) {
        const status = (e as { status?: number })?.status;
        setRouteErr(
          status === 503
            ? "Navigation isn't switched on yet."
            : "Couldn't find a driving route there.",
        );
      }
    },
    [destLng, destLat, token],
  );

  // First route once we have a fix.
  useEffect(() => {
    if (userLocation && !nav && !routeErr) {
      void loadRoute(userLocation.longitude, userLocation.latitude);
    }
  }, [userLocation, nav, routeErr, loadRoute]);

  // Guidance + camera follow + voice + reroute on each GPS update.
  useEffect(() => {
    if (!userLocation || !nav) return;
    const p = guide(userLocation.longitude, userLocation.latitude, nav);
    setProgress(p);

    cameraRef.current?.setCamera({
      centerCoordinate: [userLocation.longitude, userLocation.latitude],
      zoomLevel: 16,
      animationDuration: 800,
    });

    if (p.stepIndex !== spokenStep.current) {
      spokenStep.current = p.stepIndex;
      if (!muted && Speech && p.instruction && !p.arrived) {
        try {
          Speech.stop();
          Speech.speak(p.instruction, { rate: 1.0 });
        } catch {
          /* best-effort */
        }
      }
    }

    const now = Date.now();
    if (p.offRouteM > 55 && !p.arrived && !rerouting.current && now - lastReroute.current > 8000) {
      rerouting.current = true;
      lastReroute.current = now;
      void loadRoute(userLocation.longitude, userLocation.latitude).finally(() => {
        rerouting.current = false;
        spokenStep.current = -1;
      });
    }
  }, [userLocation, nav, muted, loadRoute]);

  const routeFC = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: nav
        ? [
            {
              type: "Feature" as const,
              geometry: { type: "LineString" as const, coordinates: nav.coords },
              properties: {},
            },
          ]
        : [],
    }),
    [nav],
  );

  const remainingMin = progress ? Math.max(1, Math.round(progress.remainingS / 60)) : null;
  const remainingMi = progress ? (progress.remainingM / 1609.34).toFixed(1) : null;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <MapLibreGL.MapView
        style={StyleSheet.absoluteFill}
        mapStyle={styleUrl}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={false}
      >
        <MapLibreGL.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: userLocation
              ? [userLocation.longitude, userLocation.latitude]
              : [destLng, destLat],
            zoomLevel: userLocation ? 16 : 12,
          }}
        />
        {userLocation && (
          <MapLibreGL.UserLocation visible animated showsUserHeadingIndicator />
        )}

        <MapLibreGL.ShapeSource id="nav-swaths" shape={swaths}>
          <MapLibreGL.FillLayer
            id="nav-swaths-fill"
            style={{
              fillColor: SWATH_COLOR_STEPS,
              fillOpacity: [
                "interpolate", ["linear"], ["get", "min_size_in"],
                0.75, 0.26, 1.5, 0.5, 2.0, 0.66, 3.0, 0.85,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ] as any,
            }}
          />
        </MapLibreGL.ShapeSource>

        <MapLibreGL.ShapeSource id="nav-route" shape={routeFC}>
          <MapLibreGL.LineLayer
            id="nav-route-casing"
            style={{ lineColor: "#0E7490", lineWidth: 11, lineCap: "round", lineJoin: "round" }}
          />
          <MapLibreGL.LineLayer
            id="nav-route-line"
            style={{ lineColor: "#22D3EE", lineWidth: 6, lineCap: "round", lineJoin: "round" }}
          />
        </MapLibreGL.ShapeSource>

        <MapLibreGL.ShapeSource
          id="nav-dest"
          shape={{
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                geometry: { type: "Point", coordinates: [destLng, destLat] },
                properties: {},
              },
            ],
          }}
        >
          <MapLibreGL.CircleLayer
            id="nav-dest-dot"
            style={{
              circleRadius: 8,
              circleColor: "#22D3EE",
              circleStrokeColor: "#FFFFFF",
              circleStrokeWidth: 2,
            }}
          />
        </MapLibreGL.ShapeSource>
      </MapLibreGL.MapView>

      {/* Maneuver banner */}
      <View style={[styles.banner, { backgroundColor: "#111826" }]} pointerEvents="none">
        {routeErr ? (
          <Text style={[styles.instr, { color: "#F1F5F9" }]}>{routeErr}</Text>
        ) : !nav ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <ActivityIndicator color="#22D3EE" />
            <Text style={[styles.instr, { color: "#F1F5F9" }]}>Finding route…</Text>
          </View>
        ) : progress?.arrived ? (
          <Text style={[styles.instr, { color: "#F1F5F9" }]}>You've arrived</Text>
        ) : (
          <>
            <Text style={styles.maneuverDist}>
              {progress ? fmtDistance(progress.distanceToManeuverM) : ""}
            </Text>
            <Text style={[styles.instr, { color: "#F1F5F9" }]} numberOfLines={2}>
              {progress?.instruction ?? "Starting…"}
            </Text>
          </>
        )}
      </View>

      {/* Exit + mute */}
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={[styles.round, { top: 150, left: SPACING.lg, backgroundColor: t.bgLift, borderColor: t.border }]}
        accessibilityLabel="End navigation"
      >
        <Text style={[styles.roundX, { color: t.fg }]}>×</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => setMuted((m) => !m)}
        style={[styles.round, { top: 150, right: SPACING.lg, backgroundColor: t.bgLift, borderColor: t.border }]}
        accessibilityLabel={muted ? "Unmute voice" : "Mute voice"}
      >
        <Text style={{ fontSize: 18 }}>{muted ? "🔇" : "🔊"}</Text>
      </TouchableOpacity>

      {/* Trip footer */}
      <View style={[styles.footer, { backgroundColor: "#111826" }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.footBig}>
            {progress?.arrived
              ? "Arrived"
              : remainingMin != null
              ? `${remainingMin} min`
              : "—"}
          </Text>
          <Text style={styles.footSub} numberOfLines={1}>
            {remainingMi != null && !progress?.arrived ? `${remainingMi} mi · ` : ""}
            {label ?? "Destination"}
          </Text>
        </View>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.endBtn}>
          <Text style={styles.endTxt}>End</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 44,
    left: SPACING.md,
    right: SPACING.md,
    minHeight: 84,
    borderRadius: RADIUS.xl,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  maneuverDist: { color: "#22D3EE", fontSize: 26, fontWeight: "800", marginBottom: 2 },
  instr: { fontSize: 20, fontWeight: "600" },
  round: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  roundX: { fontSize: 26, lineHeight: 28, fontWeight: "500" },
  footer: {
    position: "absolute",
    bottom: 28,
    left: SPACING.md,
    right: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: RADIUS.xl,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  footBig: { color: "#F1F5F9", fontSize: 24, fontWeight: "700" },
  footSub: { color: "#94A3B8", fontSize: 14, marginTop: 2 },
  endBtn: {
    backgroundColor: "#3A1416",
    borderRadius: RADIUS.full,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  endTxt: { color: "#F87171", fontSize: 16, fontWeight: "700" },
});
