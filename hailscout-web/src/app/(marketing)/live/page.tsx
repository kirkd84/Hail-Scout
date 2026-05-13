"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-chrome";
import { StatTicker } from "@/components/marketing/stat-ticker";
import { ContourBg } from "@/components/brand/contour-bg";
import { useStorms, type StormWithSwaths } from "@/hooks/useStorms";
import { nearestMetro } from "@/lib/metros";
import { hailColor } from "@/lib/hail";
import { timeAgo } from "@/lib/time-ago";
import { cn } from "@/lib/utils";

/**
 * Public storm gallery — no auth required.
 *
 * Live MRMS-tracked cells + recent history, rendered with the same
 * nested-band SVG preview the /app/map uses internally. CTA on every
 * card sends prospects to /sign-up.
 *
 * Phase 16.8 migration: was hardcoded fixtures, now backed by
 * /v1/storms?include=swaths. The hook's `fallbackToFixtures` keeps
 * the gallery populated if the API returns empty (dev / pre-data
 * windows).
 */
export default function LiveStormsPage() {
  // Tick every 30s so "x mins ago" labels stay fresh
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const { storms, usingFallback } = useStorms({
    bbox: [-125, 24, -66, 50],
    from: useMemo(() => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - 30);
      return d.toISOString().slice(0, 10);
    }, []),
    to: useMemo(() => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + 1);
      return d.toISOString().slice(0, 10);
    }, []),
    limit: 200,
    includeSwaths: true,
    swathSimplify: 0.02,
    fallbackToFixtures: true,
  });

  // Live = started in the last 2 hours; recent = everything else,
  // newest first. Sort + bucket happen here (one pass) so the
  // sections render from the same source.
  const { live, recent } = useMemo(() => {
    const liveCutoff = Date.now() - 2 * 60 * 60 * 1000;
    const sorted = [...storms].sort(
      (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime(),
    );
    const live = sorted.filter(
      (s) => new Date(s.start_time).getTime() >= liveCutoff,
    );
    const recent = sorted
      .filter((s) => new Date(s.start_time).getTime() < liveCutoff)
      .slice(0, 12);
    return { live, recent };
  }, [storms]);

  return (
    <main className="bg-background text-foreground">
      <SiteHeader />
      <StatTicker />
      <Hero count={live.length} totalRecent={recent.length} fallback={usingFallback ?? false} />
      {live.length > 0 && (
        <Section title="Tracking right now" tone="copper" storms={live} live />
      )}
      <Section title="Recent storms · past 30 days" tone="muted" storms={recent} />
      <FinalCta />
      <SiteFooter />
    </main>
  );
}

function Hero({
  count,
  totalRecent,
  fallback,
}: {
  count: number;
  totalRecent: number;
  fallback: boolean;
}) {
  return (
    <section className="relative overflow-hidden bg-topo">
      <ContourBg className="opacity-90" density="sparse" />
      <div className="container relative pb-12 pt-16 md:pb-20 md:pt-24 text-center">
        <p className="font-mono-num text-xs uppercase tracking-wide-caps text-copper">
          {count > 0 ? (
            <span className="inline-flex items-center gap-2">
              <span className="relative inline-flex h-2 w-2">
                <span className="absolute inset-0 rounded-full bg-copper" />
                <span className="absolute inset-0 rounded-full bg-copper opacity-60 animate-ping" />
              </span>
              {count} cell{count === 1 ? "" : "s"} tracking right now
            </span>
          ) : (
            "Live storm tracker"
          )}
        </p>
        <h1 className="mx-auto mt-3 max-w-3xl font-display text-balance text-5xl font-medium leading-[1.05] tracking-tight-display text-foreground md:text-6xl">
          Every hailstorm, every day.
          <span className="block text-primary">Live from the atlas.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
          See what&apos;s happening in the U.S. hail belt right now — straight from the same NOAA MRMS feed our paying contractors trust.
          {totalRecent > 0 && ` Past 30 days: ${totalRecent} indexed cells.`}
          {fallback && (
            <span className="block text-[11px] text-foreground/40 mt-2 font-mono-num uppercase tracking-wide-caps">
              demo data · live feed reconnecting
            </span>
          )}
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/sign-up" className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-atlas transition-colors hover:bg-teal-900">
            Start your free trial <span aria-hidden>→</span>
          </Link>
          <Link href="/" className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-5 py-3 text-sm font-medium text-foreground hover:bg-muted">
            How HailScout works
          </Link>
        </div>
      </div>
    </section>
  );
}

