import React from "react";
import { View, Text, StyleSheet } from "react-native";

export function AddressesScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Monitored Addresses</Text>
        <Text style={styles.placeholder}>Coming in Month 3</Text>
        <Text style={styles.description}>
          Track hail impact on properties you're monitoring. Full address
          management, alert thresholds, and canvassing integration launching
          in Month 3.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 8,
    textAlign: "center",
  },
  placeholder: {
    fontSize: 16,
    color: "#0066cc",
    fontWeight: "600",
    marginBottom: 16,
    textAlign: "center",
  },
  description: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
  },
});
