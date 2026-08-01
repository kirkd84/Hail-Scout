/**
 * Live radar — the "is hail falling right now, and where" layer.
 *
 * Two pieces, kept together because they share the same product vocabulary:
 *   `RadarLayers`  — MapLibre children (ImageSource + raster Layer per product)
 *   `RadarControl` — the toggle pill, plain-language legend, and frame age
 *
 * Copy rule: a roofer reads this from the truck. No MESH/POSH/dBZ anywhere —
 * "Hail falling", "Hail likely", "Storm".
 */

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import * as MapLibreGL from "@maplibre/maplibre-react-native";
import { theme, SPACING, RADIUS } from "@/lib/tokens";
import { hailColor } from "@/lib/hail";
import { timeAgo } from "@/lib/time-ago";
import {
  RADAR_PRODUCTS,
  type RadarFrameMap,
  type RadarProduct,
} from "@/hooks/useRadarFrames";

/** Reflectivity is context and stays quiet; hail size is the hero. */
const RADAR_OPACITY: Record<RadarProduct, number> = {
  reflectivity: 0.34,
  posh: 0.45,
  mesh: 0.8,
};

/** Legend, most-useful first (the reverse of the draw order). */
const PRODUCT_COPY: Record<RadarProduct, { title: string; hint: string }> = {
  mesh: { title: "Hail falling", hint: "Color shows the size" },
  posh: { title: "Hail likely", hint: "Storm can drop hail here" },
  reflectivity: { title: "Storm", hint: "Rain and clouds" },
};
const LEGEND_ORDER: RadarProduct[] = ["mesh", "posh", "reflectivity"];

/** Swatch stops for the hail-size ramp — reuses the app-wide hail palette. */
const SIZE_STOPS = [1.0, 1.5, 2.0, 3.0];
const POSH_SWATCH = "#F0A12C"; // amber — "likely", not measured
const REFLECTIVITY_SWATCH = "#8FA3B8"; // muted slate — background context

interface RadarLayersProps {
  frames: RadarFrameMap;
  visible: boolean;
  /**
   * Existing layer to slot the radar underneath, so storm swaths and
   * centroids stay on top (and tappable). MapLibre waits for the target
   * layer, so passing one that mounts later is safe.
   */
  beforeId?: string;
}

/**
 * Renders the newest frame per product as a georeferenced image, stacked
 * reflectivity → posh → mesh. Products with no frame render nothing — an
 * empty sky is an honest empty sky.
 *
 * The keys carry which products are present: when that set changes we
 * remount the whole group in one commit so the stacking order can't drift
 * as products come and go between scans.
 */
export function RadarLayers({ frames, visible, beforeId }: RadarLayersProps) {
  if (!visible) return null;

  const present = RADAR_PRODUCTS.filter((p) => frames[p]);
  const presenceKey = present.join("-") || "none";

  return (
    <>
      {RADAR_PRODUCTS.map((product) => {
        const frame = frames[product];
        if (!frame) return null;
        return (
          <MapLibreGL.ImageSource
            key={`${product}-${presenceKey}`}
            id={`hs-radar-${product}`}
            url={frame.url}
            coordinates={frame.coordinates}
          >
            <MapLibreGL.Layer
              type="raster"
              id={`hs-radar-${product}-layer`}
              beforeId={beforeId}
              style={{
                rasterOpacity: RADAR_OPACITY[product],
                rasterResampling: product === "reflectivity" ? "linear" : "nearest",
                rasterFadeDuration: 0,
              }}
            />
          </MapLibreGL.ImageSource>
        );
      })}
    </>
  );
}

interface RadarControlProps {
  on: boolean;
  onToggle: () => void;
  frames: RadarFrameMap;
  newestValidTime: string | null;
  isLoading: boolean;
  error: Error | null;
  /** Placement is the map screen's call — it knows what else is on screen. */
  style?: StyleProp<ViewStyle>;
}