function Section({
  title,
  tone,
  storms,
  live = false,
}: {
  title: string;
  tone: "copper" | "muted";
  storms: StormWithSwaths[];
  live?: boolean;
}) {
  return (
    <section className={cn(tone === "copper" ? "bg-card border-y border-border" : "bg-background")}>
      <div className="container py-16">
        <div className="flex items-baseline justify-between mb-8">
          <h2 className="font-display text-3xl font-medium tracking-tight-display text-foreground md:text-4xl">{title}</h2>
          <p className="font-mono-num text-xs uppercase tracking-wide-caps text-foreground/55">
            {storms.length} event{storms.length === 1 ? "" : "s"}
          </p>
        </div>
        {storms.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">
            No storms in this window.
          </p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {storms.map((s) => (
              <StormCard key={s.id} storm={s} live={live} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Project a (lng, lat) into the SVG card preview viewBox using the
 * storm's own bbox as the projection envelope. Adds a small padding
 * so polygons don't kiss the card edges.
 */
function makeProjector(storm: StormWithSwaths) {
  const cx = (storm.bbox.min_lng + storm.bbox.max_lng) / 2;
  const cy = (storm.bbox.min_lat + storm.bbox.max_lat) / 2;
  const halfW = Math.max(0.001, (storm.bbox.max_lng - storm.bbox.min_lng) / 2);
  const halfH = Math.max(0.001, (storm.bbox.max_lat - storm.bbox.min_lat) / 2);
  // 50, 28 are the viewBox center; 38, 22 are the half-extents with padding
  return (x: number, y: number) => [
    50 + ((x - cx) / halfW) * 38,
    28 - ((y - cy) / halfH) * 22,
  ];
}

function StormCard({ storm, live }: { storm: StormWithSwaths; live: boolean }) {
  const c = hailColor(storm.max_hail_size_in);
  const where = nearestMetro(storm.centroid_lat, storm.centroid_lng);
  const heavy = storm.max_hail_size_in >= 1.5;
  const badgeText = heavy ? "#FAF7F1" : c.text;

  // Build the SVG paths for each swath polygon. API swaths are
  // MultiPolygons of [outer ring, hole ring, ...]; we render just the
  // outer ring of each polygon since holes inside cells are rare and
  // the preview is small.
  const proj = makeProjector(storm);
  const bandPaths: Array<{ d: string; minSize: number }> = [];
  // Render smallest-hail tiers first so larger-hail cores stack on top
  const sortedSwaths = [...(storm.swaths ?? [])].sort(
    (a, b) => parseFloat(a.hail_size_category) - parseFloat(b.hail_size_category),
  );
  for (const sw of sortedSwaths) {
    if (!sw.geometry) continue;
    const minSize = parseFloat(sw.hail_size_category);
    for (const polygon of sw.geometry.coordinates) {
      const outerRing = polygon[0];
      if (!outerRing || outerRing.length < 3) continue;
      const d =
        "M " +
        outerRing
          .map(([lng, lat]) => proj(lng, lat).map((n) => n.toFixed(2)).join(","))
          .join(" L ") +
        " Z";
      bandPaths.push({ d, minSize });
    }
  }

  // Centroid in viewBox coordinates
  const [cxBox, cyBox] = proj(storm.centroid_lng, storm.centroid_lat);

  return (
    <article className="rounded-xl border border-border bg-card overflow-hidden shadow-atlas transition-shadow hover:shadow-atlas-lg">
      {/* Mini atlas plate */}
      <div className="relative aspect-[16/9] w-full overflow-hidden border-b border-border">
        <svg
          viewBox="0 0 100 56"
          preserveAspectRatio="none"
          className="h-full w-full"
          style={{ background: "hsl(var(--cream-50))" }}
        >
          {/* Topo contour lines for atlas feel */}
          <path d="M0,18 Q25,12 50,16 T100,12" fill="none" stroke="hsl(var(--teal-700))" strokeWidth="0.18" opacity="0.30" />
          <path d="M0,32 Q25,28 50,30 T100,26" fill="none" stroke="hsl(var(--teal-700))" strokeWidth="0.18" opacity="0.22" />
          <path d="M0,46 Q25,42 50,44 T100,40" fill="none" stroke="hsl(var(--teal-700))" strokeWidth="0.18" opacity="0.18" />
          {/* Swath polygons */}
          {bandPaths.map((p, i) => {
            const bc = hailColor(p.minSize);
            const opacity = Math.min(0.85, 0.30 + i * 0.04);
            return (
              <path
                key={i}
                d={p.d}
                fill={bc.solid}
                fillOpacity={opacity}
                stroke={bc.stroke}
                strokeWidth="0.25"
                strokeOpacity="0.65"
              />
            );
          })}
          {/* Centroid dot */}
          <circle cx={cxBox} cy={cyBox} r="1.6" fill="none" stroke={c.solid} strokeWidth="0.5" opacity="0.65" />
          <circle cx={cxBox} cy={cyBox} r="0.8" fill={c.solid} />
        </svg>
        {live && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-copper px-2.5 py-1 text-[10px] font-mono uppercase tracking-wide-caps text-primary-foreground">
            <span className="relative inline-flex h-1.5 w-1.5">
              <span className="absolute inset-0 rounded-full bg-primary-foreground" />
              <span className="absolute inset-0 rounded-full bg-primary-foreground opacity-60 animate-ping" />
            </span>
            Live
          </span>
        )}
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-card/85 px-2 py-1 text-[9px] font-mono uppercase tracking-wide-caps text-foreground/70 backdrop-blur">
          {storm.source}
        </span>
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            <p className="font-display text-xl font-medium tracking-tight-display text-foreground truncate">
              {where?.label ?? "United States"}
              {where && where.miles >= 5 && where.miles <= 250 && (
                <span className="font-mono-num text-xs font-normal text-muted-foreground/70 ml-1">
                  · {where.miles}mi
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground font-mono-num">
              {timeAgo(storm.start_time)} ·{" "}
              {new Date(storm.start_time).toLocaleDateString(undefined, {
                month: "short",
                day: "2-digit",
                year: "numeric",
              })}
            </p>
          </div>
          <span
            className="inline-flex h-12 w-14 shrink-0 flex-col items-center justify-center rounded-md ring-1 ring-foreground/15 shadow-sm"
            style={{ background: c.solid, color: badgeText }}
          >
            <span className="font-mono-num text-sm font-medium leading-none">
              {storm.max_hail_size_in.toFixed(2)}″
            </span>
            <span className="text-[9px] uppercase tracking-wide-caps font-mono leading-none mt-0.5 opacity-90">
              {c.object}
            </span>
          </span>
        </div>
        <p className="text-sm text-foreground/85 leading-relaxed">
          {describeStorm(storm, where?.label)}
        </p>
        <Link
          href={`/storm/${storm.id}`}
          className="mt-4 inline-flex items-center gap-1 text-xs font-mono uppercase tracking-wide-caps text-copper hover:text-copper-700"
        >
          See storm details <span aria-hidden>→</span>
        </Link>
      </div>
    </article>
  );
}

/**
 * Cheap, deterministic, no-LLM storm description. Pulled out so the
 * storm/[id] page can reuse it.
 */
function describeStorm(storm: StormWithSwaths, locationLabel?: string): string {
  const peak = storm.max_hail_size_in;
  const obj = hailColor(peak).object.toLowerCase();
  const where = locationLabel ?? "the region";
  const startedAt = new Date(storm.start_time);
  const dur =
    new Date(storm.end_time).getTime() - startedAt.getTime();
  const hours = Math.round(dur / (60 * 60 * 1000));
  const swathCount = storm.swaths?.length ?? 0;
  const hourPhrase = hours > 1 ? `Tracked across ${hours} hours.` : "";
  const categoryPhrase =
    swathCount > 0 ? ` ${swathCount} hail-size band${swathCount === 1 ? "" : "s"} mapped.` : "";
  if (peak >= 2.0) {
    return `${peak.toFixed(2)}″ ${obj}-size hail confirmed near ${where}. Damaging-hail track — major roof claim risk inside the footprint. ${hourPhrase}${categoryPhrase}`;
  }
  if (peak >= 1.0) {
    return `${peak.toFixed(2)}″ ${obj}-size hail near ${where}. Surface damage probable on lighter roof materials. ${hourPhrase}${categoryPhrase}`;
  }
  return `${peak.toFixed(2)}″ hail near ${where}. ${hourPhrase || "Brief event."}${categoryPhrase}`;
}

function FinalCta() {
  return (
    <section className="border-t border-border bg-primary text-primary-foreground">
      <div className="container py-16 text-center md:py-20">
        <h2 className="font-display text-balance text-3xl font-medium tracking-tight-display md:text-4xl">
          Want every storm on every address you care about?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-primary-foreground/80">
          Save your customers, get alerted instantly, generate Hail Impact Reports for any address. $899/yr nationwide.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link href="/sign-up" className="inline-flex items-center gap-2 rounded-md bg-copper px-5 py-3 text-sm font-medium text-primary-foreground shadow-atlas-lg hover:bg-copper-700">
            Start your free trial <span aria-hidden>→</span>
          </Link>
          <Link href="/pricing" className="inline-flex items-center gap-2 rounded-md border border-primary-foreground/20 bg-transparent px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary-foreground/10">
            See pricing
          </Link>
        </div>
      </div>
    </section>
  );
}
