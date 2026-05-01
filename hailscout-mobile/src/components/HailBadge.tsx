import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { hailColor } from "@/lib/hail";
import { RADIUS } from "@/lib/tokens";

interface Props {
  sizeIn: number;
  /** Compact: only show inches. Standard: inches + object label. */
  compact?: boolean;
}

export function HailBadge({ sizeIn, compact }: Props) {
  const c = hailColor(sizeIn);
  return (
    <View
      style={[
        styles.box,
        { backgroundColor: c.bg, borderColor: c.solid },
        compact && styles.compact,
      ]}
    >
      <Text style={[styles.value, { color: c.text }]}>{sizeIn.toFixed(2)}″</Text>
      {!compact && (
        <Text style={[styles.object, { color: c.text }]}>{c.object}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 56,
  },
  compact: { minWidth: 44, paddingVertical: 4 },
  value:  { fontSize: 13, fontWeight: "600", letterSpacing: -0.2 },
  object: { fontSize: 9,  fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.6, marginTop: 2, opacity: 0.85 },
});
