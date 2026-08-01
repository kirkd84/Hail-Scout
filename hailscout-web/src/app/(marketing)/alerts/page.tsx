"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-chrome";
import { SectionHeading, MarketingCard, CtaBand } from "@/components/marketing/primitives";
import { ContourBg } from "@/components/brand/contour-bg";
import { useStorms } from "@/hooks/useStorms";
import { apiClient } from "@/lib/api";
import { hailColor } from "@/lib/hail";
import { nearestMetro } from "@/lib/metros";
import { timeAgo } from "@/lib/time-ago";

/**
 * /alerts — the alert flow, sold with live proof.
 *
 * Two real capabilities, in plain language:
 *   1. Storm alerts — a tracked hail cell touches a saved address or
 *      alert zone → email / text / Slack / phone notification.
 *   2. The morning heads-up (NEW) — daily hail-probability outlook
 *      notifications when hail is forecast for your saved territory.
 *
 * Live proof on the page, honestly framed:
 *   - Today's real SPC hail outlook via /v1/outlook/hail?day=1, with an
 *     honest quiet state ("No hail risk mapped today") and an honest
 *     error state (never "all clear" when the feed is unreachable).
 *   - The public last-24h feed of tracked cells via /v1/storms.
 */
export default function AlertsPage() {
  return (
    <main className="bg-background text-foreground">
      <SiteHeader />
      <Hero />
      <MorningHeadsUp />
      <AlertFlow />
      <LiveFeed />
      <CtaBand
        title="Put your territory on watch."
        lede="Request access, save the addresses and areas you care about, and let the map do the watching."
        primary={{ label: "Request access", href: "/request-access" }}
        secondary={{ label: "Browse the storm catalog", href: "/storms" }}
      />
      <SiteFooter />
    </main>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border/60">
      <ContourBg density="sparse" className="opacity-60" />
      <div className="container relative max-w-6xl pb-16 pt-20 md:pb-20 md:pt-28">
        <p className="eyebrow">Alerts</p>
        <h1 className="display-1 mt-4 max-w-3xl text-foreground">
          A heads-up in the morning.
          <span className="block text-primary">A ping when it lands.</span>
        </h1>
        <p className="mt-5 max-w-prose text-base leading-[1.65] text-muted-foreground">
          Save the addresses and areas you care about. Hail GPS tells you when
          hail is forecast for them — and again, within minutes, when a storm
          actually touches them.
        </p>
      </div>
    </section>
  );
}

// ---- Morning heads-up (daily outlook notifications) ----

interface OutlookRow {
  id: string;
  day: number;
  kind: string;
  probability: number;
  label: string | null;
  valid_from: string;
  valid_to: string;
}

interface OutlooksResponse {
  outlooks: OutlookRow[];
}

