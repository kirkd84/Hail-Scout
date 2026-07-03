/**
 * HailScout mobile design tokens — PenSnap-family palette (slate + cyan),
 * matching the web rebrand (2026-07): cool slate neutrals, a bright cyan
 * brand pop, dark cyan for readable text/links. The warm hail/severity ramp
 * is intentionally NOT here — it stays in lib/hail.ts as data viz.
 * Use via `theme(scheme)` to get either the light or dark palette.
 */

import type { ColorSchemeName } from "react-native";

const LIGHT = {
  bg:           "#F8FAFC", // slate-50
  bgLift:       "#FFFFFF",
  bgMuted:      "#F1F5F9", // slate-100
  fg:           "#0F172A", // slate-900
  fgMuted:      "#64748B", // slate-500
  border:       "#E2E8F0", // slate-200
  primary:      "#06B6D4", // cyan-500 — brand pop (fills/active); dark text on it
  primaryFg:    "#0F172A",
  accent:       "#0E7490", // cyan-700 — readable cyan for text/links on light
  accentDeep:   "#155E75", // cyan-800
  forest:       "#059669", // emerald-600 — success/positive
  destructive:  "#DC2626", // red-600
} as const;

const DARK = {
  bg:           "#0F172A", // slate-900
  bgLift:       "#1E293B", // slate-800
  bgMuted:      "#334155", // slate-700
  fg:           "#F1F5F9", // slate-100
  fgMuted:      "#94A3B8", // slate-400
  border:       "#475569", // slate-600
  primary:      "#22D3EE", // cyan-400 — brighter cyan reads on dark
  primaryFg:    "#06283D",
  accent:       "#67E8F9", // cyan-300 — light cyan for text/links on dark
  accentDeep:   "#A5F3FC", // cyan-200
  forest:       "#34D399", // emerald-400
  destructive:  "#F87171", // red-400
} as const;

// Values widened to `string` so the dark + light palettes (which have
// different literal hexes under `as const`) are both assignable to Theme.
export type Theme = { readonly [K in keyof typeof LIGHT]: string };

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
