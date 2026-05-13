"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { apiClient } from "@/lib/api";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-chrome";
import { ContourBg } from "@/components/brand/contour-bg";
import { hailColor } from "@/lib/hail";
import { nearestMetro } from "@/lib/metros";
import { useStorms } from "@/hooks/useStorms";
import { ActivityTimeline } from "@/components/marketing/activity-timeline";
import { ActivityCalendar } from "@/components/marketing/activity-calendar";

interface StatsResponse {
  total_cells: number;
  cells_last_24h: number;
  cells_last_7d: number;
  cells_last_30d: number;
  peak_hail_in: number;
  earliest: string | null;
  latest: string | null;
  sources: Record<string, number>;
}

/**
 * Public /stats — "By the numbers" page.
 *
 * Hits /v1/storms/stats for aggregate counters (whole DB), then
 * /v1/storms?limit=200&order=peak for the top-cells list. Everything
 * is read-only and unauthenticated.
 *
 * Designed to grow as the backfill fills out — when the user opens
 * this page after the 12-month backfill completes, the numbers will
 * be in the 10,000s.
 */
export default function StatsPage() {
  // Tick every minute so "last 24h" stays accurate over a stale tab
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const { data: stats, error: statsErr } = useSWR<StatsResponse>(
    "/v1/storms/stats",
    (url: string) => apiClient.get<StatsResponse>(url),
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );

  // Top 10 biggest cells in the past year
  const yearAgo = (() => {
    const d = new Date();
    d.setUTCFullYear(d.getUTCFullYear() - 1);
    return d.toISOString().slice(0, 10);
  })();
  const tomorrow = (() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  })();
  const { storms: biggest } = useStorms({
    bbox: [-125, 24, -66, 50],
    from: yearAgo,
    to: tomorrow,
    limit: 10,
    order: "peak",
    fallbackToFixtures: true,
  });

  const sourceEntries = stats
    ? Object.entries(stats.sources).sort((a, b) => b[1] - a[1])
    : [];

  return (
    <main className="bg-background text-foreground">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden bg-topo">
        <ContourBg className="opacity-90" density="sparse" />
        <div className="container relative pb-10 pt-16 md:pb-12 md:pt-20">
          <p className="font-mono-num text-xs uppercase tracking-wide-caps text-copper">
            By the numbers · public
          </p>
          <h1 className="mt-2 font-display text-balance text-5xl font-medium leading-[1.05] tracking-tight-display text-foreground md:text-6xl">
            Every hailstorm, accounted for.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            HailScout indexes every MRMS-detected hail cell across the
            continental U.S., plus high-resolution NEXRAD storm-cell
            tracking. Here&apos;s what the atlas looks like right now.
          </p>
        </div>
      </section>

      {/* KPI grid */}
      <section className="bg-card border-y border-border">
        <div className="container py-12 md:py-16">
          {statsErr ? (
            <p className="text-sm text-destructive">Stats temporarily unavailable.</p>
          ) : !stats ? (
            <p className="text-sm text-muted-foreground">Loading totals…</p>
          ) : (
            <div className="grid gap-5 md:grid-cols-4">
              <Stat
                label="Total cells indexed"
                value={stats.total_cells.toLocaleString()}
                accent
              />
              <Stat
                label="Past 24 hours"
                value={stats.cells_last_24h.toLocaleString()}
              />
              <Stat
                label="Past 7 days"
                value={stats.cells_last_7d.toLocaleString()}
              />
              <Stat
                label="Past 30 days"
                value={stats.cells_last_30d.toLocaleString()}
              />
              <Stat
                label="Peak hail recorded"
                value={`${stats.peak_hail_in.toFixed(2)}″`}
              />
              <Stat
                label="Earliest record"
                value={
                  stats.earliest
                    ? new Date(stats.earliest).toLocaleDateString(undefined, {
                        month: "short",
                        day: "2-digit",
                        year: "numeric",
                      })
                    : "—"
                }
              />
              <Stat
                label="Latest record"
                value={
                  stats.latest
                    ? new Date(stats.latest).toLocaleDateString(undefined, {
                        month: "short",
                        day: "2-digit",
                        year: "numeric",
                      })
                    : "—"
                }
              />
              <Stat
                label="Active pipelines"
                value={sourceEntries.length || 0}
                sub={sourceEntries.map(([k, v]) => `${k} ${v.toLocaleString()}`).join(" · ")}
              />
            </div>
          )}
        </div>
      </section>

      {/* Year-at-a-glance activity calendar */}
      <section className="bg-background">
        <div className="container py-12">
          <ActivityCalendar />
        </div>
      </section>

      {/* Daily activity bar chart */}
      <section className="bg-card border-t border-border">
        <div className="container py-12">
          <ActivityTimeline days={60} />
        </div>
      </section>

      {/* Top biggest events */}
      <section className="bg-background border-t border-border">
        <div className="container py-12">
          <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-copper">
            Hall of hail
          </p>
          <h2 className="mt-1 font-display text-3xl font-medium tracking-tight-display text-foreground md:text-4xl">
            Top 10 biggest cells · past year
          </h2>

          <ol className="mt-8 rounded-xl border border-border bg-card overflow-hidden divide-y divide-border/60">
            {biggest.length === 0 ? (
              <li className="px-6 py-10 text-center text-muted-foreground text-sm">
                Top events will appear as the backfill ingests historical
                MRMS data.
              </li>
            ) : (
              biggest.map((s, i) => {
                const c = hailColor(s.max_hail_size_in);
                const where = nearestMetro(s.centroid_lat, s.centroid_lng);
                const heavy = s.max_hail_size_in >= 1.5;
                return (
                  <li key={s.id}>
                    <Link
                      href={`/storm/${s.id}`}
                      className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-4 px-6 py-4 transition-colors hover:bg-secondary/30"
                    >
                      <span className="font-mono-num text-sm font-medium text-foreground/45 w-7">
                        {i + 1}
                      </span>
                      <span
                        className="inline-flex h-14 w-16 flex-col items-center justify-center rounded-md ring-1 ring-foreground/15 shadow-sm"
                        style={{ background: c.solid, color: heavy ? "#FAF7F1" : c.text }}
                      >
                        <span className="font-mono-num text-sm font-medium leading-none">
                          {s.max_hail_size_in.toFixed(2)}″
                        </span>
                        <span className="text-[9px] uppercase tracking-wide-caps font-mono leading-none mt-1 opacity-90">
                          {c.object}
                        </span>
                      </span>
                      <div className="min-w-0">
                        <p className="font-display text-lg font-medium tracking-tight-display text-foreground truncate">
                          {where?.label ?? "United States"}
                        </p>
                        <p className="mt-0.5 text-xs font-mono-num text-muted-foreground">
                          {new Date(s.start_time).toLocaleDateString(undefined, {
                            month: "short",
                            day: "2-digit",
                            year: "numeric",
                          })}{" "}
                          · {s.source}
                        </p>
                      </div>
                      <span className="font-mono-num text-[11px] uppercase tracking-wide-caps text-foreground/40">
                        See record →
                      </span>
                    </Link>
                  </li>
                );
              })
            )}
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-primary text-primary-foreground">
        <div className="container py-12 text-center md:py-16">
          <h2 className="font-display text-balance text-3xl font-medium tracking-tight-display md:text-4xl">
            Run these numbers against your customer list.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-primary-foreground/80">
            HailScout matches every saved address against every cell
            automatically — no manual lookups, no missed claim windows.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href="/sign-up" className="inline-flex items-center gap-2 rounded-md bg-copper px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-copper-700">
              Start your free trial <span aria-hidden>→</span>
            </Link>
            <Link href="/storms" className="inline-flex items-center gap-2 rounded-md border border-primary-foreground/20 bg-transparent px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary-foreground/10">
              Browse the catalog
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-5">
      <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-foreground/55">
        {label}
      </p>
      <p
        className={
          "mt-1 font-display text-3xl font-medium tracking-tight-display " +
          (accent ? "text-copper" : "text-foreground")
        }
      >
        {value}
      </p>
      {sub && (
        <p className="mt-2 text-[11px] font-mono-num text-muted-foreground truncate">
          {sub}
        </p>
      )}
    </div>
  );
}
