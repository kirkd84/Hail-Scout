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

interface AddressRow {
  id: number;
  address: string | null;
  label: string | null;
  lat: number | null;
  lng: number | null;
  last_storm_size_in: number | null;
  last_storm_at: string | null;
}

export function AddressesScreen() {
  const t = theme(useColorScheme());
  const { getToken, isSignedIn } = useAuth();
  const [rows, setRows] = useState<AddressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      const token = await getToken();
      const res = await apiRequest<AddressRow[]>("/v1/monitored-addresses", { token });
      setRows(res);
    } catch {
      // silent — show empty state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getToken, isSignedIn]);

  useEffect(() => { void load(); }, [load]);

  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      <AppHeader
        eyebrow="Watchlist"
        title={rows.length > 0 ? `${rows.length} address${rows.length === 1 ? "" : "es"}` : "No addresses yet"}
        subtitle="Synced from your desktop workspace"
      />

      {loading && rows.length === 0 && (
        <Text style={[styles.center, { color: t.fgMuted }]}>Loading…</Text>
      )}

      {!loading && rows.length === 0 && (
        <View style={styles.emptyWrap}>
          <Text style={[styles.emptyTitle, { color: t.fg }]}>Nothing to monitor.</Text>
          <Text style={[styles.emptyBody, { color: t.fgMuted }]}>
            Save addresses on the desktop atlas — they&apos;ll appear here automatically.
          </Text>
        </View>
      )}

      <FlatList
        data={rows}
        keyExtractor={(r) => String(r.id)}
        contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={t.accent} />
        }
        renderItem={({ item }) => (
          <View
            style={[
              styles.row,
              { backgroundColor: t.bgLift, borderColor: t.border },
            ]}
          >
            <View style={styles.rowBody}>
              <Text style={[styles.title, { color: t.fg }]} numberOfLines={1}>
                {item.label || item.address || "Untitled"}
              </Text>
              <Text style={[styles.meta, { color: t.fgMuted }]} numberOfLines={1}>
                {item.lat?.toFixed(3)}, {item.lng?.toFixed(3)}
              </Text>
            </View>
            {item.last_storm_size_in !== null && item.last_storm_size_in !== undefined && (
              <HailBadge sizeIn={item.last_storm_size_in} compact />
            )}
          </View>
        )}
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
  rowBody: { flex: 1, minWidth: 0 },
  title: { fontSize: 14, fontWeight: "500", letterSpacing: -0.2 },
  meta:  { fontSize: 11, marginTop: 4, fontFamily: "Courier", letterSpacing: 0.2 },
});