/**
 * Toggle pill + legend. Collapsed when off; when on it shows only the
 * layers we actually received, plus how old the newest scan is — a stale
 * radar has to look stale.
 */
export function RadarControl({
  on,
  onToggle,
  frames,
  newestValidTime,
  isLoading,
  error,
  style,
}: RadarControlProps) {
  const t = theme(useColorScheme());

  const present = LEGEND_ORDER.filter((p) => frames[p]);
  const hasFrames = present.length > 0;

  let status = "Off";
  if (on) {
    if (error) status = "Unavailable";
    else if (hasFrames && newestValidTime) status = timeAgo(newestValidTime);
    else if (isLoading) status = "Checking…";
    else status = "Nothing yet";
  }

  return (
    <View style={[styles.wrap, style]} pointerEvents="box-none">
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        accessibilityLabel={on ? "Hide live radar" : "Show live radar"}
        style={[
          styles.pill,
          { backgroundColor: t.bgLift, borderColor: on ? t.primary : t.border },
        ]}
      >
        <View
          style={[styles.pillDot, { backgroundColor: on ? t.primary : t.fgMuted }]}
        />
        <Text style={[styles.pillTxt, { color: t.fg }]}>Live radar</Text>
        <Text style={[styles.pillStatus, { color: on ? t.accent : t.fgMuted }]}>
          {status}
        </Text>
      </TouchableOpacity>

      {on && (
        <View
          style={[styles.panel, { backgroundColor: t.bgLift, borderColor: t.border }]}
        >
          {hasFrames ? (
            <>
              {present.map((product) => (
                <View key={product} style={styles.row}>
                  {product === "mesh" ? (
                    <View style={styles.ramp}>
                      {SIZE_STOPS.map((size) => (
                        <View
                          key={size}
                          style={[
                            styles.rampChip,
                            { backgroundColor: hailColor(size).solid },
                          ]}
                        />
                      ))}
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.swatch,
                        {
                          backgroundColor:
                            product === "posh" ? POSH_SWATCH : REFLECTIVITY_SWATCH,
                        },
                      ]}
                    />
                  )}
                  <View style={styles.rowText}>
                    <Text style={[styles.rowTitle, { color: t.fg }]}>
                      {PRODUCT_COPY[product].title}
                    </Text>
                    <Text style={[styles.rowHint, { color: t.fgMuted }]}>
                      {product === "mesh"
                        ? "1″ → 3″+ hail"
                        : PRODUCT_COPY[product].hint}
                    </Text>
                  </View>
                </View>
              ))}
              {newestValidTime && (
                <Text style={[styles.footer, { color: t.fgMuted }]}>
                  Scan from {timeAgo(newestValidTime)}
                </Text>
              )}
            </>
          ) : (
            // Never invent a storm: if nothing came back, say so plainly.
            <Text style={[styles.rowHint, { color: t.fgMuted }]}>
              {error
                ? "Live radar is offline right now. Storm history below is unaffected."
                : isLoading
                  ? "Looking for the latest scan…"
                  : "Nothing on radar right now."}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "flex-start" },
  pill: {
    minHeight: 44, // tap target
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  pillDot: { width: 8, height: 8, borderRadius: 4 },
  pillTxt: { fontSize: 12, fontWeight: "600" },
  pillStatus: { fontFamily: "Courier", fontSize: 11 },
  panel: {
    marginTop: 6,
    maxWidth: 210,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.sm,
    gap: 8,
  },
  row: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  rowText: { flexShrink: 1 },
  rowTitle: { fontSize: 12, fontWeight: "600" },
  rowHint: { fontSize: 10, lineHeight: 14, marginTop: 1 },
  swatch: { width: 32, height: 10, borderRadius: 2 },
  ramp: { flexDirection: "row", width: 32, height: 10, borderRadius: 2, overflow: "hidden" },
  rampChip: { flex: 1, height: 10 },
  footer: { fontFamily: "Courier", fontSize: 10 },
});
