"use client";

/**
 * Live hail outlook — REAL data, no fixtures.
 *
 * Fetches /v1/outlook/hail?day=1 and ?day=2 (public, no auth) and renders
 * the actual SPC hail-probability contours on a small dark CONUS plate,
 * plus a plain-language probability list with the valid window in the
 * visitor's local time.
 *
 * The old version of this file painted a sin/cos-generated 5×7 risk grid
 * labeled "Example view". That fixture is DELETED — this widget now shows
 * only what the National Weather Service's Storm Prediction Center has
 * actually issued. A quiet day legitimately has no contours, so the empty
 * state says so honestly ("No hail risk mapped for today") instead of
 * inventing risk. An unreachable API is reported as unreachable — never
 * disguised as a quiet day.
 *
 * Day 3 is deliberately absent: SPC publishes no hail-specific product for
 * day 3 (it switches to a combined severe probability), so offering a tab
 * that is always empty would be misleading.
 *
 * Color rules: probability areas are CYAN at increasing opacity (the one
 * brand accent, used here as data). The warm hail ramp appears only for
 * the "significant hail" (2″+) contour — real data color for real data.
 */

import { useMemo, useState } from "react";
import useSWR from "swr";
import { apiClient } from "@/lib/api";
import { hailColor } from "@/lib/hail";
import { cn } from "@/lib/utils";
import { SectionHeading } from "@/components/marketing/primitives";

// ---- API shapes (mirror hailscout-api routes/radar.py) ----

interface GeoMultiPolygon {
  type: "MultiPolygon";
  coordinates: number[][][][];
}

interface OutlookContour {
  id: string;
  day: number;
  kind: string; // "hail" | "sighail"
  /** Fraction 0..1. For kind="sighail" it's a flat 0.10 convention. */
  probability: number;
  label: string | null;
  valid_from: string;
  valid_to: string;
  issued_at?: string | null;
  geometry: GeoMultiPolygon | null;
}

interface OutlooksResponse {
  outlooks: OutlookContour[];
}

/** Per-day result: null = fetch failed (≠ empty, which is a quiet day). */
interface OutlookData {
  d1: OutlookContour[] | null;
  d2: OutlookContour[] | null;
}

async function fetchOutlooks(): Promise<OutlookData> {
  const [r1, r2] = await Promise.allSettled([
    apiClient.get<OutlooksResponse>("/v1/outlook/hail?day=1"),
    apiClient.get<OutlooksResponse>("/v1/outlook/hail?day=2"),
  ]);
  return {
    d1: r1.status === "fulfilled" ? r1.value.outlooks : null,
    d2: r2.status === "fulfilled" ? r2.value.outlooks : null,
  };
}

// ---- Tiny CONUS projection (equirectangular over the lower 48) ----

const LON_MIN = -125;
const LON_MAX = -66;
const LAT_MIN = 24;
const LAT_MAX = 50;
const VW = 100;
const VH = 55;

const px = (lon: number) => ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * VW;
const py = (lat: number) => ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * VH;

function ringPath(ring: number[][]): string {
  if (ring.length < 3) return "";
  // Thin dense SPC rings so the DOM stays light; the plate is ~500px wide.
  const step = Math.max(1, Math.floor(ring.length / 140));
  const parts: string[] = [];
  for (let i = 0; i < ring.length; i += step) {
    const p = ring[i];
    parts.push(`${i === 0 ? "M" : "L"}${px(p[0]).toFixed(1)},${py(p[1]).toFixed(1)}`);
  }
  parts.push("Z");
  return parts.join("");
}

function multiPolygonPath(geom: GeoMultiPolygon | null): string {
  if (!geom) return "";
  // Include hole rings too; rendered with fillRule="evenodd".
  return geom.coordinates.map((poly) => poly.map(ringPath).join("")).join("");
}

