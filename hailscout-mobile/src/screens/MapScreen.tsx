import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
  useColorScheme,
} from "react-native";
import * as MapLibreGL from "@maplibre/maplibre-react-native";
import { useUserLocation } from "@/hooks/useUserLocation";
import { useStorms } from "@/hooks/useStorms";
import { theme, SPACING, RADIUS } from "@/lib/tokens";
import { AppHeader } from "@/components/AppHeader";
import { LocationButton } from "@/components/LocationButton";
import { ColorLegend } from "@/components/ColorLegend";
import type { MobileStorm } from "@/lib/storm-fixtures";
import { apiRequest } from "@/lib/api";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { AppStackParamList, MainTabsParamList } from "@/navigation/types";

const DEFAULT_CENTER: [number, number] = [-98.58, 39.8];
const DEFAULT_ZOOM = 4;

const STYLE_LIGHT = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";
const STYLE_DARK  = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

/**
 * Hail-size step expression — used for both centroid color and the
 * tap-target halo. Matches the web app's topographic palette so the
 * two platforms read consistent.
 */
// `any` — MapLibre RN's style-expression types are stricter than the
// runtime; these are valid `step`/`interpolate` expressions.
const HAIL_COLOR_STEPS: any = [
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

/** Same ramp keyed on a swath band's min_size_in (the floor of the band). */
const SWATH_COLOR_STEPS: any = [
  "step",
  ["get", "min_size_in"],
  "#5DCAA5",
  1.0,  "#E2B843",
  1.25, "#D88A3D",
  1.5,  "#C46434",
  1.75, "#A8412D",
  2.0,  "#822424",
  2.5,  "#5B2059",
  3.0,  "#1F1B33",
];

interface AtPointHit {
  id: string;
  source: string;
  size_at_point: number | null;
  max_hail_size_in: number;
  lsr_confirmed?: boolean;
  distance_mi?: number | null;
  start_time: string;
}
interface AtPointResponse { lat: number; lng: number; hits: AtPointHit[]; total: number }
interface AtPointResult { lat: number; lng: number; top: AtPointHit | null; total: number }

/** UTC calendar day ("YYYY-MM-DD") — the unit storms are grouped by. */
const utcDay = (iso: string) => new Date(iso).toISOString().slice(0, 10);

/** Short label for the date pill / day rows. */
function dayLabel(day: string): string {
  if (day === utcDay(new Date().toISOString())) return "Today";
  return new Date(day + "T00:00:00Z").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

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
  const cameraRef = useRef<React.ElementRef<typeof MapLibreGL.Camera>>(null);
  const navigation = useNavigation<StackNavigationProp<AppStackParamList>>();

  // 30 days CONUS — same window the home screen uses. includeSwaths pulls
  // the band polygons so we render real filled swaths, not just centroids.
  const { storms, swaths } = useStorms({ daysBack: 30, includeSwaths: true });

  // ── Storm-date filter ────────────────────────────────────────────────
  // null = every day in the window (the long-standing default). Pick a day
  // to see just that storm — the field ask was "let me search hail maps by
  // storm date". Filtering is client-side over the same 30-day fetch, so
  // switching days is instant and needs no extra request.
  const route = useRoute<RouteProp<MainTabsParamList, "Atlas">>();
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [dateOpen, setDateOpen] = useState(false);

  // "See this day on the map" from elsewhere in the app (e.g. the Home
  // storm record) arrives as a route param.
  useEffect(() => {
    const d = route.params?.focusDay;
    if (d) setSelectedDay(d);
  }, [route.params?.focusDay]);

  /** Distinct storm days in the window, newest first, with peak + count. */
  const days = useMemo(() => {
    const byDay = new Map<string, MobileStorm[]>();
    for (const s of storms) {
      const d = utcDay(s.start_time);
      const arr = byDay.get(d);
      if (arr) arr.push(s);
      else byDay.set(d, [s]);
    }
    return [...byDay.entries()]
      .map(([date, group]) => ({
        date,
        maxSize: group.reduce((m, s) => Math.max(m, s.peak_size_in), 0),
        count: group.length,
        where: group.reduce((a, b) => (b.peak_size_in > a.peak_size_in ? b : a)).city,
      }))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [storms]);

  const visibleStorms = useMemo(
    () => (selectedDay ? storms.filter((s) => utcDay(s.start_time) === selectedDay) : storms),
    [storms, selectedDay],
  );

  // Keep the swath bands in step with the day filter (features carry the
  // storm_id they came from).
  const visibleSwaths = useMemo(() => {
    if (!selectedDay) return swaths;
    const ids = new Set(visibleStorms.map((s) => s.id));
    return {
      type: "FeatureCollection" as const,
      features: swaths.features.filter((f) =>
        ids.has(String(f.properties?.storm_id ?? "")),
      ),
    };
  }, [swaths, visibleStorms, selectedDay]);

  const fc = useMemo(() => buildFeatureCollection(visibleStorms), [visibleStorms]);

  const [selected, setSelected] = useState<MobileStorm | null>(null);
  const [atPoint, setAtPoint] = useState<AtPointResult | null>(null);
  const [atPointLoading, setAtPointLoading] = useState(false);

  // Long-press anywhere → "what hit this spot?" via /v1/storms/at-point.
  // Public endpoint; fuses radar swaths + nearby SPC ground reports.
  const queryAtPoint = async (lng: number, lat: number) => {
    setSelected(null);
    setAtPoint(null);
    setAtPointLoading(true);
    try {
      const d = await apiRequest<AtPointResponse>(
        `/v1/storms/at-point?lat=${lat.toFixed(5)}&lng=${lng.toFixed(5)}`,
      );
      setAtPoint({ lat, lng, top: d.hits?.[0] ?? null, total: d.hits?.length ?? 0 });
    } catch {
      setAtPoint({ lat, lng, top: null, total: 0 });
    } finally {
      setAtPointLoading(false);
    }
  };
  // Long-press → "what hit here". v11 gives geo coords on nativeEvent.lngLat.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onLongPress = (e: any) => {
    const ll = e?.nativeEvent?.lngLat;
    const lng = Array.isArray(ll) ? ll[0] : ll?.longitude;
    const lat = Array.isArray(ll) ? ll[1] : ll?.latitude;
    if (typeof lng !== "number" || typeof lat !== "number") return;
    void queryAtPoint(lng, lat);
  };

  useEffect(() => {
    if (permissionStatus === "undetermined") void requestLocationPermission();
  }, [permissionStatus, requestLocationPermission]);

  const onMyLocation = async () => {
    if (userLocation && cameraRef.current) {
      cameraRef.current.flyTo({
        center: [userLocation.longitude, userLocation.latitude],
        zoom: 13,
        duration: 700,
      });
    } else {
      await requestLocationPermission();
    }
  };

  /** Pan + zoom to a tapped storm so the user sees the cell footprint. */
  const flyToStorm = (s: MobileStorm) => {
    if (!cameraRef.current) return;
    cameraRef.current.flyTo({
      center: [s.centroid_lng, s.centroid_lat],
      zoom: 8,
      duration: 900,
    });
    setSelected(s);
  };

  /** Tap on a feature from the centroid layer. MapLibre RN bundles the
   *  hit feature in event.features[0]. Look it up in our local list to
   *  show the inline card. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onMapPress = (e: any) => {
    const f = e?.nativeEvent?.features?.[0];
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
        subtitle={
          selectedDay
            ? `${visibleStorms.length} cells · ${dayLabel(selectedDay)}`
            : `${storms.length} cells · past 30 days`
        }
      />

      <View style={styles.mapWrap}>
        <MapLibreGL.Map
          style={StyleSheet.absoluteFill}
          mapStyle={styleUrl}
          attribution
          onPress={() => { setSelected(null); setAtPoint(null); }}
          onLongPress={onLongPress}
        >
          <MapLibreGL.Camera
            ref={cameraRef}
            initialViewState={{ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM }}
          />
          {userLocation && (
            <MapLibreGL.UserLocation animated />
          )}

          {/* Hail SWATH bands — filled polygons, smallest-first stacking,
              colored by band size. Declared before centroids so the dots
              draw on top. Suspect (unverified) cells render dimmed. */}
          <MapLibreGL.GeoJSONSource id="hs-swaths" data={visibleSwaths}>
            <MapLibreGL.Layer type="fill"
              id="hs-swaths-fill"
              style={{
                fillColor: SWATH_COLOR_STEPS,
                fillOpacity: [
                  "*",
                  ["interpolate", ["linear"], ["get", "min_size_in"],
                    0.75, 0.22, 1.0, 0.32, 1.5, 0.5, 2.0, 0.64, 3.0, 0.85],
                  ["case", ["==", ["get", "suspect"], 1], 0.4, 1],
                ] as any,
              }}
            />
            <MapLibreGL.Layer type="line"
              id="hs-swaths-line"
              style={{ lineColor: SWATH_COLOR_STEPS, lineWidth: 0.6, lineOpacity: 0.45 }}
            />
          </MapLibreGL.GeoJSONSource>

          {/* Storm centroids: halo + solid dot, sized + colored by
              peak hail. ShapeSource feeds both layers. */}
          <MapLibreGL.GeoJSONSource
            id="hs-storms"
            data={fc}
            onPress={onMapPress}
          >
            <MapLibreGL.Layer type="circle"
              id="hs-storms-halo"
              minzoom={3}
              style={{
                circleRadius: [
                  "interpolate",
                  ["linear"],
                  ["get", "peak_size_in"],
                  0.75, 8,
                  1.75, 12,
                  3.0, 18,
                ] as any,
                circleColor: HAIL_COLOR_STEPS,
                circleOpacity: 0.18,
                circleStrokeWidth: 0,
              }}
            />
            <MapLibreGL.Layer type="circle"
              id="hs-storms-dot"
              minzoom={3}
              style={{
                circleRadius: [
                  "interpolate",
                  ["linear"],
                  ["get", "peak_size_in"],
                  0.75, 4,
                  1.75, 5,
                  3.0, 7,
                ] as any,
                circleColor: HAIL_COLOR_STEPS,
                circleStrokeColor: "#FFFFFF",
                circleStrokeWidth: 1.4,
                circleOpacity: 1,
              }}
            />
          </MapLibreGL.GeoJSONSource>
        </MapLibreGL.Map>

        <View style={[styles.fab, { backgroundColor: t.bgLift, borderColor: t.border }]}>
          <LocationButton onPress={onMyLocation} />
        </View>

        {/* Storm-date pill — top-left. Shows which day is on the map and
            opens the day picker. */}
        <TouchableOpacity
          onPress={() => setDateOpen(true)}
          activeOpacity={0.85}
          accessibilityLabel="Choose storm date"
          style={[
            styles.datePill,
            {
              backgroundColor: t.bgLift,
              borderColor: selectedDay ? t.primary : t.border,
            },
          ]}
        >
          <Text style={styles.datePillIcon}>🗓</Text>
          <Text style={[styles.datePillTxt, { color: t.fg }]} numberOfLines={1}>
            {selectedDay ? dayLabel(selectedDay) : "All storms · 30 days"}
          </Text>
          <Text style={[styles.datePillChevron, { color: t.fgMuted }]}>▾</Text>
        </TouchableOpacity>

        {/* Day picker */}
        <Modal
          visible={dateOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setDateOpen(false)}
        >
          <Pressable style={styles.dateBackdrop} onPress={() => setDateOpen(false)}>
            <Pressable
              style={[styles.dateSheet, { backgroundColor: t.bg, borderColor: t.border }]}
              onPress={(e) => e.stopPropagation()}
            >
              <Text style={[styles.dateEyebrow, { color: t.accent }]}>STORM DATE</Text>
              <Text style={[styles.dateTitle, { color: t.fg }]}>Which storm?</Text>
              <Text style={[styles.dateHint, { color: t.fgMuted }]}>
                Pick a day to see just that storm, or show everything from the
                past 30 days.
              </Text>

              <ScrollView style={styles.dateList}>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedDay(null);
                    setDateOpen(false);
                  }}
                  style={[
                    styles.dayRow,
                    { borderColor: t.border },
                    !selectedDay && { backgroundColor: t.bgLift },
                  ]}
                >
                  <Text style={[styles.dayName, { color: t.fg }]}>
                    All storms · past 30 days
                  </Text>
                  {!selectedDay && <Text style={{ color: t.primary }}>✓</Text>}
                </TouchableOpacity>

                {days.length === 0 && (
                  <Text style={[styles.dateHint, { color: t.fgMuted, marginTop: SPACING.md }]}>
                    No storms in this window.
                  </Text>
                )}

                {days.map((d) => {
                  const active = d.date === selectedDay;
                  return (
                    <TouchableOpacity
                      key={d.date}
                      onPress={() => {
                        setSelectedDay(d.date);
                        setDateOpen(false);
                        setSelected(null);
                      }}
                      style={[
                        styles.dayRow,
                        { borderColor: t.border },
                        active && { backgroundColor: t.bgLift },
                      ]}
                    >
                      <View
                        style={[styles.dayBadge, { backgroundColor: peakColorHex(d.maxSize) }]}
                      >
                        <Text style={[styles.dayBadgeTxt, { color: badgeTextColor(d.maxSize) }]}>
                          {d.maxSize.toFixed(2)}″
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.dayName, { color: t.fg }]}>
                          {dayLabel(d.date)}
                        </Text>
                        <Text style={[styles.dayMeta, { color: t.fgMuted }]}>
                          {d.where}
                          {d.count > 1 ? ` · ${d.count} cells` : ""}
                        </Text>
                      </View>
                      {active && <Text style={{ color: t.primary }}>✓</Text>}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <TouchableOpacity
                onPress={() => setDateOpen(false)}
                style={[styles.dateDone, { backgroundColor: t.primary }]}
              >
                <Text style={[styles.dateDoneTxt, { color: t.primaryFg }]}>Done</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Drive mode — live glanceable swath map + voice while you head in. */}
        <View style={styles.driveWrap} pointerEvents="box-none">
          <TouchableOpacity
            onPress={() => navigation.navigate("Drive")}
            activeOpacity={0.85}
            style={[styles.driveBtn, { backgroundColor: t.primary }]}
            accessibilityLabel="Start drive mode"
          >
            <Text style={styles.driveIcon}>🚗</Text>
            <Text style={[styles.driveLabel, { color: t.primaryFg }]}>Drive Mode</Text>
          </TouchableOpacity>
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

            {/* Tap a storm → put its whole day on the map (hidden when that
                day is already the filter). */}
            {utcDay(selected.start_time) !== selectedDay && (
              <TouchableOpacity
                onPress={() => setSelectedDay(utcDay(selected.start_time))}
                activeOpacity={0.85}
                style={[styles.navHereBtn, { backgroundColor: t.primary }]}
              >
                <Text style={styles.navHereIcon}>🗓</Text>
                <Text style={[styles.navHereTxt, { color: t.primaryFg }]}>
                  See this day on the map
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {atPointLoading && (
          <View style={[styles.cardWrap, { backgroundColor: t.bgLift, borderColor: t.border }]}>
            <Text style={[styles.cardDate, { color: t.fgMuted }]}>Checking what hit here…</Text>
          </View>
        )}

        {atPoint && !atPointLoading && (
          <View style={[styles.cardWrap, { backgroundColor: t.bgLift, borderColor: t.border }]}>
            {atPoint.top ? (
              <View style={styles.cardRow}>
                <View style={[styles.badge, { backgroundColor: peakColorHex(atPoint.top.size_at_point ?? atPoint.top.max_hail_size_in) }]}>
                  <Text style={[styles.badgeSize, { color: badgeTextColor(atPoint.top.size_at_point ?? atPoint.top.max_hail_size_in) }]}>
                    {(atPoint.top.size_at_point ?? atPoint.top.max_hail_size_in).toFixed(2)}″
                  </Text>
                  <Text style={[styles.badgeObj, { color: badgeTextColor(atPoint.top.size_at_point ?? atPoint.top.max_hail_size_in) }]}>
                    {peakObjectLabel(atPoint.top.size_at_point ?? atPoint.top.max_hail_size_in)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardCity, { color: t.fg }]}>What hit here</Text>
                  <Text style={[styles.cardDate, { color: t.fgMuted }]}>
                    {atPoint.top.lsr_confirmed || atPoint.top.source === "SPC-LSR"
                      ? "✓ Ground-confirmed"
                      : "Radar-indicated"}
                    {atPoint.top.distance_mi != null ? ` · ${atPoint.top.distance_mi} mi away` : ""}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setAtPoint(null)} style={styles.closeBtn}>
                  <Text style={[styles.closeX, { color: t.fgMuted }]}>×</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.cardRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardCity, { color: t.fg }]}>No hail on record here</Text>
                  <Text style={[styles.cardDate, { color: t.fgMuted }]}>
                    No storms hit this exact spot in the last 30 days.
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setAtPoint(null)} style={styles.closeBtn}>
                  <Text style={[styles.closeX, { color: t.fgMuted }]}>×</Text>
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity
              onPress={() => {
                const dest = atPoint;
                setAtPoint(null);
                if (dest)
                  navigation.navigate("Navigate", {
                    destLng: dest.lng,
                    destLat: dest.lat,
                    label: "Dropped pin",
                  });
              }}
              activeOpacity={0.85}
              style={[styles.navHereBtn, { backgroundColor: t.primary }]}
            >
              <Text style={styles.navHereIcon}>🧭</Text>
              <Text style={[styles.navHereTxt, { color: t.primaryFg }]}>Navigate here</Text>
            </TouchableOpacity>
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
  return inches >= 1.5 ? "#FFFFFF" : "#0F172A";
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
  driveWrap: {
    position: "absolute",
    bottom: SPACING.xl,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  driveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: RADIUS.full,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  driveIcon: { fontSize: 18 },
  driveLabel: { fontSize: 15, fontWeight: "700", letterSpacing: 0.2 },
  navHereBtn: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 11,
    borderRadius: RADIUS.full,
  },
  navHereIcon: { fontSize: 16 },
  navHereTxt: { fontSize: 15, fontWeight: "700", letterSpacing: 0.2 },
  datePill: {
    position: "absolute",
    left: SPACING.lg,
    top: SPACING.lg,
    maxWidth: "62%",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  datePillIcon: { fontSize: 12 },
  datePillTxt: { fontSize: 12, fontWeight: "600", flexShrink: 1 },
  datePillChevron: { fontSize: 10 },
  dateBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  dateSheet: {
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
    maxHeight: "80%",
  },
  dateEyebrow: { fontSize: 10, fontFamily: "Courier", letterSpacing: 1.4 },
  dateTitle: { fontSize: 22, fontWeight: "500", marginTop: 2 },
  dateHint: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  dateList: { marginTop: SPACING.md },
  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 10,
    marginBottom: 6,
  },
  dayBadge: {
    minWidth: 54,
    alignItems: "center",
    borderRadius: RADIUS.sm,
    paddingVertical: 4,
  },
  dayBadgeTxt: { fontSize: 12, fontWeight: "700" },
  dayName: { fontSize: 14, fontWeight: "500" },
  dayMeta: { fontSize: 11, marginTop: 1 },
  dateDone: {
    marginTop: SPACING.sm,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  dateDoneTxt: { fontSize: 14, fontWeight: "600" },
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
