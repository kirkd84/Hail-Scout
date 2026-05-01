import React from "react";
import { View, Text, StyleSheet, useColorScheme } from "react-native";
import { theme } from "@/lib/tokens";
import Svg, { Circle, Path } from "react-native-svg";

interface Props {
  size?: number;
  color?: string;
  showText?: boolean;
}

/**
 * HailScout wordmark — radar-ring topographic mark + sans wordmark.
 * Mirrors the web Wordmark component.
 */
export function Wordmark({ size = 24, color, showText = true }: Props) {
  const t = theme(useColorScheme());
  const primary = color ?? t.primary;
  const accent = t.accent;
  return (
    <View style={styles.row}>
      <Svg width={size} height={size} viewBox="0 0 28 28">
        <Circle cx={14} cy={14} r={11.5} stroke={primary} strokeWidth={1.1} fill="none" opacity={0.9} />
        <Circle cx={14} cy={14} r={7.75}  stroke={primary} strokeWidth={1}   fill="none" opacity={0.7} />
        <Circle cx={14} cy={14} r={4}     stroke={accent}  strokeWidth={1.1} fill="none" />
        <Path d="M5 14 Q14 7 23 14" stroke={accent} strokeWidth={1.2} fill="none" strokeLinecap="round" />
        <Circle cx={14} cy={14} r={1.4} fill={accent} />
      </Svg>
      {showText && (
        <Text style={[styles.text, { color: primary, fontSize: size * 0.7 }]}>HailScout</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  text: { fontWeight: "500", letterSpacing: -0.3 },
});
