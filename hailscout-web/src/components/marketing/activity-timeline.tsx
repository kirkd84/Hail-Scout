"use client";

import { useMemo, useState } from "react";
import { useStorms } from "@/hooks/useStorms";
import { hailColor } from "@/lib/hail";

interface Props {
  /** Number of days to render. Default 60 (two columns of 30 each
   *  on wide layouts). */
  days?: number;
  /** Optional className for the wrapper. */
  className?: string;
}

/**
 * Daily-activity timeline — horizontal bar chart of cells-per-day
 * over the past N days, colored by that day's peak hail size.
 *
 * Pure SVG, no chart library. The whole chart re-renders on every
 * useStorms refresh — fine because there's at most ~365 bars and
 * the props are simple primitives.
 */
export function ActivityTimeline({ days = 60, className }: Props) {
  const from = useMemo(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - days);
    return d.toISOString().slice(0, 10);
  }, [days]);
  const to = useMemo(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  }, []);
  const { storms, isLoading } = useStorms({
    bbox: [-125, 24, -66, 50],
    from,
    to,
    limit: 200,
    fallbackToFixtures: true,
  });

  // Build a date-indexed bucket of cells. Each bucket gets a count +
  // the peak hail size we've seen on that day so we can color it.
  const buckets = useMemo(() => {
    const out = new Map<string, { count: number; peak: number }>();
    // Seed every day in the window with zero so the chart isn't sparse
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      out.set(d.toISOString().slice(0, 10), { count: 0, peak: 0 });
    }
    for (const s of storms) {
      const key = s.start_time.slice(0, 10);
      const cur = out.get(key);
      if (!cur) continue;
      cur.count += 1;
      if (s.max_hail_size_in > cur.peak) cur.peak = s.max_hail_size_in;
    }
    return [...out.entries()].sort();
  }, [storms, days]);

  const maxCount = useMemo(
    () => Math.max(1, ...buckets.map(([, v]) => v.count)),
    [buckets],
  );
  const totalCells = buckets.reduce((a, [, v]) => a + v.count, 0);

  const [hovered, setHovered] = useState<number | null>(null);

  const W = 1000; // viewBox width
  const H = 120;  // viewBox height
  const PAD_TOP = 6;
  const PAD_BOT = 24;
  const barW = W / buckets.length;
  const innerH = H - PAD_TOP - PAD_BOT;

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between mb-3">
        <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-foreground/55">
          Daily activity · past {days} days
        </p>
        <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-foreground/55">
          {isLoading ? "Loading…" : `${totalCells.toLocaleString()} cells total`}
        </p>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="w-full h-32"
          role="img"
          aria-label="Daily hail activity"
          onMouseLeave={() => setHovered(null)}
        >
          {buckets.map(([date, v], i) => {
            const c = v.peak > 0 ? hailColor(v.peak) : null;
            const h = v.count > 0 ? Math.max(2, (v.count / maxCount) * innerH) : 0;
            const x = i * barW;
            const y = PAD_TOP + (innerH - h);
            const isHovered = hovered === i;
            return (
              <g
                key={date}
                onMouseEnter={() => setHovered(i)}
                onFocus={() => setHovered(i)}
                tabIndex={0}
                style={{ outline: "none" }}
              >
                {/* Hit area — full column height, transparent — so the
                    tooltip works even on empty days. */}
                <rect
                  x={x}
                  y={PAD_TOP}
                  width={barW}
                  height={innerH}
                  fill="transparent"
                />
                {v.count > 0 && c && (
                  <rect
                    x={x + 1}
                    y={y}
                    width={Math.max(1, barW - 2)}
                    height={h}
                    fill={c.solid}
                    opacity={isHovered ? 1 : 0.85}
                    rx={1}
                  />
                )}
              </g>
            );
          })}

          {/* Hover tooltip */}
          {hovered !== null &&
            (() => {
              const [date, v] = buckets[hovered];
              const labelX = Math.min(W - 180, Math.max(0, hovered * barW + barW / 2 - 90));
              const c = v.peak > 0 ? hailColor(v.peak) : null;
              return (
                <g pointerEvents="none">
                  <rect
                    x={hovered * barW + barW / 2 - 0.5}
                    y={PAD_TOP}
                    width={1}
                    height={innerH}
                    fill="#0F4C5C"
                    opacity={0.35}
                  />
                  <rect
                    x={labelX}
                    y={2}
                    width={180}
                    height={18}
                    rx={3}
                    fill="#FAF7F1"
                    stroke="#E0D9CC"
                    strokeWidth={0.5}
                  />
                  <text
                    x={labelX + 6}
                    y={14}
                    fontSize={10}
                    fontFamily="JetBrains Mono, ui-monospace, monospace"
                    fill="#2B2620"
                  >
                    {date} · {v.count} cells
                    {c ? ` · peak ${v.peak.toFixed(2)}″` : ""}
                  </text>
                </g>
              );
            })()}
        </svg>

        {/* X-axis tick marks (every ~10 days) */}
        <div className="mt-2 flex items-center justify-between text-[10px] font-mono-num text-foreground/45">
          <span>{buckets[0]?.[0]}</span>
          <span>{buckets[Math.floor(buckets.length / 2)]?.[0]}</span>
          <span>{buckets[buckets.length - 1]?.[0]}</span>
        </div>
      </div>
    </div>
  );
}
