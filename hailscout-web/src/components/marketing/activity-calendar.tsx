"use client";

import { useMemo, useState } from "react";
import { useStorms } from "@/hooks/useStorms";
import { hailColor } from "@/lib/hail";

/**
 * Year-at-a-glance activity heatmap, GitHub-contributions style.
 *
 * Each cell is one UTC day, colored by that day's peak hail size.
 * Empty days are background. ~53 weeks wide × 7 days tall.
 *
 * Pulls 200 most recent storms over 365 days; with cell tracking
 * that's a representative sample of activity even before backfill
 * completes.
 */
export function ActivityCalendar({ className }: { className?: string }) {
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

  // Build a per-day lookup: date string -> {count, peak}
  const byDay = useMemo(() => {
    const m = new Map<string, { count: number; peak: number }>();
    for (const s of storms) {
      const key = s.start_time.slice(0, 10);
      const cur = m.get(key) ?? { count: 0, peak: 0 };
      cur.count += 1;
      if (s.max_hail_size_in > cur.peak) cur.peak = s.max_hail_size_in;
      m.set(key, cur);
    }
    return m;
  }, [storms]);

  // Build a 53-week × 7-day grid ending today. Each cell carries its
  // ISO date so we can lookup the bucket without recomputing dates.
  const grid = useMemo(() => {
    const cells: Array<{ date: string; dow: number; week: number }> = [];
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    // Find the Sunday at-or-before (today - 364 days) so the grid
    // starts on a Sunday and includes 53 columns.
    const start = new Date(today.getTime() - 364 * 86_400_000);
    const startDow = start.getUTCDay(); // 0=Sun
    const gridStart = new Date(start.getTime() - startDow * 86_400_000);

    // 53 weeks * 7 days = 371 cells
    for (let i = 0; i < 53 * 7; i++) {
      const d = new Date(gridStart.getTime() + i * 86_400_000);
      if (d > today) break;
      cells.push({
        date: d.toISOString().slice(0, 10),
        dow: d.getUTCDay(),
        week: Math.floor(i / 7),
      });
    }
    return cells;
  }, []);

  // Month labels: pick the first cell of each new month and place a
  // label above its column.
  const monthLabels = useMemo(() => {
    const out: Array<{ week: number; label: string }> = [];
    let lastMonth = -1;
    for (const cell of grid) {
      const m = new Date(cell.date).getUTCMonth();
      if (m !== lastMonth && cell.dow === 0) {
        out.push({
          week: cell.week,
          label: new Date(cell.date).toLocaleDateString(undefined, { month: "short" }),
        });
        lastMonth = m;
      }
    }
    return out;
  }, [grid]);

  const [hovered, setHovered] = useState<string | null>(null);
  const hoveredBucket = hovered ? byDay.get(hovered) : null;

  const CELL = 12; // px in the SVG viewBox
  const GAP = 2;
  const cols = 53;
  const rows = 7;
  const W = cols * (CELL + GAP);
  const H = rows * (CELL + GAP) + 20; // +20 for month label row

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between mb-3">
        <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-foreground/55">
          Year at a glance · {byDay.size} active days
        </p>
        <div className="flex items-center gap-1.5 text-[10px] font-mono-num text-foreground/45">
          <span>Quiet</span>
          {[0.75, 1.5, 2.0, 2.5, 3.0].map((tier) => {
            const c = hailColor(tier);
            return (
              <span
                key={tier}
                className="inline-block w-3 h-3 rounded-[2px]"
                style={{ background: c.solid }}
                aria-label={`${tier}″+`}
              />
            );
          })}
          <span>Severe</span>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMinYMid meet"
          className="block min-w-[800px]"
          role="img"
          aria-label="Year activity calendar"
          onMouseLeave={() => setHovered(null)}
        >
          {/* Month labels */}
          {monthLabels.map(({ week, label }) => (
            <text
              key={`${week}-${label}`}
              x={week * (CELL + GAP)}
              y={12}
              fontSize={9}
              fontFamily="JetBrains Mono, ui-monospace, monospace"
              fill="currentColor"
              className="text-foreground/55"
            >
              {label}
            </text>
          ))}

          {/* Day cells */}
          <g transform="translate(0, 20)">
            {grid.map((cell) => {
              const bucket = byDay.get(cell.date);
              const c = bucket && bucket.peak > 0 ? hailColor(bucket.peak) : null;
              const x = cell.week * (CELL + GAP);
              const y = cell.dow * (CELL + GAP);
              return (
                <rect
                  key={cell.date}
                  x={x}
                  y={y}
                  width={CELL}
                  height={CELL}
                  rx={2}
                  fill={c?.solid ?? "currentColor"}
                  className={c ? "" : "text-foreground/8"}
                  opacity={c ? (hovered === cell.date ? 1 : 0.92) : 0.18}
                  stroke={hovered === cell.date ? "#D87C4A" : "transparent"}
                  strokeWidth={1.5}
                  onMouseEnter={() => setHovered(cell.date)}
                  style={{ cursor: bucket ? "pointer" : "default" }}
                />
              );
            })}
          </g>
        </svg>
      </div>

      {hovered && (
        <p className="mt-2 text-xs font-mono-num text-foreground/65">
          {new Date(hovered).toLocaleDateString(undefined, {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
          {hoveredBucket
            ? ` · ${hoveredBucket.count} cell${hoveredBucket.count === 1 ? "" : "s"} · peak ${hoveredBucket.peak.toFixed(2)}″ ${hailColor(hoveredBucket.peak).object}`
            : " · quiet day"}
        </p>
      )}
    </div>
  );
}
