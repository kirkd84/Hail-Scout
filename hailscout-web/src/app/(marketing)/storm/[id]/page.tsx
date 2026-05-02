"use client";

import Link from "next/link";
import { use } from "react";
import { notFound } from "next/navigation";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-chrome";
import { ContourBg } from "@/components/brand/contour-bg";
import { STORM_FIXTURES, type StormFixture } from "@/lib/storm-fixtures";
import { hailColor } from "@/lib/hail";
import { synthesize } from "@/lib/storm-narrative";
import { timeAgo } from "@/lib/time-ago";

/**
 * Public, no-auth storm detail page. Shareable URL — perfect for
 * sending to insurance adjusters or homeowners as proof.
 */
export default function PublicStormPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const storm = STORM_FIXTURES.find((s) => s.id === id);
  if (!storm) notFound();

  const c = hailColor(storm.max_hail_size_in);
  const n = synthesize(storm);
  const dur = (() => {
    const ms = new Date(storm.end_time).getTime() - new Date(storm.start_time).getTime();
    return Math.max(1, Math.round(ms / 60_000));
  })();

  return (
    <main className="bg-background text-foreground">
      <SiteHeader />

      <section className="relative overflow-hidden bg-topo">
        <ContourBg className="opacity-90" density="sparse" />
        <div className="container relative pb-12 pt-12 md:pb-16 md:pt-16">
          <Link
            href="/live"
            className="inline-flex items-center gap-1 text-xs font-mono uppercase tracking-wide-caps text-foreground/55 hover:text-copper"
          >
            <span aria-hidden>←</span> All live + recent storms
          </Link>

          <div className="mt-6 grid gap-10 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-7">
              <p className="font-mono-num text-xs uppercase tracking-wide-caps text-copper">
                Storm record · {storm.id.replace("fx-storm-", "").toUpperCase()}
              </p>
              <h1 className="mt-2 font-display text-balance text-5xl font-medium leading-[1.05] tracking-tight-display text-foreground md:text-6xl">
                {storm.city}
              </h1>
              <p className="mt-4 text-lg text-muted-foreground">
                {n.headline}
              </p>
              <div className="mt-6 grid gap-2 grid-cols-2 sm:grid-cols-4">
                <Stat label="Peak hail" value={`${storm.max_hail_size_in.toFixed(2)}″`} accent />
                <Stat label="Reference" value={c.object} />
                <Stat label="Duration" value={`${dur}m`} />
                <Stat label="Started"  value={timeAgo(storm.start_time)} />
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="rounded-xl border border-border bg-card overflow-hidden shadow-atlas-lg">
                <Plate storm={storm} />
                <div className="px-4 py-2 border-t border-border text-[11px] font-mono-num text-foreground/55 flex items-center justify-between">
                  <span>HAILSCOUT · STORM PLATE</span>
                  <span>{storm.bbox.min_lat.toFixed(2)}, {storm.bbox.min_lng.toFixed(2)} → {storm.bbox.max_lat.toFixed(2)}, {storm.bbox.max_lng.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-card border-y border-border">
        <div className="container py-14 max-w-3xl">
          <div className="rounded-xl border border-copper/40 bg-copper/5 p-6">
            <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-copper-700 flex items-center gap-2">
              <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 2 L9.5 6.5 L14 8 L9.5 9.5 L8 14 L6.5 9.5 L2 8 L6.5 6.5 Z" />
              </svg>
              HailScout AI · Storm insight
            </p>
            <p className="mt-3 font-display text-2xl font-medium tracking-tight-display text-foreground leading-snug">
              {n.headline}
            </p>
            <p className="mt-4 text-foreground/85 leading-relaxed">{n.body}</p>
            <p className="mt-4 font-medium text-copper-700">{n.next_step}</p>
          </div>

          <dl className="mt-10 grid grid-cols-2 gap-x-8 gap-y-5 text-sm">
            <Row term="Start" def={fmt(storm.start_time)} />
            <Row term="End"   def={fmt(storm.end_time)} />
            <Row term="Centroid" def={`${storm.centroid_lat.toFixed(4)}°N, ${Math.abs(storm.centroid_lng).toFixed(4)}°W`} mono />
            <Row term="Source" def="NOAA MRMS" />
          </dl>
        </div>
      </section>

      <section className="border-t border-border bg-primary text-primary-foreground">
        <div className="container py-16 text-center md:py-20">
          <h2 className="font-display text-balance text-3xl font-medium tracking-tight-display md:text-4xl">
            Was your address hit by this storm?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-primary-foreground/80">
            Search any address on HailScout — see exactly what fell. Generate a Hail Impact Report to file your claim.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link href="/sign-up" className="inline-flex items-center gap-2 rounded-md bg-copper px-5 py-3 text-sm font-medium text-primary-foreground shadow-atlas-lg hover:bg-copper-700">
              Search your address <span aria-hidden>→</span>
            </Link>
            <Link href="/live" className="inline-flex items-center gap-2 rounded-md border border-primary-foreground/20 bg-transparent px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary-foreground/10">
              See all live storms
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

function Plate({ storm }: { storm: StormFixture }) {
  return (
    <svg viewBox="0 0 100 56" preserveAspectRatio="none" className="block w-full" style={{ aspectRatio: "16 / 9", background: "hsl(var(--cream-50))" }}>
      <path d="M0,18 Q25,12 50,16 T100,12" fill="none" stroke="hsl(var(--teal-700))" strokeWidth="0.18" opacity="0.3" />
      <path d="M0,32 Q25,28 50,30 T100,26" fill="none" stroke="hsl(var(--teal-700))" strokeWidth="0.18" opacity="0.22" />
      <path d="M0,46 Q25,42 50,44 T100,40" fill="none" stroke="hsl(var(--teal-700))" strokeWidth="0.18" opacity="0.18" />
      {storm.bands.map((b, i) => {
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
        const c = hailColor(b.min_size_in);
        return (
          <path
            key={i}
            d={d}
            fill={c.solid}
            fillOpacity={0.32 + i * 0.04}
            stroke={c.stroke}
            strokeWidth="0.25"
            strokeOpacity="0.65"
          />
        );
      })}
      <circle cx="50" cy="28" r="1.6" fill="none" stroke={hailColor(storm.max_hail_size_in).solid} strokeWidth="0.5" opacity="0.65" />
      <circle cx="50" cy="28" r="0.8" fill={hailColor(storm.max_hail_size_in).solid} />
    </svg>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-card/70 backdrop-blur p-3">
      <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-foreground/55">{label}</p>
      <p className={`mt-1 font-display text-2xl font-medium tracking-tight-display ${accent ? "text-copper" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function Row({ term, def, mono }: { term: string; def: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] font-mono uppercase tracking-wide-caps text-foreground/55">{term}</dt>
      <dd className={mono ? "font-mono-num text-foreground" : "text-foreground"}>{def}</dd>
    </div>
  );
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

