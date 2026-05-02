"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-chrome";
import { StatTicker } from "@/components/marketing/stat-ticker";
import { ContourBg } from "@/components/brand/contour-bg";
import { STORM_FIXTURES, type StormFixture } from "@/lib/storm-fixtures";
import { hailColor } from "@/lib/hail";
import { timeAgo } from "@/lib/time-ago";
import { synthesize } from "@/lib/storm-narrative";
import { cn } from "@/lib/utils";

/**
 * Public storm gallery — no auth required.
 *
 * Anonymous visitors see live + recent storms with the same nested-band
 * map preview the app uses internally, plus an AI-synthesized narrative
 * per storm. CTA on every card sends them to /sign-up.
 *
 * Rendered as a client component because the live storms have
 * relative timestamps and we re-render on a 30s tick.
 */
export default function LiveStormsPage() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const live = STORM_FIXTURES.filter((s) => s.is_live);
  const recent = [...STORM_FIXTURES]
    .filter((s) => !s.is_live)
    .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
    .slice(0, 12);

  return (
    <main className="bg-background text-foreground">
      <SiteHeader />
      <StatTicker />
      <Hero count={live.length} totalRecent={recent.length} />
      {live.length > 0 && <Section title="Tracking right now" tone="copper" storms={live} />}
      <Section title="Recent storms · past 30 days" tone="muted" storms={recent} />
      <FinalCta />
      <SiteFooter />
    </main>
  );
}

function Hero({ count, totalRecent }: { count: number; totalRecent: number }) {
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
              {count} storm{count === 1 ? "" : "s"} tracking right now
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
          See what&apos;s happening in the U.S. hail belt right now — pulled from the same NOAA MRMS feed our paying contractors trust.
          {totalRecent > 0 && ` Past 30 days: ${totalRecent} indexed events.`}
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

function Section({ title, tone, storms }: { title: string; tone: "copper" | "muted"; storms: StormFixture[] }) {
  return (
    <section className={cn(tone === "copper" ? "bg-card border-y border-border" : "bg-background")}>
      <div className="container py-16">
        <div className="flex items-baseline justify-between mb-8">
          <h2 className="font-display text-3xl font-medium tracking-tight-display text-foreground md:text-4xl">{title}</h2>
          <p className="font-mono-num text-xs uppercase tracking-wide-caps text-foreground/55">
            {storms.length} event{storms.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {storms.map((s) => (
            <StormCard key={s.id} storm={s} live={tone === "copper"} />
          ))}
        </div>
      </div>
    </section>
  );
}

function StormCard({ storm, live }: { storm: StormFixture; live: boolean }) {
  const c = hailColor(storm.max_hail_size_in);
  const n = synthesize(storm);

  return (
    <article className="rounded-xl border border-border bg-card overflow-hidden shadow-atlas transition-shadow hover:shadow-atlas-lg">
      {/* Mini atlas plate — same lozenge styling as AtlasMapPreview */}
      <div className="relative aspect-[16/9] w-full overflow-hidden border-b border-border">
        <svg viewBox="0 0 100 56" preserveAspectRatio="none" className="h-full w-full" style={{ background: "hsl(var(--cream-50))" }}>
          {/* Topo lines */}
          <path d="M0,18 Q25,12 50,16 T100,12" fill="none" stroke="hsl(var(--teal-700))" strokeWidth="0.18" opacity="0.3" />
          <path d="M0,32 Q25,28 50,30 T100,26" fill="none" stroke="hsl(var(--teal-700))" strokeWidth="0.18" opacity="0.22" />
          <path d="M0,46 Q25,42 50,44 T100,40" fill="none" stroke="hsl(var(--teal-700))" strokeWidth="0.18" opacity="0.18" />
          {/* Storm bands — paint each band as a scaled lozenge using bbox aspect */}
          {storm.bands.map((b, i) => {
            // Project bbox-relative coords into the SVG's 100×56 viewBox
            const xs = b.ring.map(([lng]) => lng);
            const ys = b.ring.map(([, lat]) => lat);
            const minX = Math.min(...xs), maxX = Math.max(...xs);
            const minY = Math.min(...ys), maxY = Math.max(...ys);
            const cx = (storm.bbox.min_lng + storm.bbox.max_lng) / 2;
            const cy = (storm.bbox.min_lat + storm.bbox.max_lat) / 2;
            const halfW = Math.max(0.001, (storm.bbox.max_lng - storm.bbox.min_lng) / 2);
            const halfH = Math.max(0.001, (storm.bbox.max_lat - storm.bbox.min_lat) / 2);
            const proj = (x: number, y: number) => [
              50 + ((x - cx) / halfW) * 38,
              28 - ((y - cy) / halfH) * 22,
            ];
            const d =
              "M " +
              b.ring
                .map(([lng, lat]) => proj(lng, lat).map((n) => n.toFixed(2)).join(","))
                .join(" L ") +
              " Z";
            const bandColor = hailColor(b.min_size_in);
            return (
              <path
                key={i}
                d={d}
                fill={bandColor.solid}
                fillOpacity={0.32 + i * 0.04}
                stroke={bandColor.stroke}
                strokeWidth="0.25"
                strokeOpacity="0.65"
              />
            );
          })}
          {/* Centroid dot */}
          {(() => {
            const cx = (storm.bbox.min_lng + storm.bbox.max_lng) / 2;
            const cy = (storm.bbox.min_lat + storm.bbox.max_lat) / 2;
            return (
              <>
                <circle cx="50" cy="28" r="1.6" fill="none" stroke={c.solid} strokeWidth="0.5" opacity="0.65" />
                <circle cx="50" cy="28" r="0.8" fill={c.solid} />
              </>
            );
          })()}
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
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            <p className="font-display text-xl font-medium tracking-tight-display text-foreground truncate">
              {storm.city}
            </p>
            <p className="text-xs text-muted-foreground font-mono-num">
              {timeAgo(storm.start_time)}
            </p>
          </div>
          <span
            className="inline-flex h-12 w-14 shrink-0 flex-col items-center justify-center rounded-md border"
            style={{ background: c.bg, borderColor: c.border }}
          >
            <span className="font-mono-num text-sm font-medium leading-none" style={{ color: c.text }}>
              {storm.max_hail_size_in.toFixed(2)}″
            </span>
            <span className="text-[9px] uppercase tracking-wide-caps font-mono leading-none mt-0.5" style={{ color: c.text, opacity: 0.75 }}>
              {c.object}
            </span>
          </span>
        </div>
        <p className="text-sm text-foreground/85 leading-relaxed line-clamp-3">{n.body}</p>
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

