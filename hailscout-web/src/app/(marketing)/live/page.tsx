"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-chrome";
import { StatTicker } from "@/components/marketing/stat-ticker";
import { ContourBg } from "@/components/brand/contour-bg";
import { CtaBand } from "@/components/marketing/primitives";
import { useStorms, type StormWithSwaths } from "@/hooks/useStorms";
import { nearestMetro } from "@/lib/metros";
import { hailColor, HAIL_LEGEND } from "@/lib/hail";
import { timeAgo } from "@/lib/time-ago";
import { cn } from "@/lib/utils";

/**
 * Public storm gallery — no auth required.
 *
 * Live MRMS-tracked cells + recent history, rendered as dark
 * product-map plates (same visual language as /app/map). CTA on
 * every card sends prospects to the storm record; page CTA is
 * request-access.
 *
 * Phase 16.8 migration: was hardcoded fixtures, now backed by
 * /v1/storms?include=swaths. The hook's `fallbackToFixtures` keeps
 * the gallery populated ONLY behind the explicit demo env flag —
 * production shows honest empties.
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
  const { live, recent, latestStart } = useMemo(() => {
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
    return { live, recent, latestStart: sorted[0]?.start_time ?? null };
  }, [storms]);

  return (
    <main className="bg-background text-foreground">
      <SiteHeader />
      <StatTicker />
      <Hero
        count={live.length}
        latestStart={latestStart}
        totalIndexed={storms.length}
        fallback={usingFallback ?? false}
      />
      <LegendBar />
      {live.length > 0 && (
        <Section
          eyebrow="Live"
          title="Tracking right now"
          storms={live}
          live
          ground="secondary"
        />
      )}
      <Section
        eyebrow="Archive"
        title="Recent storms · past 30 days"
        storms={recent}
        ground={live.length > 0 ? "base" : "secondary"}
      />
      <CtaBand
        title="Every storm, on every address you care about."
        lede="Save your customer list, get alerted the moment a swath crosses an address, and generate a hail impact report you can hand to an adjuster."
        primary={{ label: "Request access", href: "/request-access" }}
        secondary={{ label: "How Hail GPS works", href: "/" }}
      />
      <SiteFooter />
    </main>
  );
}

function Hero({
  count,
  latestStart,
  totalIndexed,
  fallback,
}: {
  count: number;
  latestStart: string | null;
  totalIndexed: number;
  fallback: boolean;
}) {
  return (
    <section className="relative overflow-hidden">
      <ContourBg className="opacity-80" density="sparse" />
      <div className="container relative max-w-6xl pb-12 pt-16 text-center md:pb-16 md:pt-24">
        <p className="eyebrow inline-flex items-center justify-center gap-2">
          {count > 0 ? (
            <>
              <span className="relative inline-flex h-2 w-2">
                <span className="absolute inset-0 rounded-full bg-primary" />
                <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-60" />
              </span>
              <span>
                Live · {count} cell{count === 1 ? "" : "s"} tracking
                {latestStart ? ` · latest ${timeAgo(latestStart)}` : ""}
              </span>
            </>
          ) : (
            "Live storm tracker"
          )}
        </p>
        <h1 className="display-1 mx-auto mt-4 max-w-3xl text-foreground">
          Every hailstorm, every day.
          <span className="block text-primary">Live from the map.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-[1.65] text-muted-foreground text-pretty">
          What&apos;s happening in the U.S. hail belt right now — straight from
          the same NOAA radar feed the product runs on.
          {totalIndexed > 0 && (
            <span className="font-mono-num tabular-nums">
              {" "}Past 30 days: {totalIndexed} indexed cells.
            </span>
          )}
        </p>
        {fallback && (
          <p className="mx-auto mt-3 font-mono text-[11px] uppercase tracking-wide-caps text-foreground/40">
            demo data · live feed reconnecting
          </p>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/request-access"
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-copper-700"
          >
            Request access <span aria-hidden>→</span>
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-5 text-sm font-medium text-foreground transition-colors hover:bg-card"
          >
            How Hail GPS works
          </Link>
        </div>
      </div>
    </section>
  );
}

/**
 * Instrument legend — the real hail-size scale, in data color.
 * Non-interactive chips; scrolls in its own container on small
 * screens so the page never scrolls sideways.
 */
