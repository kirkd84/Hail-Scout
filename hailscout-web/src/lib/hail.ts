/**
 * Hail size palette — industry-standard.
 *
 * Matches the conventions used by HailTrace, Interactive Hail Maps, and
 * the NWS / NSSL MRMS visualizations. Contractors switching from those
 * tools should recognize this instantly: green → yellow → orange → red
 * → magenta → purple, with named "object" reference labels (penny,
 * quarter, golf ball, etc.).
 *
 * IMPORTANT: this palette is reserved for the *data* (swath fills,
 * size badges, legend). Brand chrome (UI panels, buttons, sidebar)
 * uses the Topographic palette in tailwind.config.ts. Don't mix.
 */

export interface HailColor {
  /** Solid hex for polygon fill / map circles. */
  solid: string;
  /** Stroke / border color (slightly darker). */
  stroke: string;
  /** Translucent background tint for size badges on cream UI. */
  bg: string;
  /** Border for size badges on cream UI. */
  border: string;
  /** Text color for size badges. */
  text: string;
  /** Bin label, e.g. "Golf ball ≥ 1.75″" */
  label: string;
  /** Just the size threshold, e.g. "1.75″" */
  short: string;
  /** Reference object name. */
  object: string;
}

interface Bin extends HailColor {
  min: number;
}

const BINS: Bin[] = [
  {
    min: 0.5,
    solid: "#9ED9A4",
    stroke: "#5DB562",
    bg: "rgba(158, 217, 164, 0.20)",
    border: "rgba(93, 181, 98, 0.55)",
    text: "#2F6F3A",
    label: "Pea ≥ 0.50″",
    short: "0.5″",
    object: "Pea",
  },
  {
    min: 0.75,
    solid: "#36C168",
    stroke: "#1F8E48",
    bg: "rgba(54, 193, 104, 0.18)",
    border: "rgba(31, 142, 72, 0.55)",
    text: "#1A6B36",
    label: "Penny ≥ 0.75″",
    short: "0.75″",
    object: "Penny",
  },
  {
    min: 1.0,
    solid: "#F2D530",
    stroke: "#C9A91D",
    bg: "rgba(242, 213, 48, 0.22)",
    border: "rgba(201, 169, 29, 0.6)",
    text: "#7A6510",
    label: "Quarter ≥ 1.00″",
    short: "1.00″",
    object: "Quarter",
  },
  {
    min: 1.25,
    solid: "#F0A12C",
    stroke: "#C5781A",
    bg: "rgba(240, 161, 44, 0.20)",
    border: "rgba(197, 120, 26, 0.6)",
    text: "#7A4A0E",
    label: "Half-dollar ≥ 1.25″",
    short: "1.25″",
    object: "Half-dollar",
  },
  {
    min: 1.5,
    solid: "#EA7A2C",
    stroke: "#B65419",
    bg: "rgba(234, 122, 44, 0.18)",
    border: "rgba(182, 84, 25, 0.6)",
    text: "#7A340D",
    label: "Walnut ≥ 1.50″",
    short: "1.50″",
    object: "Walnut",
  },
  {
    min: 1.75,
    solid: "#D9462F",
    stroke: "#A12A1A",
    bg: "rgba(217, 70, 47, 0.16)",
    border: "rgba(161, 42, 26, 0.6)",
    text: "#6E1A10",
    label: "Golf ball ≥ 1.75″",
    short: "1.75″",
    object: "Golf ball",
  },
  {
    min: 2.0,
    solid: "#A11F2A",
    stroke: "#6E0E1A",
    bg: "rgba(161, 31, 42, 0.14)",
    border: "rgba(110, 14, 26, 0.6)",
    text: "#580712",
    label: "Hen egg ≥ 2.00″",
    short: "2.00″",
    object: "Hen egg",
  },
  {
    min: 2.5,
    solid: "#D45BAA",
    stroke: "#9B3884",
    bg: "rgba(212, 91, 170, 0.16)",
    border: "rgba(155, 56, 132, 0.55)",
    text: "#6B1F58",
    label: "Tennis ball ≥ 2.50″",
    short: "2.50″",
    object: "Tennis ball",
  },
  {
    min: 2.75,
    solid: "#8E3CA8",
    stroke: "#6A2580",
    bg: "rgba(142, 60, 168, 0.14)",
    border: "rgba(106, 37, 128, 0.55)",
    text: "#491657",
    label: "Baseball ≥ 2.75″",
    short: "2.75″",
    object: "Baseball",
  },
  {
    min: 3.0,
    solid: "#4A2070",
    stroke: "#2A0E45",
    bg: "rgba(74, 32, 112, 0.18)",
    border: "rgba(42, 14, 69, 0.65)",
    text: "#250A40",
    label: "Softball ≥ 3.00″",
    short: "3.00″+",
    object: "Softball",
  },
];

export function hailColor(sizeIn: number): HailColor {
  // Walk down from largest; return first bin whose min ≤ size
  for (let i = BINS.length - 1; i >= 0; i--) {
    if (sizeIn >= BINS[i].min) {
      const { min: _min, ...c } = BINS[i];
      return c;
    }
  }
  const { min: _min, ...c } = BINS[0];
  return c;
}

/** Legend, ordered smallest → largest (vertical visual ramp). */
export const HAIL_LEGEND: HailColor[] = BINS.map(({ min: _min, ...c }) => c);

/** All bin thresholds, smallest first — used by the map paint expression. */
export const HAIL_THRESHOLDS = BINS.map((b) => b.min);

/** Color stops formatted for MapLibre `step` expressions (smallest first). */
export function hailStepStops(): (number | string)[] {
  // step expects: default, then [threshold, value, threshold, value, ...]
  // We want smallest hail to render first (default), then step UP by size.
  const out: (number | string)[] = [BINS[0].solid];
  for (let i = 1; i < BINS.length; i++) {
    out.push(BINS[i].min, BINS[i].solid);
  }
  return out;
}

export function hailStrokeStepStops(): (number | string)[] {
  const out: (number | string)[] = [BINS[0].stroke];
  for (let i = 1; i < BINS.length; i++) {
    out.push(BINS[i].min, BINS[i].stroke);
  }
  return out;
}
