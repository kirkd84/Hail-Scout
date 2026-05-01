import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  useColorScheme,
} from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { theme, SPACING, RADIUS } from "@/lib/tokens";
import { AppHeader } from "@/components/AppHeader";
import { HailBadge } from "@/components/HailBadge";
import { apiRequest } from "@/lib/api";
import { timeAgo } from "@/lib/time-ago";

interface AlertRow {
  id: number;
  storm_city: string | null;
  peak_size_in: number;
  storm_started_at: string;
  read_at: string | null;
  address: string | null;
  address_label: string | null;
}

interface AlertsResponse {
  alerts: AlertRow[];
  unread_count: number;
}

export function AlertsScreen() {
  const t = theme(useColorScheme());
  const { getToken, isSignedIn } = useAuth();

  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      const token = await getToken();
      const res = await apiRequest<AlertsResponse>("/v1/alerts", { token });
      setAlerts(res.alerts);
      setUnread(res.unread_count);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load alerts");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getToken, isSignedIn]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 60_000);
    return () => clearInterval(id);
  }, [load]);

  const markRead = useCallback(
    async (id: number) => {
      try {
        const token = await getToken();
        await apiRequest(`/v1/alerts/${id}/read`, { method: "POST", token });
        setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, read_at: new Date().toISOString() } : a)));
        setUnread((u) => Math.max(0, u - 1));
      } catch {
        // silent
      }
    },
    [getToken],
  );

  const onRefresh = () => {
    setRefreshing(true);
    void load();
  };

  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      <AppHeader
        eyebrow="Storm alerts"
        title={alerts.length > 0 ? `${alerts.length} alert${alerts.length === 1 ? "" : "s"}` : "All quiet"}
        subtitle={
          unread > 0
            ? `${unread} unread · pull to refresh`
            : "Live MRMS hits on your monitored addresses"
        }
      />

      {loading && alerts.length === 0 && (
        <Text style={[styles.center, { color: t.fgMuted }]}>Loading…</Text>
      )}
      {error && (
        <Text style={[styles.center, { color: t.destructive }]}>{error}</Text>
      )}

      {alerts.length === 0 && !loading && !error && (
        <View style={styles.emptyWrap}>
          <Text style={[styles.emptyTitle, { color: t.fg }]}>Quiet skies.</Text>
          <Text style={[styles.emptyBody, { color: t.fgMuted }]}>
            Save addresses on the map to be alerted when hail touches them.
          </Text>
        </View>
      )}

      <FlatList
        data={alerts}
        keyExtractor={(a) => String(a.id)}
        contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />
        }
        renderItem={({ item }) => {
          const isUnread = item.read_at === null;
          return (
            <View
              style={[
                styles.row,
                {
                  backgroundColor: isUnread ? `${t.accent}14` : t.bgLift,
                  borderColor: isUnread ? `${t.accent}66` : t.border,
                },
              ]}
              onTouchEnd={() => isUnread && void markRead(item.id)}
            >
              <HailBadge sizeIn={item.peak_size_in} />
              <View style={styles.rowBody}>
                <Text style={[styles.rowTitle, { color: t.fg }]} numberOfLines={1}>
                  {isUnread && (
                    <Text style={{ color: t.accent }}>● </Text>
                  )}
                  {item.address_label || item.address || "Monitored address"}
                </Text>
                <Text style={[styles.rowMeta, { color: t.fgMuted }]} numberOfLines={1}>
                  {item.storm_city ?? "Storm"} · {timeAgo(item.storm_started_at)}
                </Text>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { textAlign: "center", marginTop: SPACING.xxl, fontSize: 14 },
  emptyWrap: { padding: SPACING.xl, alignItems: "center" },
  emptyTitle: { fontFamily: "serif", fontSize: 22, fontWeight: "500", marginBottom: 8 },
  emptyBody: { textAlign: "center", fontSize: 14, lineHeight: 20, maxWidth: 280 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  rowBody:   { flex: 1, minWidth: 0 },
  rowTitle:  { fontSize: 14, fontWeight: "500", letterSpacing: -0.2 },
  rowMeta:   { fontSize: 11, marginTop: 2, fontFamily: "Courier", letterSpacing: 0.2 },
});
