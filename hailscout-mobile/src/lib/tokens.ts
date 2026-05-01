/**
 * HailScout mobile design tokens — Topographic palette ported from the web app.
 * Use via `theme(scheme)` to get either the light or dark palette.
 */

import type { ColorSchemeName } from "react-native";

const LIGHT = {
  bg:           "#F5F1EA",
  bgLift:       "#FAF7F1",
  bgMuted:      "#E8E1D4",
  fg:           "#2B2620",
  fgMuted:      "#6B6052",
  border:       "#E0D9CC",
  primary:      "#0F4C5C",
  primaryFg:    "#F5F1EA",
  accent:       "#D87C4A",
  accentDeep:   "#A85C2D",
  forest:       "#4A6B3A",
  destructive:  "#C0392B",
} as const;

const DARK = {
  bg:           "#1A1814",
  bgLift:       "#231F1A",
  bgMuted:      "#2D2722",
  fg:           "#F5F1EA",
  fgMuted:      "#A89F92",
  border:       "#3A332D",
  primary:      "#5BA8BC",
  primaryFg:    "#1A1814",
  accent:       "#D87C4A",
  accentDeep:   "#E89C7A",
  forest:       "#7CA068",
  destructive:  "#E07A6E",
} as const;

export type Theme = typeof LIGHT;

export function theme(scheme: ColorSchemeName | undefined): Theme {
  return scheme === "dark" ? DARK : LIGHT;
}

export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const RADIUS  = { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 } as const;

export const TYPE = {
  display: { fontFamily: "serif", fontWeight: "500" as const, letterSpacing: -0.4 },
  body:    { fontFamily: "System", fontWeight: "400" as const },
  mono:    { fontFamily: "Courier" as const, fontWeight: "400" as const, letterSpacing: 0.2 },
};
