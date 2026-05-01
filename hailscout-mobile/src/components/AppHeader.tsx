import React from "react";
import { View, Text, StyleSheet, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "@/lib/tokens";

interface Props {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}

export function AppHeader({ eyebrow, title, subtitle }: Props) {
  const t = theme(useColorScheme());
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { backgroundColor: t.bg, paddingTop: insets.top + 12, borderBottomColor: t.border }]}>
      {eyebrow && <Text style={[styles.eyebrow, { color: t.accent }]}>{eyebrow}</Text>}
      <Text style={[styles.title, { color: t.fg }]}>{title}</Text>
      {subtitle && <Text style={[styles.subtitle, { color: t.fgMuted }]}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingBottom: 14, paddingHorizontal: 20, borderBottomWidth: 1 },
  eyebrow: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.4,
    fontFamily: "Courier",
    marginBottom: 4,
  },
  title:    { fontFamily: "serif", fontSize: 32, fontWeight: "500", letterSpacing: -0.6, lineHeight: 36 },
  subtitle: { fontSize: 13, marginTop: 4 },
});
