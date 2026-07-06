import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
} from "react-native";
import * as MapLibreGL from "@maplibre/maplibre-react-native";
import { useNavigation } from "@react-navigation/native";
import { useUserLocation } from "@/hooks/useUserLocation";
import { useStorms } from "@/hooks/useStorms";
import { hailColor } from "@/lib/hail";
import { hailSizeAtPoint, nearestSwath } from "@/lib/hail-at-point";
import { theme, RADIUS, SPACING } from "@/lib/tokens";

// Voice is a native module (expo-speech). Lazy-required + guarded so the
// screen still works if TTS is unavailable; EAS installs it from package.json.
type SpeechLike = {
  speak: (text: string, opts?: Record<string, unknown>) => void;
  stop: () => void;
};
let Speech: SpeechLike | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any
  Speech = require("expo-speech") as SpeechLike;
} catch {
  Speech = null;
}

const STYLE_LIGHT = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";
const STYLE_DARK = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const DRIVE_ZOOM = 15;

// Swath band ramp keyed on min_size_in — matches MapScreen so the two views
// read identically. Slightly higher opacity here for glanceability at speed.
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

export function DriveScreen() {
  const scheme = useColorScheme();
  const t = theme(scheme);
  const styleUrl = scheme === "dark" ? STYLE_DARK : STYLE_LIGHT;
  const navigation = useNavigation();

  const { userLocation, permissionStatus, requestLocationPermission } = useUserLocation();
  const { swaths } = useStorms({ daysBack: 30, includeSwaths: true });
  const cameraRef = useRef<React.ElementRef<typeof MapLibreGL.Camera>>(null);

  const [muted, setMuted] = useState(false);

  // Ask for location the moment we enter Drive mode.
  useEffect(() => {
    if (permissionStatus !== "granted") void requestLocationPermission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // North-up follow: recentre on every GPS update at a driving zoom.
  useEffect(() => {
    if (userLocation && cameraRef.current) {
      cameraRef.current.flyTo({
        center: [userLocation.longitude, userLocation.latitude],
        zoom: DRIVE_ZOOM,
        duration: 800,
      });
    }
  }, [userLocation]);

  // Hail size right under the vehicle (0 = clear), computed locally.
  const sizeHere = useMemo(
    () =>
      userLocation
        ? hailSizeAtPoint(userLocation.longitude, userLocation.latitude, swaths)
        : 0,
    [userLocation, swaths],
  );

  // When clear, what's the nearest swath and how far ahead.
  const approaching = useMemo(
    () =>
      userLocation && sizeHere === 0
        ? nearestSwath(userLocation.longitude, userLocation.latitude, swaths)
        : null,
    [userLocation, sizeHere, swaths],
  );

  // Voice: announce only when the band CHANGES, so it never chatters.
  const spokenBand = useRef<number>(-1);
  useEffect(() => {
    const band = sizeHere;
    if (band === spokenBand.current) return;
    const prev = spokenBand.current;
    spokenBand.current = band;
    if (prev < 0 || muted || !Speech) return; // skip the very first read
    try {
      Speech.stop();
      if (band > 0 && band > prev) {
        const c = hailColor(band);
        Speech.speak(`Entering ${c.object} hail. ${band.toFixed(2)} inch.`, { rate: 1.0 });
      } else if (band > 0 && band < prev) {
        const c = hailColor(band);
        Speech.speak(`Now in ${c.object} hail.`, { rate: 1.0 });
      } else if (band === 0 && prev > 0) {
        Speech.speak("Leaving the hail swath.", { rate: 1.0 });
      }
    } catch {
      /* TTS best-effort */
    }
  }, [sizeHere, muted]);

  const inHail = sizeHere > 0;
  const hc = inHail ? hailColor(sizeHere) : null;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <MapLibreGL.Map
        style={StyleSheet.absoluteFill}
        mapStyle={styleUrl}
        attribution={false}
        compass={false}
      >
        <MapLibreGL.Camera
          ref={cameraRef}
          initialViewState={{
            center: userLocation
              ? [userLocation.longitude, userLocation.latitude]
              : [-98.58, 39.8],
            zoom: userLocation ? DRIVE_ZOOM : 4,
          }}
        />
        {userLocation && (
          <MapLibreGL.UserLocation animated />
        )}

        <MapLibreGL.GeoJSONSource id="drive-swaths" data={swaths}>
          <MapLibreGL.Layer type="fill"
            id="drive-swaths-fill"
            style={{
              fillColor: SWATH_COLOR_STEPS,
              fillOpacity: [
                "interpolate",
                ["linear"],
                ["get", "min_size_in"],
                0.75, 0.3,
                1.0, 0.42,
                1.5, 0.6,
                2.0, 0.72,
                3.0, 0.9,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ] as any,
            }}
          />
          <MapLibreGL.Layer type="line"
            id="drive-swaths-line"
            style={{ lineColor: SWATH_COLOR_STEPS, lineWidth: 1, lineOpacity: 0.6 }}
          />
        </MapLibreGL.GeoJSONSource>
      </MapLibreGL.Map>

      {/* Exit */}
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={[styles.exit, { backgroundColor: t.bgLift, borderColor: t.border }]}
        accessibilityLabel="Exit drive mode"
      >
        <Text style={[styles.exitX, { color: t.fg }]}>×</Text>
      </TouchableOpacity>

      {/* Mute */}
      <TouchableOpacity
        onPress={() => setMuted((m) => !m)}
        style={[styles.mute, { backgroundColor: t.bgLift, borderColor: t.border }]}
        accessibilityLabel={muted ? "Unmute voice" : "Mute voice"}
      >
        <Text style={{ fontSize: 18 }}>{muted ? "🔇" : "🔊"}</Text>
      </TouchableOpacity>

      {/* Glanceable HUD */}
      <View style={styles.hudWrap} pointerEvents="none">
        {permissionStatus !== "granted" ? (
          <View style={[styles.hud, { backgroundColor: t.bgLift, borderColor: t.border }]}>
            <Text style={[styles.hudTitle, { color: t.fgMuted }]}>WAITING FOR GPS</Text>
            <Text style={[styles.hudBig, { color: t.fg }]}>Locating…</Text>
          </View>
        ) : inHail && hc ? (
          <View style={[styles.hud, { backgroundColor: hc.solid, borderColor: hc.solid }]}>
            <Text style={[styles.hudTitle, { color: hc.text }]}>HAIL HERE</Text>
            <Text style={[styles.hudBig, { color: hc.text }]}>{sizeHere.toFixed(2)}″</Text>
            <Text style={[styles.hudSub, { color: hc.text }]}>{hc.object}</Text>
          </View>
        ) : (
          <View style={[styles.hud, { backgroundColor: t.bgLift, borderColor: t.border }]}>
            <Text style={[styles.hudTitle, { color: t.fgMuted }]}>YOUR SPOT — CLEAR</Text>
            {approaching && approaching.distanceMi <= 40 ? (
              <>
                <Text style={[styles.hudBig, { color: t.fg }]}>
                  {approaching.sizeIn.toFixed(2)}″
                </Text>
                <Text style={[styles.hudSub, { color: t.fgMuted }]}>
                  {hailColor(approaching.sizeIn).object} · ~
                  {approaching.distanceMi < 1
                    ? `${Math.round(approaching.distanceMi * 5280)} ft`
                    : `${approaching.distanceMi.toFixed(1)} mi`}{" "}
                  away
                </Text>
              </>
            ) : (
              <Text style={[styles.hudBig, { color: t.fg }]}>No hail near</Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  exit: {
    position: "absolute",
    top: 52,
    left: SPACING.lg,
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  exitX: { fontSize: 26, lineHeight: 28, fontWeight: "500" },
  mute: {
    position: "absolute",
    top: 52,
    right: SPACING.lg,
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  hudWrap: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  hud: {
    minWidth: 220,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  hudTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  hudBig: { fontSize: 56, fontWeight: "800", letterSpacing: -1 },
  hudSub: { fontSize: 16, fontWeight: "600", marginTop: 2 },
});
