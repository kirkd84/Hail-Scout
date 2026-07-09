"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-chrome";
import { ContourBg } from "@/components/brand/contour-bg";
import { useStorms } from "@/hooks/useStorms";
import { hailColor } from "@/lib/hail";
import { nearestMetro } from "@/lib/metros";
import { timeAgo } from "@/lib/time-ago";

/**
 * Public live alerts stream.
 *
 * Continuous feed of recently-tracked cells, auto-refreshing.
 * Distinct from /live (curated grid of cards) — /alerts is the
 * chronological "what just landed" view. Designed for monitoring
 * and embedding (open as iframe or as a tab).
 */
export default function AlertsPage() {
  // Tick every 10s so timestamps stay fresh and SWR can revalidate
  // via its dedupingInterval. Hook itself doesn't auto-poll the API,
  // but a focus-revalidate kicks in on tab focus.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  const from = useMemo(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 1); // last 24h window
    return d.toISOString().slice(0, 10);
  }, []);
  const to = useMemo(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  }, []);

  // SWR's dedupingInterval (60s in useStorms) means a tab focus or
  // user interaction triggers a refresh on the next render. The
  // 10-second `tick` re-renders so "x sec ago" stays accurate.
  const { storms, refresh } = useStorms({
    bbox: [-125, 24, -66, 50],
    from,
    to,
    limit: 50,
    fallbackToFixtures: true,
  });

  // Force a hard refresh every 60s
  useEffect(() => {
    const id = setInterval(() => refresh?.(), 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  const sorted = useMemo(
    () =>
      [...storms].sort(
        (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime(),
      ),
    [storms],
  );

  const liveCutoff = Date.now() - 2 * 60 * 60 * 1000;
  const liveCount = sorted.filter(
    (s) => new Date(s.start_time).getTime() >= liveCutoff,
  ).length;

  return (
    <main className="bg-background text-foreground">
      <SiteHeader />

      <section className="relative overflow-hidden bg-topo">
        <ContourBg className="opacity-90" density="sparse" />
        <div className="container relative pb-8 pt-12 md:pb-10 md:pt-16">
          <div className="flex items-baseline justify-between flex-wrap gap-4">
            <div>
              <p className="font-mono-num text-xs uppercase tracking-wide-caps text-copper inline-flex items-center gap-2">
                <span className="relative inline-flex h-2 w-2">
                  <span className="absolute inset-0 rounded-full bg-copper" />
                  <span className="absolute inset-0 rounded-full bg-copper opacity-60 animate-ping" />
                </span>
                Live alerts · public
              </p>
              <h1 className="mt-2 font-display text-balance text-5xl font-medium leading-[1.05] tracking-tight-display text-foreground md:text-6xl">
                What just hit.
              </h1>
              <p className="mt-3 max-w-2xl text-base text-muted-foreground">
                Auto-refreshing feed of every cell HailScout has tracked
                in the past 24 hours. Sorted newest first.
                {liveCount > 0 && (
                  <span className="block mt-1 text-copper font-medium">
                    {liveCount} cell{liveCount === 1 ? "" : "s"} still tracking right now.
                  </span>
                )}
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-foreground/45">
                Refresh
              </p>
              <p className="font-mono-num text-xs text-foreground/70">
                every 60s · last tick {tick}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-background">
        <div className="container py-8">
          {sorted.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-10 text-center">
              <p className="font-display text-2xl text-foreground">
                All quiet.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                No cells tracked in the past 24 hours. As the pipeline
                ingests, alerts will stream here.
              </p>
            </div>
          ) : (
            <ol className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border/60">
              {sorted.map((s) => {
                const c = hailColor(s.max_hail_size_in);
                const where = nearestMetro(s.centroid_lat, s.centroid_lng);
                const heavy = s.max_hail_size_in >= 1.5;
                const ageMs = Date.now() - new Date(s.start_time).getTime();
                const isLive = ageMs < 2 * 60 * 60 * 1000;
                return (
                  <li key={s.id}>
                    <Link
                      href={`/storm/${s.id}`}
                      className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-4 px-5 py-4 transition-colors hover:bg-secondary/30"
                    >
                      <span className="font-mono-num text-[10px] uppercase tracking-wide-caps text-foreground/45 w-20 text-right">
                        {timeAgo(s.start_time)}
                      </span>
                      <span
                        className="inline-flex h-11 w-14 flex-col items-center justify-center rounded-md ring-1 ring-foreground/15 shadow-sm relative"
                        style={{ background: c.solid, color: heavy ? "#FAF7F1" : c.text }}
                      >
                        {isLive && (
                          <span className="absolute -top-1 -right-1 inline-flex h-2 w-2">
                            <span className="absolute inset-0 rounded-full bg-copper" />
                            <span className="absolute inset-0 rounded-full bg-copper opacity-60 animate-ping" />
                          </span>
                        )}
                        <span className="font-mono-num text-xs font-medium leading-none">
                          {s.max_hail_size_in.toFixed(2)}″
                        </span>
                        <span className="text-[8px] uppercase tracking-wide-caps font-mono leading-none mt-0.5 opacity-90">
                          {c.object}
                        </span>
                      </span>
                      <div className="min-w-0">
                        <p className="font-display text-base font-medium tracking-tight-display text-foreground truncate">
                          {where?.label ?? "United States"}
                          {where && where.miles >= 5 && where.miles <= 250 && (
                            <span className="font-mono-num text-xs font-normal text-muted-foreground/70 ml-1">
                              · {where.miles}mi
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 text-xs font-mono-num text-muted-foreground">
                          {new Date(s.start_time).toLocaleTimeString(undefined, {
                            hour: "numeric",
                            minute: "2-digit",
                            timeZoneName: "short",
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
              })}
            </ol>
          )}
        </div>
      </section>

      <section className="border-t border-border bg-primary text-primary-foreground">
        <div className="container py-12 text-center md:py-16">
          <h2 className="font-display text-balance text-3xl font-medium tracking-tight-display md:text-4xl">
            Get this stream as alerts on your saved addresses.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-primary-foreground/80">
            Every cell that touches an address you&apos;re monitoring
            triggers an email + Slack ping in seconds.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/request-access"
              className="inline-flex items-center gap-2 rounded-md bg-copper px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-copper-700"
            >
              Request access <span aria-hidden>→</span>
            </Link>
            <Link
              href="/storms"
              className="inline-flex items-center gap-2 rounded-md border border-primary-foreground/20 bg-transparent px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary-foreground/10"
            >
              Storm catalog
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
