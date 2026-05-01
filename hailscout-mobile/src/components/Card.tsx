import React from "react";
import { View, ViewProps, useColorScheme } from "react-native";
import { theme, RADIUS, SPACING } from "@/lib/tokens";

interface Props extends ViewProps {
  children: React.ReactNode;
  inset?: number;
}

export function Card({ children, inset = SPACING.lg, style, ...rest }: Props) {
  const t = theme(useColorScheme());
  return (
    <View
      style={[
        {
          backgroundColor: t.bgLift,
          borderColor: t.border,
          borderWidth: 1,
          borderRadius: RADIUS.lg,
          padding: inset,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
