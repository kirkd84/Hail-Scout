/**
 * Hail size → topographic palette utility.
 *
 * Maps a hail diameter (inches) to a triplet of background, border,
 * and text colors that read well on cream paper. The bg/border use
 * a translucent tint of the category color over cream; text uses a
 * darker shade of the same color for readable contrast.
 *
 * Used by storm cards, fixture polygons, the legend, and the address
 * search results.
 */

export interface HailColor {
  bg: string;
  border: string;
  text: string;
  /** Solid color for polygon fill on the map. */
  solid: string;
  /** Bin label, e.g. "≥ 1.75″" */
  label: string;
}

const BINS: Array<{ min: number; bg: string; border: string; text: string; solid: string; label: string }> = [
  { min: 3.0,  bg: "hsl(245 35% 22% / 0.18)", border: "hsl(245 35% 22% / 0.55)", text: "hsl(245 35% 22%)", solid: "hsl(245 35% 28%)", label: "≥ 3.0″" },
  { min: 2.5,  bg: "hsl(298 40% 28% / 0.16)", border: "hsl(298 40% 28% / 0.55)", text: "hsl(298 40% 28%)", solid: "hsl(298 40% 35%)", label: "≥ 2.5″" },
  { min: 2.0,  bg: "hsl(0   55% 35% / 0.14)", border: "hsl(0   55% 35% / 0.55)", text: "hsl(0   55% 32%)", solid: "hsl(0   60% 42%)", label: "≥ 2.0″" },
  { min: 1.75, bg: "hsl(12  55% 42% / 0.14)", border: "hsl(12  55% 42% / 0.55)", text: "hsl(12  55% 32%)", solid: "hsl(12  60% 48%)", label: "≥ 1.75″" },
  { min: 1.5,  bg: "hsl(21  65% 50% / 0.14)", border: "hsl(21  65% 50% / 0.55)", text: "hsl(21  65% 38%)", solid: "hsl(21  65% 55%)", label: "≥ 1.5″" },
  { min: 1.25, bg: "hsl(30  68% 52% / 0.14)", border: "hsl(30  68% 52% / 0.55)", text: "hsl(30  68% 38%)", solid: "hsl(30  68% 55%)", label: "≥ 1.25″" },
  { min: 1.0,  bg: "hsl(42  72% 50% / 0.14)", border: "hsl(42  72% 50% / 0.55)", text: "hsl(42  72% 32%)", solid: "hsl(42  72% 52%)", label: "≥ 1.0″" },
  { min: 0.75, bg: "hsl(120 30% 40% / 0.13)", border: "hsl(120 30% 40% / 0.55)", text: "hsl(120 30% 28%)", solid: "hsl(120 30% 42%)", label: "≥ 0.75″" },
];

export function hailColor(sizeIn: number): HailColor {
  for (const b of BINS) {
    if (sizeIn >= b.min) {
      return { bg: b.bg, border: b.border, text: b.text, solid: b.solid, label: b.label };
    }
  }
  return { bg: BINS[BINS.length - 1].bg, border: BINS[BINS.length - 1].border, text: BINS[BINS.length - 1].text, solid: BINS[BINS.length - 1].solid, label: "< 0.75″" };
}

export const HAIL_LEGEND = [...BINS].reverse(); // smallest first for visual ramp
