import React from "react";
import { View, Text, Pressable, StyleSheet, useColorScheme } from "react-native";
import { theme, RADIUS } from "@/lib/tokens";
import { HailBadge } from "@/components/HailBadge";
import { timeAgo } from "@/lib/time-ago";

interface Props {
  city: string;
  startTime: string;
  peakSizeIn: number;
  isLive?: boolean;
  onPress?: () => void;
}

export function StormRow({ city, startTime, peakSizeIn, isLive, onPress }: Props) {
  const t = theme(useColorScheme());
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: t.border, opacity: pressed ? 0.6 : 1 },
      ]}
    >
      {isLive ? (
        <View style={[styles.liveDot, { backgroundColor: t.accent }]} />
      ) : (
        <View style={[styles.staticDot, { backgroundColor: t.fgMuted }]} />
      )}
      <View style={styles.body}>
        <Text style={[styles.city, { color: t.fg }]} numberOfLines={1}>{city}</Text>
        <Text style={[styles.meta, { color: t.fgMuted }]} numberOfLines={1}>
          {isLive ? "active · " : ""}{timeAgo(startTime)}
        </Text>
      </View>
      <HailBadge sizeIn={peakSizeIn} compact />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  liveDot:   { width: 8, height: 8, borderRadius: 4 },
  staticDot: { width: 6, height: 6, borderRadius: 3 },
  body: { flex: 1, minWidth: 0 },
  city: { fontSize: 15, fontWeight: "500", letterSpacing: -0.2 },
  meta: { fontSize: 11, marginTop: 2, fontFamily: "Courier", letterSpacing: 0.2 },
});
