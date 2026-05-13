"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useStorms } from "@/hooks/useStorms";
import { hailColor } from "@/lib/hail";
import { nearestMetro } from "@/lib/metros";

/**
 * "Top hail metros" leaderboard for /stats.
 *
 * Groups recent storms by nearest metro (Dallas, Wichita, OKC, …)
 * and shows the top 10 by cell count. Each row links to the storm
 * catalog filtered by that metro's state.
 *
 * Same client-side aggregation pattern as the dashboard's TopHailStates
 * tile, but rolled up by metro instead of state for finer granularity.
 */
export function TopMetros({ className }: { className?: string }) {
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

  const top = useMemo(() => {
    const m = new Map<string, { count: number; peak: number; state: string; name: string }>();
    for (const s of storms) {
      const where = nearestMetro(s.centroid_lat, s.centroid_lng);
      if (!where) continue;
      const key = `${where.metro.name}|${where.metro.state}`;
      const cur = m.get(key) ?? {
        count: 0,
        peak: 0,
        state: where.metro.state,
        name: where.metro.name,
      };
      cur.count += 1;
      if (s.max_hail_size_in > cur.peak) cur.peak = s.max_hail_size_in;
      m.set(key, cur);
    }
    return [...m.values()]
      .sort((a, b) => b.count - a.count || b.peak - a.peak)
      .slice(0, 10);
  }, [storms]);

  const maxCount = top[0]?.count ?? 1;

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between mb-3">
        <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-foreground/55">
          Top metros · past year
        </p>
        <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-foreground/55">
          {top.length} cities
        </p>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {top.length === 0 ? (
          <p className="px-6 py-8 text-center text-muted-foreground text-sm">
            No metros indexed yet. As the backfill ingests cells, the
            most-affected cities will surface here.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {top.map((row, i) => {
              const c = hailColor(row.peak);
              const pct = Math.max(8, Math.round((row.count / maxCount) * 100));
              return (
                <li key={`${row.name}-${row.state}`}>
                  <Link
                    href={`/storms/state/${row.state}`}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-secondary/30"
                  >
                    <span className="font-mono-num text-xs font-medium text-foreground/45 w-5">
                      {i + 1}
                    </span>
                    <span
                      className="inline-flex h-9 w-12 flex-col items-center justify-center rounded-md ring-1 ring-foreground/15 shadow-sm shrink-0"
                      style={{ background: c.solid, color: row.peak >= 1.5 ? "#FAF7F1" : c.text }}
                    >
                      <span className="font-mono-num text-xs font-medium leading-none">
                        {row.peak.toFixed(2)}″
                      </span>
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between">
                        <p className="font-display text-base font-medium tracking-tight-display text-foreground truncate">
                          {row.name}, {row.state}
                        </p>
                        <p className="font-mono-num text-sm font-medium text-foreground shrink-0 ml-3">
                          {row.count}
                        </p>
                      </div>
                      <div className="h-1.5 mt-1.5 rounded-full bg-foreground/5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: c.solid, opacity: 0.85 }}
                        />
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