/** Coarse (hand-simplified) lower-48 border for orientation — ~70 points. */
const CONUS_OUTLINE: [number, number][] = [
  [-124.7, 48.4], [-123.3, 49.0], [-95.2, 49.0], [-94.6, 48.7], [-92.0, 48.1],
  [-89.5, 48.0], [-88.4, 48.3], [-84.9, 46.9], [-84.7, 45.9], [-82.5, 45.3],
  [-82.1, 43.6], [-83.1, 42.3], [-82.4, 41.7], [-80.5, 42.3], [-78.9, 42.9],
  [-79.0, 43.3], [-76.8, 43.6], [-75.0, 45.0], [-71.5, 45.0], [-69.2, 47.5],
  [-67.8, 47.1], [-67.0, 44.9], [-68.9, 44.4], [-70.0, 43.8], [-70.8, 42.9],
  [-70.0, 41.6], [-72.0, 41.0], [-74.0, 40.5], [-75.0, 38.4], [-75.9, 36.9],
  [-75.5, 35.2], [-77.9, 34.0], [-79.2, 33.2], [-80.9, 32.0], [-81.4, 30.7],
  [-80.5, 28.5], [-80.0, 26.8], [-80.1, 25.2], [-81.1, 25.2], [-81.7, 26.0],
  [-82.7, 27.9], [-82.7, 29.0], [-84.0, 30.1], [-85.7, 30.1], [-87.8, 30.2],
  [-89.0, 30.4], [-89.6, 29.2], [-91.6, 29.6], [-93.8, 29.7], [-94.9, 29.3],
  [-96.6, 28.7], [-97.4, 27.3], [-97.1, 25.9], [-99.5, 27.5], [-101.4, 29.8],
  [-102.4, 29.8], [-103.1, 28.9], [-104.9, 30.6], [-106.5, 31.8], [-108.2, 31.3],
  [-111.1, 31.3], [-114.7, 32.7], [-117.1, 32.5], [-118.3, 33.7], [-120.6, 34.6],
  [-122.5, 37.2], [-123.7, 38.9], [-124.1, 41.1], [-124.3, 43.1], [-124.0, 44.6],
  [-124.1, 46.9],
];
const CONUS_PATH = ringPath(CONUS_OUTLINE);

/** Real city coordinates — orientation marks only. */
const CITIES: { name: string; lon: number; lat: number }[] = [
  { name: "DEN", lon: -104.99, lat: 39.74 },
  { name: "OKC", lon: -97.52, lat: 35.47 },
  { name: "DFW", lon: -96.8, lat: 32.78 },
  { name: "MSP", lon: -93.27, lat: 44.98 },
  { name: "CHI", lon: -87.63, lat: 41.88 },
  { name: "ATL", lon: -84.39, lat: 33.75 },
  { name: "PHX", lon: -112.07, lat: 33.45 },
];

// Mode-invariant plate inks (the plate is always dark, like the product map).
const INK = "hsl(var(--cream-50))";
const CYAN = "hsl(var(--copper-500))";
const SIG = hailColor(2.0); // deep red — the real 2.00″ bin

/** Probability → cyan fill opacity. Monotonic: 5%→0.14 … 60%→0.55. */
const probOpacity = (p: number) => Math.min(0.6, Math.max(0.12, 0.1 + p * 0.75));

const fmtLocal = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });

// ---- Component ----

