import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  useColorScheme,
} from "react-native";
import { useUser } from "@clerk/clerk-expo";
import { theme, SPACING, RADIUS } from "@/lib/tokens";
import { STORMS } from "@/lib/storm-fixtures";
import { Card } from "@/components/Card";
import { AppHeader } from "@/components/AppHeader";
import { StormRow } from "@/components/StormRow";

export function HomeScreen() {
  const t = theme(useColorScheme());
  const { user } = useUser();
  const [, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Re-render every minute so timestamps stay fresh
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const live = useMemo(() => STORMS.filter((s) => s.is_live), []);
  const recent = useMemo(
    () =>
      [...STORMS]
        .filter((s) => !s.is_live)
        .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
        .slice(0, 6),
    [],
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 600));
    setTick((n) => n + 1);
    setRefreshing(false);
  };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 5) return "Up early.";
    if (h < 12) return "Good morning.";
    if (h < 17) return "Good afternoon.";
    return "Good evening.";
  })();

  const firstName = user?.firstName ?? user?.emailAddresses[0]?.emailAddress.split("@")[0];

  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      <AppHeader
        eyebrow="Atlas overview"
        title={greeting}
        subtitle={firstName ? `Welcome back, ${firstName}.` : undefined}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
      >
        {/* KPI strip */}
        <View style={styles.kpiRow}>
          <Kpi label="Live now" value={String(live.length)} accent />
          <Kpi label="Past 7 days" value={String(STORMS.length - live.length)} />
          <Kpi label="Peak this run" value={`${Math.max(...STORMS.map((s) => s.peak_size_in)).toFixed(1)}″`} />
        </View>

        {/* Live storms */}
        <Card>
          <Text style={[styles.sectionEyebrow, { color: t.accent }]}>
            {live.length > 0 ? "LIVE NOW" : "ATLAS"}
          </Text>
          <Text style={[styles.sectionTitle, { color: t.fg }]}>
            {live.length > 0 ? "Tracking right now" : "Nothing tracking now"}
          </Text>
          {live.length > 0 ? (
            <View style={{ marginTop: SPACING.md, marginHorizontal: -SPACING.lg }}>
              {live.map((s) => (
                <StormRow
                  key={s.id}
                  city={s.city}
                  startTime={s.start_time}
                  peakSizeIn={s.peak_size_in}
                  isLive
                />
              ))}
            </View>
          ) : (
            <Text style={[styles.empty, { color: t.fgMuted }]}>
              All quiet on the atlas. Recent storms below.
            </Text>
          )}
        </Card>

        {/* Recent */}
        <Card style={{ marginTop: SPACING.lg }}>
          <Text style={[styles.sectionEyebrow, { color: t.accent }]}>RECENT · 30 DAYS</Text>
          <Text style={[styles.sectionTitle, { color: t.fg }]}>Recent storms</Text>
          <View style={{ marginTop: SPACING.md, marginHorizontal: -SPACING.lg }}>
            {recent.map((s) => (
              <StormRow
                key={s.id}
                city={s.city}
                startTime={s.start_time}
                peakSizeIn={s.peak_size_in}
              />
            ))}
          </View>
        </Card>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  const t = theme(useColorScheme());
  return (
    <View style={[styles.kpi, { backgroundColor: t.bgLift, borderColor: t.border }]}>
      <Text
        style={[
          styles.kpiValue,
          { color: accent ? t.accent : t.fg },
        ]}
      >
        {value}
      </Text>
      <Text style={[styles.kpiLabel, { color: t.fgMuted }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  kpiRow: { flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.lg },
  kpi: { flex: 1, borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.md },
  kpiValue: { fontFamily: "serif", fontSize: 26, fontWeight: "500", letterSpacing: -0.5 },
  kpiLabel: { fontSize: 9, fontFamily: "Courier", letterSpacing: 1.2, marginTop: 4 },
  sectionEyebrow: { fontSize: 10, fontFamily: "Courier", letterSpacing: 1.2, marginBottom: 4 },
  sectionTitle:   { fontFamily: "serif", fontSize: 22, fontWeight: "500", letterSpacing: -0.4 },
  empty: { marginTop: SPACING.md, fontSize: 14 },
});
