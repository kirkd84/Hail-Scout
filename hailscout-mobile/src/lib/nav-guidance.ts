/**
 * Turn-by-turn guidance engine — the same math as our hail-at-GPS engine, run
 * against a route instead of swaths. Pure functions, no deps, so it drives both
 * the phone NavigateScreen and (later) the CarPlay surface.
 *
 * buildNavRoute() precomputes cumulative distances once per route; guide() runs
 * each GPS tick to answer: next maneuver, distance to it, distance/time
 * remaining, and how far off-route you are (for reroute).
 */

import type { Route } from "@/lib/routing";

export interface NavRoute {
  coords: [number, number][];
  cum: number[]; // cumulative metres to each vertex
  totalM: number;
  totalS: number;
  steps: { instruction: string; name: string; type: number; alongM: number }[];
}

export interface Progress {
  stepIndex: number; // index of the NEXT maneuver
  instruction: string;
  roadName: string;
  distanceToManeuverM: number;
  remainingM: number;
  remainingS: number;
  offRouteM: number;
  arrived: boolean;
}

// Equirectangular metres — fast, accurate at street scale.
function metres(aLng: number, aLat: number, bLng: number, bLat: number): number {
  const midLat = (((aLat + bLat) / 2) * Math.PI) / 180;
  const dx = (aLng - bLng) * Math.cos(midLat) * 111_320;
  const dy = (aLat - bLat) * 110_540;
  return Math.hypot(dx, dy);
}

export function buildNavRoute(route: Route): NavRoute {
  const coords = route.geometry;
  const cum: number[] = new Array(coords.length).fill(0);
  for (let i = 1; i < coords.length; i++) {
    cum[i] =
      cum[i - 1] +
      metres(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
  }
  const totalM = coords.length ? cum[coords.length - 1] : 0;

  // Map each step's maneuver point onto its along-route distance (nearest vertex).
  const steps = route.steps.map((s) => {
    let bi = 0;
    let bd = Infinity;
    for (let i = 0; i < coords.length; i++) {
      const d = metres(s.location[0], s.location[1], coords[i][0], coords[i][1]);
      if (d < bd) {
        bd = d;
        bi = i;
      }
    }
    return {
      instruction: s.instruction,
      name: s.name,
      type: s.type,
      alongM: cum[bi] ?? 0,
    };
  });

  return { coords, cum, totalM, totalS: route.duration_s, steps };
}

// Project point p onto segment a→b (lng/lat space); return clamped t + point.
function project(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): { t: number; cx: number; cy: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return { t, cx: ax + t * dx, cy: ay + t * dy };
}

export function guide(userLng: number, userLat: number, nav: NavRoute): Progress {
  const { coords, cum, totalM } = nav;
  let bestD = Infinity;
  let bestAlong = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i];
    const b = coords[i + 1];
    const { t, cx, cy } = project(userLng, userLat, a[0], a[1], b[0], b[1]);
    const d = metres(userLng, userLat, cx, cy);
    if (d < bestD) {
      bestD = d;
      bestAlong = cum[i] + (cum[i + 1] - cum[i]) * t;
    }
  }

  const remainingM = Math.max(0, totalM - bestAlong);
  const remainingS = totalM > 0 ? nav.totalS * (remainingM / totalM) : 0;

  // Next maneuver = first step whose maneuver point is still ahead of us.
  const EPS = 8;
  let idx = nav.steps.findIndex((s) => s.alongM > bestAlong + EPS);
  if (idx < 0) idx = nav.steps.length - 1;
  const next = nav.steps[idx];

  return {
    stepIndex: idx,
    instruction: next?.instruction ?? "Arrive at destination",
    roadName: next?.name ?? "",
    distanceToManeuverM: next ? Math.max(0, next.alongM - bestAlong) : remainingM,
    remainingM,
    remainingS,
    offRouteM: bestD,
    arrived: remainingM < 25,
  };
}

/** Human distance for the maneuver banner: feet up close, miles beyond. */
export function fmtDistance(m: number): string {
  const ft = m * 3.28084;
  if (ft < 1000) return `${Math.max(0, Math.round(ft / 50) * 50)} ft`;
  return `${(m / 1609.34).toFixed(1)} mi`;
}