export function HailOutlook() {
  const [day, setDay] = useState<1 | 2>(1);

  const { data, isLoading } = useSWR<OutlookData>(
    "/v1/outlook/hail?days=1,2",
    fetchOutlooks,
    {
      revalidateOnFocus: false,
      dedupingInterval: 10 * 60_000,
      refreshInterval: 15 * 60_000, // SPC re-issues several times a day
      shouldRetryOnError: false,
    },
  );

  const contours = day === 1 ? data?.d1 : data?.d2;
  const unreachable = data !== undefined && contours === null;

  // Hail contours arrive ascending by probability (draw order); list wants
  // the highest risk first. sighail is a convention (10% chance of 2″+),
  // kept separate so its 0.10 never reads as the headline probability.
  const hail = useMemo(
    () => (contours ?? []).filter((c) => c.kind === "hail"),
    [contours],
  );
  const sig = useMemo(
    () => (contours ?? []).filter((c) => c.kind === "sighail"),
    [contours],
  );
  const paths = useMemo(
    () =>
      new Map(
        (contours ?? []).map((c) => [c.id, multiPolygonPath(c.geometry)] as const),
      ),
    [contours],
  );

  const maxD1 = maxHailProb(data?.d1);
  const maxD2 = maxHailProb(data?.d2);
  const window = hail[0] ?? sig[0] ?? null;
  const quiet = contours !== null && contours !== undefined && contours.length === 0;

  return (
    <section id="outlook" className="bg-secondary/40">
      <div className="container max-w-6xl py-24 md:py-32">
        <SectionHeading
          eyebrow="Live outlook"
          title="Where hail is likely next."
          lede="Real hail probabilities from NOAA's storm forecasters, drawn the moment they're issued. On a quiet day, we tell you it's quiet — this panel never invents risk."
        />

        <div className="mt-10 grid gap-6 md:mt-12 lg:grid-cols-[minmax(0,1fr)_20rem]">
          {/* ---- Map plate (always dark, like the product) ---- */}
          <div className="relative overflow-hidden rounded-xl border border-teal-700/70 bg-teal-900">
            <svg viewBox={`0 0 ${VW} ${VH}`} className="block h-auto w-full" role="img" aria-label={`Hail outlook map for ${day === 1 ? "today" : "tomorrow"}`}>
              {/* Ground + graticule */}
              <rect width={VW} height={VH} fill="hsl(var(--teal-900))" />
              <g stroke={INK} strokeWidth="0.07" opacity="0.12">
                {[-120, -110, -100, -90, -80, -70].map((lon) => (
                  <line key={lon} x1={px(lon)} y1="0" x2={px(lon)} y2={VH} strokeDasharray="0.8 1.4" />
                ))}
                {[30, 35, 40, 45].map((lat) => (
                  <line key={lat} x1="0" y1={py(lat)} x2={VW} y2={py(lat)} strokeDasharray="0.8 1.4" />
                ))}
              </g>
              <g fontFamily="var(--font-mono)" fontSize="1.5" fill={INK} opacity="0.35">
                <text x={px(-110) + 0.7} y="2.6">110°W</text>
                <text x={px(-95) + 0.7} y="2.6">95°W</text>
                <text x={px(-80) + 0.7} y="2.6">80°W</text>
                <text x="0.8" y={py(40) - 0.7}>40°N</text>
                <text x="0.8" y={py(30) - 0.7}>30°N</text>
              </g>

              {/* Lower-48 border for orientation */}
              <path d={CONUS_PATH} fill={INK} fillOpacity="0.03" stroke={INK} strokeWidth="0.16" strokeOpacity="0.3" />

              {/* Real SPC contours — cyan by probability, ascending draw order */}
              {hail.map((c) => (
                <path
                  key={c.id}
                  d={paths.get(c.id) ?? ""}
                  fill={CYAN}
                  fillOpacity={probOpacity(c.probability)}
                  fillRule="evenodd"
                  stroke={CYAN}
                  strokeWidth="0.18"
                  strokeOpacity="0.7"
                />
              ))}
              {/* Significant hail (2″+) — the real size-ramp red, dashed */}
              {sig.map((c) => (
                <path
                  key={c.id}
                  d={paths.get(c.id) ?? ""}
                  fill="none"
                  stroke={SIG.solid}
                  strokeWidth="0.35"
                  strokeDasharray="1 0.8"
                  opacity="0.9"
                />
              ))}

              {/* City orientation marks */}
              <g fontFamily="var(--font-mono)" fontSize="1.5" fill={INK}>
                {CITIES.map((c) => (
                  <g key={c.name}>
                    <circle cx={px(c.lon)} cy={py(c.lat)} r="0.4" opacity="0.55" />
                    <text x={px(c.lon) + 0.9} y={py(c.lat) + 0.5} opacity="0.4" letterSpacing="0.1">
                      {c.name}
                    </text>
                  </g>
                ))}
              </g>
            </svg>

            {/* Plate chip */}
            <div className="absolute left-3 top-3 rounded-full border border-cream-50/15 bg-teal-900/85 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-cream-50/60 backdrop-blur-sm sm:left-4 sm:top-4">
              Hail outlook · {day === 1 ? "today" : "tomorrow"} · live
            </div>

            {/* Honest quiet / loading / unreachable overlays */}
            {(isLoading || quiet || unreachable) && (
              <div className="absolute inset-0 flex items-center justify-center p-6">
                <div className="rounded-xl border border-cream-50/15 bg-teal-900/85 px-5 py-4 text-center backdrop-blur-sm">
                  <p className="font-medium text-cream-50">
                    {isLoading
                      ? "Reading the live outlook…"
                      : unreachable
                        ? "Live outlook unreachable right now."
                        : `No hail risk mapped for ${day === 1 ? "today" : "tomorrow"}.`}
                  </p>
                  <p className="mt-1 text-sm text-teal-200/80">
                    {isLoading
                      ? "Fetching the current forecast."
                      : unreachable
                        ? "Check back in a few minutes."
                        : "Quiet forecast. The outlook updates several times a day."}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ---- Readout column ---- */}
          <div className="flex flex-col gap-4">
            {/* Day switch — 44px targets */}
            <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Outlook day">
              {([1, 2] as const).map((d) => {
                const max = d === 1 ? maxD1 : maxD2;
                const active = day === d;
                return (
                  <button
                    key={d}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setDay(d)}
                    className={cn(
                      "min-h-11 rounded-md border px-3 text-left transition-colors",
                      active
                        ? "border-primary/60 bg-primary/10"
                        : "border-border bg-card hover:bg-secondary/40",
                    )}
                  >
                    <span className={cn("block font-mono text-[10px] uppercase tracking-[0.14em]", active ? "text-primary" : "text-muted-foreground")}>
                      {d === 1 ? "Today" : "Tomorrow"}
                    </span>
                    <span className={cn("font-mono-num text-sm font-medium", active ? "text-foreground" : "text-muted-foreground")}>
                      {max != null ? `up to ${Math.round(max * 100)}%` : "—"}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Probability rows — real contours, highest first */}
            <div className="rounded-xl border border-border bg-card p-4">
              {hail.length > 0 || sig.length > 0 ? (
                <ul className="space-y-2.5">
                  {[...hail].reverse().map((c) => (
                    <li key={c.id} className="flex items-center gap-3">
                      <span
                        className="h-3.5 w-3.5 shrink-0 rounded-[3px] border border-copper-500/60"
                        style={{ background: `hsl(var(--copper-500) / ${probOpacity(c.probability) + 0.15})` }}
                        aria-hidden
                      />
                      <span className="text-sm text-foreground">
                        <span className="font-mono-num font-medium">{Math.round(c.probability * 100)}%</span>{" "}
                        chance of hail
                      </span>
                    </li>
                  ))}
                  {sig.map((c) => (
                    <li key={c.id} className="flex items-center gap-3">
                      <span
                        className="h-3.5 w-3.5 shrink-0 rounded-[3px] border-2 border-dashed"
                        style={{ borderColor: SIG.solid }}
                        aria-hidden
                      />
                      <span className="text-sm text-foreground">Large hail possible (2″+)</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {isLoading
                    ? "Loading…"
                    : unreachable
                      ? "Live outlook unreachable right now."
                      : `No hail risk mapped for ${day === 1 ? "today" : "tomorrow"}.`}
                </p>
              )}

              {window && (
                <p className="mt-4 border-t border-border/60 pt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Valid {fmtLocal(window.valid_from)} → {fmtLocal(window.valid_to)} · your time
                </p>
              )}
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground">
              Source: NOAA Storm Prediction Center hail outlook, fetched live. A
              percentage is the chance of 1″ or larger hail within 25 miles of any
              point inside the shaded area.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function maxHailProb(list: OutlookContour[] | null | undefined): number | null {
  if (!list) return null;
  const probs = list.filter((c) => c.kind === "hail").map((c) => c.probability);
  return probs.length ? Math.max(...probs) : null;
}
