"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { apiClient } from "@/lib/api";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-chrome";
import { ContourBg } from "@/components/brand/contour-bg";
import { CtaBand, SectionHeading } from "@/components/marketing/primitives";
import { hailColor } from "@/lib/hail";
import { nearestMetro } from "@/lib/metros";
import { useStorms } from "@/hooks/useStorms";
import { ActivityTimeline } from "@/components/marketing/activity-timeline";
import { ActivityCalendar } from "@/components/marketing/activity-calendar";
import { SizeDistribution } from "@/components/marketing/size-distribution";
import { TopMetros } from "@/components/marketing/top-metros";

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
 * /v1/storms?limit=10&order=peak for the top-cells list. Everything
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
      <section className="relative overflow-hidden">
        <ContourBg className="opacity-80" density="sparse" />
        <div className="container relative max-w-6xl pb-10 pt-16 md:pb-12 md:pt-20">
          <p className="eyebrow">By the numbers · public</p>
          <h1 className="display-1 mt-3 text-foreground">
            Every hailstorm, accounted for.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-[1.65] text-muted-foreground text-pretty">
            Hail GPS indexes every hail cell it detects across the continental
            U.S., straight from NOAA radar. Here&apos;s what the map looks like
            right now — live numbers, not marketing numbers.
          </p>
        </div>
      </section>

      {/* KPI grid */}
      <section className="border-y border-border bg-secondary/40 bg-graticule">
        <div className="container max-w-6xl py-12 md:py-16">
          {statsErr ? (
            <p className="font-mono text-sm uppercase tracking-wide-caps text-muted-foreground">
              Stats temporarily unavailable.
            </p>
          ) : !stats ? (
            <p className="font-mono text-sm uppercase tracking-wide-caps text-muted-foreground">
              Loading totals…
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
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
                value={String(sourceEntries.length || 0)}
                sub={sourceEntries.map(([k, v]) => `${k} ${v.toLocaleString()}`).join(" · ")}
              />
            </div>
          )}
        </div>
      </section>

      {/* Year-at-a-glance activity calendar */}
      <section className="bg-background">
        <div className="container max-w-6xl py-12 md:py-16">
          <ActivityCalendar />
        </div>
      </section>

      {/* Daily activity bar chart + size distribution */}
      <section className="border-y border-border bg-secondary/40">
        <div className="container grid max-w-6xl gap-8 py-12 md:py-16 lg:grid-cols-2">
          <ActivityTimeline days={60} />
          <SizeDistribution />
        </div>
      </section>

      {/* Top metros */}
      <section className="bg-background">
        <div className="container max-w-6xl py-12 md:py-16">
          <TopMetros />
        </div>
      </section>

      {/* Top biggest events */}
      <section className="border-t border-border bg-secondary/40">
        <div className="container max-w-6xl py-24 md:py-32">
          <SectionHeading
            eyebrow="Hall of hail"
            title="Top 10 biggest cells · past year"
          />

          <div className="mt-12">
            {biggest.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-10 text-center">
                <p className="font-mono text-[11px] uppercase tracking-wide-caps text-foreground/45">
                  No records yet
                </p>
                <p className="mt-3 text-muted-foreground">
                  Top events will appear as historical radar data is ingested.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border bg-card">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <Th>#</Th>
                      <Th>Size</Th>
                      <Th>Location</Th>
                      <Th className="text-right">Date</Th>
                      <Th className="text-right">Source</Th>
                      <Th className="text-right">
                        <span className="sr-only">Record</span>
                      </Th>
                    </tr>
                  </thead>
                  <tbody>
                    {biggest.map((s, i) => {
                      const c = hailColor(s.max_hail_size_in);
                      const where = nearestMetro(s.centroid_lat, s.centroid_lng);
                      const heavy = s.max_hail_size_in >= 1.5;
                      return (
                        <tr
                          key={s.id}
                          className="border-b border-border/60 transition-colors last:border-0 hover:bg-secondary/40"
                        >
                          <td className="px-5 py-3 font-mono-num text-sm font-medium tabular-nums text-foreground/45">
                            {String(i + 1).padStart(2, "0")}
                          </td>
                          <td className="px-5 py-3">
                            <span
                              className="inline-flex h-11 w-14 flex-col items-center justify-center rounded-md shadow-sm ring-1 ring-foreground/15"
                              style={{ background: c.solid, color: heavy ? "#FAF7F1" : c.text }}
                            >
                              <span className="font-mono-num text-sm font-medium leading-none tabular-nums">
                                {s.max_hail_size_in.toFixed(2)}″
                              </span>
                              <span className="mt-0.5 font-mono text-[8px] uppercase leading-none tracking-wide-caps opacity-90">
                                {c.object}
                              </span>
                            </span>
                          </td>
                          <td className="max-w-[240px] px-5 py-3">
                            <p className="truncate font-medium text-foreground">
                              {where?.label ?? "United States"}
                            </p>
                          </td>
                          <td className="px-5 py-3 text-right font-mono-num text-xs tabular-nums text-muted-foreground">
                            {new Date(s.start_time).toLocaleDateString(undefined, {
                              month: "short",
                              day: "2-digit",
                              year: "numeric",
                            })}
                          </td>
                          <td className="px-5 py-3 text-right font-mono text-xs uppercase tracking-wide-caps text-foreground/55">
                            {s.source}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <Link
                              href={`/storm/${s.id}`}
                              className="inline-flex min-h-11 items-center gap-1 whitespace-nowrap text-sm font-medium text-primary underline-offset-4 hover:underline"
                            >
                              Open <span aria-hidden>→</span>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>

      <CtaBand
        title="Run these numbers against your customer list."
        lede="Hail GPS matches every saved address against every cell automatically — no manual lookups, no missed claim windows."
        primary={{ label: "Request access", href: "/request-access" }}
        secondary={{ label: "Browse the catalog", href: "/storms" }}
      />

      <SiteFooter />
    </main>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={
        "px-5 py-3 font-mono text-[10px] font-medium uppercase tracking-wide-caps text-foreground/55 " +
        (className ?? "")
      }
    >
      {children}
    </th>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="font-mono text-[10px] uppercase tracking-wide-caps text-foreground/55">
        {label}
      </p>
      <p
        className={
          "mt-2 font-mono-num text-2xl font-medium tabular-nums md:text-3xl " +
          (accent ? "text-primary" : "text-foreground")
        }
      >
        {value}
      </p>
      {sub && (
        <p className="mt-2 truncate font-mono-num text-[11px] tabular-nums text-muted-foreground">
          {sub}
        </p>
      )}
    </div>
  );
}
