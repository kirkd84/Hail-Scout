"use client";

import { useMemo } from "react";
import { useStorms } from "@/hooks/useStorms";
import { hailColor } from "@/lib/hail";

interface Tier {
  label: string;
  min: number;
  max: number; // exclusive upper bound
}

// Same 8-tier palette the pipeline uses. Last tier is unbounded
// (max = Infinity) so 3.0"+ softball hits the right slice.
const TIERS: Tier[] = [
  { label: "0.75″ Penny",      min: 0.75, max: 1.0 },
  { label: "1.0″ Quarter",     min: 1.0,  max: 1.25 },
  { label: "1.25″ Half-$",     min: 1.25, max: 1.5 },
  { label: "1.5″ Walnut",      min: 1.5,  max: 1.75 },
  { label: "1.75″ Golf",       min: 1.75, max: 2.0 },
  { label: "2.0″ Hen egg",     min: 2.0,  max: 2.5 },
  { label: "2.5″ Tennis",      min: 2.5,  max: 2.75 },
  { label: "2.75″ Baseball",   min: 2.75, max: 3.0 },
  { label: "3.0″+ Softball",   min: 3.0,  max: Infinity },
];

/**
 * Hail-size distribution donut. Counts past-365-day storms by peak
 * tier and renders each as a slice. Pure SVG, no chart library.
 *
 * Visual: cream center with a "TOTAL" stat in the middle; slices
 * around the outside colored by hail-tier solid; legend list to the
 * right showing label + count + percentage.
 */
export function SizeDistribution({ className }: { className?: string }) {
  const from = useMemo(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 365);
    return d.toISOString().slice(0, 10);
  }, []);
  const to = useMemo(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  }, []);
  const { storms } = useStorms({
    bbox: [-125, 24, -66, 50],
    from,
    to,
    limit: 200,
    fallbackToFixtures: true,
  });

  const breakdown = useMemo(() => {
    const counts = TIERS.map(() => 0);
    for (const s of storms) {
      const idx = TIERS.findIndex(
        (t) => s.max_hail_size_in >= t.min && s.max_hail_size_in < t.max,
      );
      if (idx >= 0) counts[idx] += 1;
    }
    const total = counts.reduce((a, b) => a + b, 0);
    return TIERS.map((t, i) => ({
      ...t,
      count: counts[i],
      pct: total === 0 ? 0 : counts[i] / total,
      color: hailColor(t.min),
    }));
  }, [storms]);

  const total = breakdown.reduce((a, b) => a + b.count, 0);

  // SVG geometry
  const SIZE = 220;
  const CENTER = SIZE / 2;
  const RADIUS = 88;
  const INNER = 58;

  // Build slice paths. We walk clockwise from 12 o'clock.
  let cursor = 0;
  const slices = breakdown.map((t) => {
    const start = cursor;
    const end = cursor + t.pct;
    cursor = end;
    const startRad = start * 2 * Math.PI - Math.PI / 2;
    const endRad = end * 2 * Math.PI - Math.PI / 2;
    const x1 = CENTER + RADIUS * Math.cos(startRad);
    const y1 = CENTER + RADIUS * Math.sin(startRad);
    const x2 = CENTER + RADIUS * Math.cos(endRad);
    const y2 = CENTER + RADIUS * Math.sin(endRad);
    const ix1 = CENTER + INNER * Math.cos(startRad);
    const iy1 = CENTER + INNER * Math.sin(startRad);
    const ix2 = CENTER + INNER * Math.cos(endRad);
    const iy2 = CENTER + INNER * Math.sin(endRad);
    const largeArc = t.pct > 0.5 ? 1 : 0;
    const d = t.count === 0
      ? ""
      : [
          `M ${x1.toFixed(2)} ${y1.toFixed(2)}`,
          `A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
          `L ${ix2.toFixed(2)} ${iy2.toFixed(2)}`,
          `A ${INNER} ${INNER} 0 ${largeArc} 0 ${ix1.toFixed(2)} ${iy1.toFixed(2)}`,
          "Z",
        ].join(" ");
    return { ...t, d };
  });

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between mb-3">
        <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-foreground/55">
          Hail-size distribution · past year
        </p>
        <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-foreground/55">
          {total.toLocaleString()} cells
        </p>
      </div>
      <div className="rounded-xl border border-border bg-card p-6 grid gap-6 md:grid-cols-[220px_1fr] md:items-center">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="w-[220px] h-[220px] mx-auto"
          role="img"
          aria-label="Hail-size distribution donut"
        >
          {/* Background ring for visual reference when many tiers are 0 */}
          <circle cx={CENTER} cy={CENTER} r={(RADIUS + INNER) / 2} fill="none"
                  stroke="hsl(var(--border))" strokeWidth={RADIUS - INNER} strokeOpacity={0.12} />
          {slices.map((s) =>
            s.d ? (
              <path
                key={s.label}
                d={s.d}
                fill={s.color.solid}
                opacity={0.92}
                stroke="hsl(var(--card))"
                strokeWidth={1}
              />
            ) : null,
          )}
          {/* Center label */}
          <text
            x={CENTER}
            y={CENTER - 6}
            textAnchor="middle"
            fontSize={26}
            fontWeight={500}
            fontFamily="Fraunces, Cambria, serif"
            fill="currentColor"
            className="text-foreground"
          >
            {total.toLocaleString()}
          </text>
          <text
            x={CENTER}
            y={CENTER + 16}
            textAnchor="middle"
            fontSize={9}
            letterSpacing={1.4}
            fontFamily="JetBrains Mono, ui-monospace, monospace"
            fill="currentColor"
            className="text-foreground/55"
          >
            CELLS
          </text>
        </svg>

        <ul className="space-y-1.5">
          {breakdown.map((t) => (
            <li
              key={t.label}
              className="flex items-baseline gap-2 text-sm"
            >
              <span
                className="inline-block w-3 h-3 rounded-sm shrink-0"
                style={{ background: t.color.solid, opacity: t.count === 0 ? 0.25 : 1 }}
                aria-hidden
              />
              <span className="flex-1 text-foreground/85 truncate">{t.label}</span>
              <span className="font-mono-num text-foreground/85">
                {t.count.toLocaleString()}
              </span>
              <span className="font-mono-num text-foreground/45 w-12 text-right">
                {(t.pct * 100).toFixed(1)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