function MorningHeadsUp() {
  return (
    <section className="border-b border-border bg-secondary/40 py-24 md:py-32">
      <div className="container max-w-6xl">
        <div className="grid items-start gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading
              eyebrow="New · The morning heads-up"
              title="Know it's a hail day before it fires."
              lede="Every morning we check the national hail forecast against your saved territory. If hail is forecast for your area, you get a heads-up by email or phone notification — while there's still time to plan the day around it."
            />
            <ul className="mt-8 space-y-4">
              {[
                ["Only when the odds are real.", "We gate the heads-up on the forecast probability — nobody gets woken up over a long shot."],
                ["Uses the zones you already set.", "The same saved addresses and alert areas that drive your storm alerts. Nothing to configure twice."],
                ["From the people who forecast severe weather.", "The outlook comes from the NWS Storm Prediction Center — we fetch it, map it, and match it to your territory."],
              ].map(([title, body]) => (
                <li key={title} className="flex items-start gap-4">
                  <span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                  <div>
                    <p className="font-semibold text-foreground">{title}</p>
                    <p className="mt-0.5 max-w-prose text-sm leading-relaxed text-muted-foreground">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <TodaysOutlookPlate />
        </div>
      </div>
    </section>
  );
}

/** Live day-1 outlook readout. Honest in all three states. */
function TodaysOutlookPlate() {
  const { data, error, isLoading } = useSWR<OutlooksResponse>(
    "/v1/outlook/hail?day=1",
    (url: string) => apiClient.get<OutlooksResponse>(url),
    { revalidateOnFocus: false, dedupingInterval: 300_000, shouldRetryOnError: false },
  );

  const strongest = useMemo(() => {
    const rows = (data?.outlooks ?? []).filter((o) => o.kind === "hail");
    if (rows.length === 0) return null;
    return rows.reduce((a, b) => (b.probability > a.probability ? b : a));
  }, [data]);

  return (
    <MarketingCard elevated className="p-7">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Today&apos;s hail outlook
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
          Live · Storm Prediction Center
        </p>
      </div>

      {isLoading ? (
        <p className="mt-8 text-sm text-muted-foreground">Checking today&apos;s outlook…</p>
      ) : error ? (
        <div className="mt-8">
          <p className="text-lg font-semibold text-foreground">Outlook feed unreachable right now.</p>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
            We won&apos;t guess — check back in a minute, or see the live map
            for what&apos;s tracking.
          </p>
        </div>
      ) : strongest ? (
        <div className="mt-6">
          <div className="flex items-baseline gap-3">
            <span className="font-mono-num text-6xl font-semibold tabular-nums text-primary">
              {strongest.label ?? `${Math.round(strongest.probability * 100)}%`}
            </span>
            <span className="text-sm text-muted-foreground">strongest area today</span>
          </div>
          <p className="mt-4 max-w-prose text-sm leading-[1.65] text-muted-foreground">
            Hail is in today&apos;s forecast. Inside the strongest outlook
            area, that&apos;s a{" "}
            {strongest.label ?? `${Math.round(strongest.probability * 100)}%`} chance of
            hail within 25 miles of any given spot. Crews with saved territory
            under an area like this got the morning heads-up.
          </p>
          <p className="mt-4 font-mono-num text-xs tabular-nums text-muted-foreground/70">
            Valid until{" "}
            {new Date(strongest.valid_to).toLocaleString(undefined, {
              weekday: "short",
              hour: "numeric",
              minute: "2-digit",
              timeZoneName: "short",
            })}
          </p>
        </div>
      ) : (
        <div className="mt-8">
          <p className="text-lg font-semibold text-foreground">No hail risk mapped today.</p>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
            When the Storm Prediction Center draws a hail area, it shows up
            here — and lands in your inbox if it touches your territory.
          </p>
        </div>
      )}

      <div className="mt-8 border-t border-border/60 pt-4">
        <Link
          href="/live"
          className="inline-flex min-h-11 items-center font-mono text-[11px] uppercase tracking-[0.14em] text-primary hover:text-copper-700"
        >
          See what&apos;s tracking live <span className="ml-2" aria-hidden>→</span>
        </Link>
      </div>
    </MarketingCard>
  );
}

// ---- Storm alert flow ----

const FLOW_STEPS: { n: string; title: string; body: string }[] = [
  {
    n: "01",
    title: "Save what you care about",
    body: "Your customer list, a radius around town, whole states — or the entire country. Set a minimum hail size so small stuff stays quiet.",
  },
  {
    n: "02",
    title: "We watch the map around the clock",
    body: "New hail data lands about every two minutes during a storm, checked against every address and area you've saved.",
  },
  {
    n: "03",
    title: "You get pinged when it lands",
    body: "Email, text, Slack, or a notification on your phone — with the hail size and a link straight to the swath on the map.",
  },
];

function AlertFlow() {
  return (
    <section className="py-24 md:py-32">
      <div className="container max-w-6xl">
        <SectionHeading
          eyebrow="Storm alerts"
          title="From radar sweep to your pocket, in minutes."
          lede="No refreshing the map all afternoon. Set it up once and the storm finds you."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {FLOW_STEPS.map((s) => (
            <MarketingCard key={s.n} className="p-7">
              <p className="font-mono-num text-xs tabular-nums text-primary">{s.n}</p>
              <h3 className="mt-3 text-xl font-semibold text-foreground">{s.title}</h3>
              <p className="mt-2 text-sm leading-[1.65] text-muted-foreground">{s.body}</p>
            </MarketingCard>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---- Live feed: the last 24 hours, nationwide ----

function LiveFeed() {
  // Re-render every 10s so "x min ago" stays honest between refreshes.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  const from = useMemo(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  }, []);
  const to = useMemo(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  }, []);

  const { storms, refresh } = useStorms({
    bbox: [-125, 24, -66, 50],
    from,
    to,
    limit: 50,
    fallbackToFixtures: true,
  });

  // Hard refresh every 60s so the feed stays current while the tab is open.
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
    <section className="border-t border-border bg-secondary/40 py-24 md:py-32">
      <div className="container max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading
            eyebrow="Live proof"
            title="What just hit."
            lede="The public feed — every cell Hail GPS has tracked in the past 24 hours, nationwide, newest first. This is the same data your alerts run on."
          />
          <p className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            <span className="relative inline-flex h-2 w-2" aria-hidden>
              <span className="absolute inset-0 rounded-full bg-primary" />
              {liveCount > 0 && (
                <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-60" />
              )}
            </span>
            {liveCount > 0 ? `${liveCount} still tracking` : "Refreshes every 60s"}
          </p>
        </div>

        <div className="mt-12">
          {sorted.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-10 text-center">
              <p className="text-xl font-semibold text-foreground">All quiet.</p>
              <p className="mx-auto mt-2 max-w-prose text-sm text-muted-foreground">
                No cells tracked in the past 24 hours. When hail fires anywhere
                in the country, it streams here.
              </p>
            </div>
          ) : (
            <ol className="overflow-hidden rounded-xl border border-border bg-card">
              {sorted.map((s, i) => {
                const c = hailColor(s.max_hail_size_in);
                const where = nearestMetro(s.centroid_lat, s.centroid_lng);
                const heavy = s.max_hail_size_in >= 1.5;
                const isLive = Date.now() - new Date(s.start_time).getTime() < 2 * 60 * 60 * 1000;
                return (
                  <li key={s.id} className={i > 0 ? "border-t border-border/60" : undefined}>
                    <Link
                      href={`/storm/${s.id}`}
                      className="grid grid-cols-[auto_1fr_auto] items-center gap-x-4 px-4 py-3.5 transition-colors hover:bg-secondary/40 sm:grid-cols-[4rem_auto_1fr_auto] sm:px-5"
                    >
                      <span className="hidden text-right font-mono-num text-[11px] tabular-nums text-muted-foreground sm:block">
                        {timeAgo(s.start_time)}
                      </span>
                      <span
                        className="relative inline-flex h-11 w-14 flex-col items-center justify-center rounded-md ring-1 ring-foreground/15"
                        style={{ background: c.solid, color: heavy ? "#FAF7F1" : c.text }}
                      >
                        {isLive && (
                          <span className="absolute -right-1 -top-1 inline-flex h-2 w-2" aria-hidden>
                            <span className="absolute inset-0 rounded-full bg-primary" />
                            <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-60" />
                          </span>
                        )}
                        <span className="font-mono-num text-xs font-medium leading-none tabular-nums">
                          {s.max_hail_size_in.toFixed(2)}″
                        </span>
                        <span className="mt-0.5 font-mono text-[8px] uppercase leading-none tracking-[0.12em] opacity-90">
                          {c.object}
                        </span>
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-base font-medium text-foreground">
                          {where?.label ?? "United States"}
                          {where && where.miles >= 5 && where.miles <= 250 && (
                            <span className="ml-1 font-mono-num text-xs font-normal tabular-nums text-muted-foreground/70">
                              · {where.miles}mi
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 font-mono-num text-xs tabular-nums text-muted-foreground">
                          <span className="sm:hidden">{timeAgo(s.start_time)} · </span>
                          {new Date(s.start_time).toLocaleTimeString(undefined, {
                            hour: "numeric",
                            minute: "2-digit",
                            timeZoneName: "short",
                          })}{" "}
                          · {s.source}
                        </p>
                      </div>
                      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground/70">
                        <span className="hidden sm:inline">See record </span>
                        <span aria-hidden>→</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}
