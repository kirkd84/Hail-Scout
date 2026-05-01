/**
 * Hail-size palette — industry standard, mirrors web/lib/hail.ts.
 */

export interface HailColor {
  solid: string;
  bg: string;
  text: string;
  short: string;
  object: string;
  label: string;
}

const BINS: Array<{ min: number } & HailColor> = [
  { min: 0.5,  solid: "#9ED9A4", bg: "rgba(158,217,164,0.20)", text: "#2F6F3A", short: "0.5″",   object: "Pea",          label: "Pea ≥ 0.50″" },
  { min: 0.75, solid: "#36C168", bg: "rgba(54,193,104,0.18)",  text: "#1A6B36", short: "0.75″",  object: "Penny",        label: "Penny ≥ 0.75″" },
  { min: 1.0,  solid: "#F2D530", bg: "rgba(242,213,48,0.22)",  text: "#7A6510", short: "1.00″",  object: "Quarter",      label: "Quarter ≥ 1.00″" },
  { min: 1.25, solid: "#F0A12C", bg: "rgba(240,161,44,0.20)",  text: "#7A4A0E", short: "1.25″",  object: "Half-dollar",  label: "Half-dollar ≥ 1.25″" },
  { min: 1.5,  solid: "#EA7A2C", bg: "rgba(234,122,44,0.18)",  text: "#7A340D", short: "1.50″",  object: "Walnut",       label: "Walnut ≥ 1.50″" },
  { min: 1.75, solid: "#D9462F", bg: "rgba(217,70,47,0.16)",   text: "#6E1A10", short: "1.75″",  object: "Golf ball",    label: "Golf ball ≥ 1.75″" },
  { min: 2.0,  solid: "#A11F2A", bg: "rgba(161,31,42,0.14)",   text: "#580712", short: "2.00″",  object: "Hen egg",      label: "Hen egg ≥ 2.00″" },
  { min: 2.5,  solid: "#D45BAA", bg: "rgba(212,91,170,0.16)",  text: "#6B1F58", short: "2.50″",  object: "Tennis ball",  label: "Tennis ball ≥ 2.50″" },
  { min: 2.75, solid: "#8E3CA8", bg: "rgba(142,60,168,0.14)",  text: "#491657", short: "2.75″",  object: "Baseball",     label: "Baseball ≥ 2.75″" },
  { min: 3.0,  solid: "#4A2070", bg: "rgba(74,32,112,0.18)",   text: "#250A40", short: "3.00″+", object: "Softball",     label: "Softball ≥ 3.00″" },
];

export function hailColor(sizeIn: number): HailColor {
  for (let i = BINS.length - 1; i >= 0; i--) {
    if (sizeIn >= BINS[i].min) {
      const { min: _min, ...c } = BINS[i];
      return c;
    }
  }
  const { min: _min, ...c } = BINS[0];
  return c;
}
