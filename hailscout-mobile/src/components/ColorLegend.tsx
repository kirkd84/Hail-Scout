import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface LegendItem {
  color: string;
  label: string;
}

/**
 * ColorLegend Component
 *
 * Displays the industry-standard hail swath color legend.
 * Matches the color scheme from the tiles repo to ensure consistency.
 *
 * Categories:
 *   - Green: 0.75"
 *   - Yellow: 1.0"
 *   - Orange: 1.25-1.5"
 *   - Red: 1.75-2.0"
 *   - Purple: 2.5"+
 *   - Black: 3.0"+
 */
const LEGEND_ITEMS: LegendItem[] = [
  { color: "#22c55e", label: "0.75\"" },
  { color: "#eab308", label: "1.0\"" },
  { color: "#f97316", label: "1.25-1.5\"" },
  { color: "#ef4444", label: "1.75-2.0\"" },
  { color: "#a855f7", label: "2.5\"+" },
  { color: "#1a1a1a", label: "3.0\"+" },
];

export function ColorLegend() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hail Size</Text>
      <View style={styles.grid}>
        {LEGEND_ITEMS.map((item) => (
          <View key={item.label} style={styles.item}>
            <View
              style={[
                styles.colorBox,
                { backgroundColor: item.color, borderColor: item.color },
              ]}
            />
            <Text style={styles.label}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 16,
    left: 16,
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
    maxWidth: 120,
  },
  title: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  grid: {
    gap: 6,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  colorBox: {
    width: 12,
    height: 12,
    borderRadius: 2,
    borderWidth: 1,
  },
  label: {
    fontSize: 11,
    color: "#666",
    fontWeight: "500",
  },
});