function LegendBar() {
  return (
    <div className="border-y border-border bg-secondary/40">
      <div className="container flex max-w-6xl items-center gap-3 overflow-x-auto py-3">
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide-caps text-foreground/55">
          Hail size scale
        </span>
        <div className="flex items-center gap-1.5">
          {HAIL_LEGEND.map((b) => (
            <span
              key={b.short}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1"
              title={b.label}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: b.solid }}
                aria-hidden
              />
              <span className="font-mono-num text-[10px] tabular-nums text-foreground/75">
                {b.short}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Section({
  eyebrow,
  title,
  storms,
  live = false,
  ground,
}: {
  eyebrow: string;
  title: string;
  storms: StormWithSwaths[];
  live?: boolean;
  ground: "base" | "secondary";
}) {
  return (
    <section
      className={cn(
        ground === "secondary" ? "border-b border-border bg-secondary/40" : "bg-background",
      )}
    >
      <div className="container max-w-6xl py-24 md:py-32">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2 className="display-2 mt-3 text-foreground">{title}</h2>
          </div>
          <p className="font-mono-num text-[11px] uppercase tracking-wide-caps tabular-nums text-foreground/55">
            {storms.length} event{storms.length === 1 ? "" : "s"}
          </p>
        </div>
        {storms.length === 0 ? (
          <div className="mt-12 rounded-xl border border-border bg-card p-10 text-center">
            <p className="font-mono text-[11px] uppercase tracking-wide-caps text-foreground/45">
              All quiet
            </p>
            <p className="mt-3 text-muted-foreground">
              No storms in this window. When hail falls, it shows up here
              within minutes.
            </p>
          </div>
        ) : (
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
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
    <article className="overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-panel">
      {/* Mini map plate — dark ground like the product map, both modes */}
      <div className="relative aspect-[16/9] w-full overflow-hidden border-b border-border">
        <svg
          viewBox="0 0 100 56"
          preserveAspectRatio="none"
          className="h-full w-full"
          style={{ background: "hsl(var(--teal-900))" }}
        >
          {/* Faint graticule — quiet lat/long grid */}
          {[14, 28, 42].map((y) => (
            <line key={`h${y}`} x1="0" y1={y} x2="100" y2={y} stroke="hsl(var(--cream-50))" strokeOpacity="0.07" strokeWidth="0.18" />
          ))}
          {[20, 40, 60, 80].map((x) => (
            <line key={`v${x}`} x1={x} y1="0" x2={x} y2="56" stroke="hsl(var(--cream-50))" strokeOpacity="0.07" strokeWidth="0.18" />
          ))}
          {/* Swath polygons — real data, real ramp */}
          {bandPaths.map((p, i) => {
            const bc = hailColor(p.minSize);
            const opacity = Math.min(0.85, 0.35 + i * 0.04);
            return (
              <path
                key={i}
                d={p.d}
                fill={bc.solid}
                fillOpacity={opacity}
                stroke={bc.stroke}
                strokeWidth="0.25"
                strokeOpacity="0.7"
              />
            );
          })}
          {/* Centroid marker */}
          <circle cx={cxBox} cy={cyBox} r="1.6" fill="none" stroke={c.solid} strokeWidth="0.5" opacity="0.75" />
          <circle cx={cxBox} cy={cyBox} r="0.8" fill={c.solid} />
        </svg>
        {live && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide-caps text-primary-foreground">
            <span className="relative inline-flex h-1.5 w-1.5">
              <span className="absolute inset-0 rounded-full bg-primary-foreground" />
              <span className="absolute inset-0 animate-ping rounded-full bg-primary-foreground opacity-60" />
            </span>
            Live
          </span>
        )}
        <span className="absolute right-3 top-3 inline-flex items-center rounded-full bg-teal-900/75 px-2 py-1 font-mono text-[9px] uppercase tracking-wide-caps text-cream-50/75 ring-1 ring-cream-50/15 backdrop-blur">
          {storm.source}
        </span>
        {/* Mono coordinate readout — instrument texture */}
        <span className="absolute bottom-2 left-3 font-mono-num text-[9px] tabular-nums text-cream-50/50">
          {storm.centroid_lat.toFixed(2)}°N {Math.abs(storm.centroid_lng).toFixed(2)}°W
        </span>
      </div>

      <div className="p-6">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold tracking-tight text-foreground">
              {where?.label ?? "United States"}
              {where && where.miles >= 5 && where.miles <= 250 && (
                <span className="ml-1 font-mono-num text-xs font-normal tabular-nums text-muted-foreground/70">
                  · {where.miles}mi
                </span>
              )}
            </p>
            <p className="font-mono-num text-xs tabular-nums text-muted-foreground">
              {timeAgo(storm.start_time)} ·{" "}
              {new Date(storm.start_time).toLocaleDateString(undefined, {
                month: "short",
                day: "2-digit",
                year: "numeric",
              })}
            </p>
          </div>
          <span
            className="inline-flex h-12 w-14 shrink-0 flex-col items-center justify-center rounded-md shadow-sm ring-1 ring-foreground/15"
            style={{ background: c.solid, color: badgeText }}
          >
            <span className="font-mono-num text-sm font-medium leading-none tabular-nums">
              {storm.max_hail_size_in.toFixed(2)}″
            </span>
            <span className="mt-0.5 font-mono text-[9px] uppercase leading-none tracking-wide-caps opacity-90">
              {c.object}
            </span>
          </span>
        </div>
        <p className="text-sm leading-relaxed text-foreground/85">
          {describeStorm(storm, where?.label)}
        </p>
        <Link
          href={`/storm/${storm.id}`}
          className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
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
