import React from "react";
import { TouchableOpacity, StyleSheet, Text } from "react-native";

interface LocationButtonProps {
  onPress: () => void;
  disabled?: boolean;
}

/**
 * LocationButton
 *
 * Floating action button to recenter the map on user location.
 * Positioned in the bottom-right, above the scale bar.
 */
export function LocationButton({ onPress, disabled }: LocationButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.buttonDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Text style={styles.icon}>📍</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    bottom: 80,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#0066cc",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  icon: {
    fontSize: 20,
  },
});
