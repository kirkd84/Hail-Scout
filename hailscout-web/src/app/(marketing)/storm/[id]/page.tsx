"use client";

import Link from "next/link";
import { use } from "react";
import { notFound } from "next/navigation";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-chrome";
import { ContourBg } from "@/components/brand/contour-bg";
import { CtaBand } from "@/components/marketing/primitives";
import { useStormDetail, type ApiStormDetail } from "@/hooks/useStorms";
import { nearestMetro } from "@/lib/metros";
import { hailColor } from "@/lib/hail";
import { timeAgo } from "@/lib/time-ago";

/**
 * Public, no-auth storm detail page. Shareable URL — perfect for
 * sending to insurance adjusters or homeowners as proof.
 *
 * Phase 16.8 migration: data sourced from /v1/storms/{id} (with
 * swaths inline). fallbackToFixtures is implicit in useStormDetail
 * via NEXT_PUBLIC_USE_FIXTURES; we 404 on real "not found" only
 * after loading completes.
 */
export default function PublicStormPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { detail, isLoading } = useStormDetail(id);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <div className="container py-24 text-center font-mono text-sm uppercase tracking-wide-caps text-muted-foreground">
          Loading storm record…
        </div>
        <SiteFooter />
      </main>
    );
  }

  if (!detail) {
    notFound();
  }

  const [centLng, centLat] = detail.centroid?.coordinates ?? [0, 0];
  const where = nearestMetro(centLat, centLng);
  const peak = detail.max_hail_size_in;
  const c = hailColor(peak);
  const durMin = Math.max(
    1,
    Math.round(
      (new Date(detail.end_time).getTime() -
        new Date(detail.start_time).getTime()) /
        60_000,
    ),
  );

  return (
    <main className="bg-background text-foreground">
      <SiteHeader />

      <section className="relative overflow-hidden">
        <ContourBg className="opacity-80" density="sparse" />
        <div className="container relative max-w-6xl pb-12 pt-12 md:pb-16 md:pt-16">
          <Link
            href="/live"
            className="inline-flex min-h-11 items-center gap-1 font-mono text-xs uppercase tracking-wide-caps text-foreground/55 transition-colors hover:text-primary"
          >
            <span aria-hidden>←</span> All live + recent storms
          </Link>

          <div className="mt-4 grid gap-10 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-7">
              <p className="eyebrow">
                Storm record · {detail.id.replace("storm_", "").toUpperCase()}
              </p>
              <h1 className="display-1 mt-3 text-foreground">
                {where?.label ?? "United States"}
              </h1>
              {where && where.miles >= 5 && where.miles <= 250 && (
                <p className="mt-2 font-mono-num text-sm tabular-nums text-muted-foreground">
                  ~{where.miles}mi from {where.metro.name}
                </p>
              )}
              <p className="mt-4 max-w-prose text-base leading-[1.65] text-muted-foreground text-pretty">
                {makeHeadline(detail, where?.label)}
              </p>
              <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Peak hail" value={`${peak.toFixed(2)}″`} accent />
                <Stat label="Reference" value={c.object} />
                <Stat label="Duration" value={`${durMin}m`} />
                <Stat label="Started" value={timeAgo(detail.start_time)} />
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-panel">
                <Plate detail={detail} />
                <div className="flex items-center justify-between border-t border-border px-4 py-2 font-mono-num text-[11px] tabular-nums text-foreground/55">
                  <span>HAIL GPS · STORM PLATE</span>
                  <BboxLabel detail={detail} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-secondary/40">
        <div className="container max-w-3xl py-24 md:py-32">
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 md:p-7">
            <p className="eyebrow flex items-center gap-2">
              <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M8 2 L9.5 6.5 L14 8 L9.5 9.5 L8 14 L6.5 9.5 L2 8 L6.5 6.5 Z" />
              </svg>
              Hail GPS · Storm insight
            </p>
            <p className="mt-3 text-2xl font-semibold leading-snug tracking-tight text-foreground text-balance">
              {makeHeadline(detail, where?.label)}
            </p>
            <p className="mt-4 max-w-prose leading-[1.65] text-foreground/85">
              {makeBody(detail, where?.label)}
            </p>
            <p className="mt-4 font-medium text-primary">
              {makeNextStep(detail)}
            </p>
          </div>

          <dl className="mt-10 grid grid-cols-2 gap-x-8 gap-y-5 text-sm">
            <Row term="Start" def={fmt(detail.start_time)} mono />
            <Row term="End" def={fmt(detail.end_time)} mono />
            <Row
              term="Centroid"
              def={`${centLat.toFixed(4)}°N, ${Math.abs(centLng).toFixed(4)}°W`}
              mono
            />
            <Row term="Source" def={`NOAA ${detail.source}`} />
            <Row term="Swath bands" def={`${detail.swaths.length} mapped`} mono />
            <Row term="Storm ID" def={detail.id} mono />
          </dl>
        </div>
      </section>

      <CtaBand
        title="Was your address hit by this storm?"
        lede="Search any address on Hail GPS — see exactly what fell, then generate a hail impact report to back the claim."
        primary={{ label: "Look up an address", href: "/claim" }}
        secondary={{ label: "Request access", href: "/request-access" }}
      />

      <SiteFooter />
    </main>
  );
}

// ── Map plate: swath polygons projected into the bbox, dark ground ────
function Plate({ detail }: { detail: ApiStormDetail }) {
  const bbox = detail.bbox?.coordinates?.[0] ?? [];
  if (bbox.length < 4) return null;
  const xs = bbox.map((p) => p[0]);
  const ys = bbox.map((p) => p[1]);
  const minLng = Math.min(...xs);
  const maxLng = Math.max(...xs);
  const minLat = Math.min(...ys);
  const maxLat = Math.max(...ys);
  const cx = (minLng + maxLng) / 2;
  const cy = (minLat + maxLat) / 2;
  const halfW = Math.max(0.001, (maxLng - minLng) / 2);
  const halfH = Math.max(0.001, (maxLat - minLat) / 2);
  const proj = (x: number, y: number) => [
    50 + ((x - cx) / halfW) * 38,
    28 - ((y - cy) / halfH) * 22,
  ];

  const sortedSwaths = [...detail.swaths].sort(
    (a, b) =>
      parseFloat(a.hail_size_category) - parseFloat(b.hail_size_category),
  );

  return (
    <svg
      viewBox="0 0 100 56"
      preserveAspectRatio="none"
      className="block w-full"
      style={{ aspectRatio: "16 / 9", background: "hsl(var(--teal-900))" }}
    >
      {/* Faint graticule — same dark ground as the product map */}
      {[14, 28, 42].map((y) => (
        <line key={`h${y}`} x1="0" y1={y} x2="100" y2={y} stroke="hsl(var(--cream-50))" strokeOpacity="0.07" strokeWidth="0.18" />
      ))}
      {[20, 40, 60, 80].map((x) => (
        <line key={`v${x}`} x1={x} y1="0" x2={x} y2="56" stroke="hsl(var(--cream-50))" strokeOpacity="0.07" strokeWidth="0.18" />
      ))}
      {sortedSwaths.flatMap((sw, swathIdx) => {
        if (!sw.geometry) return [];
        const min = parseFloat(sw.hail_size_category);
        const bc = hailColor(min);
        const opacity = Math.min(0.85, 0.35 + swathIdx * 0.05);
        return sw.geometry.coordinates.map((polygon, pIdx) => {
          const outer = polygon[0];
          if (!outer || outer.length < 3) return null;
          const d =
            "M " +
            outer
              .map(([lng, lat]) =>
                proj(lng, lat).map((n) => n.toFixed(2)).join(","),
              )
              .join(" L ") +
            " Z";
          return (
            <path
              key={`${swathIdx}-${pIdx}`}
              d={d}
              fill={bc.solid}
              fillOpacity={opacity}
              stroke={bc.stroke}
              strokeWidth="0.25"
              strokeOpacity="0.7"
            />
          );
        });
      })}
      {/* Centroid */}
      {detail.centroid && (() => {
        const [lng, lat] = detail.centroid.coordinates;
        const [px, py] = proj(lng, lat);
        const peakColor = hailColor(detail.max_hail_size_in);
        return (
          <>
            <circle cx={px} cy={py} r="1.6" fill="none" stroke={peakColor.solid} strokeWidth="0.5" opacity="0.75" />
            <circle cx={px} cy={py} r="0.8" fill={peakColor.solid} />
          </>
        );
      })()}
    </svg>
  );
}

function BboxLabel({ detail }: { detail: ApiStormDetail }) {
  const ring = detail.bbox?.coordinates?.[0] ?? [];
  if (ring.length < 4) return null;
  const xs = ring.map((p) => p[0]);
  const ys = ring.map((p) => p[1]);
  return (
    <span>
      {Math.min(...ys).toFixed(2)}, {Math.min(...xs).toFixed(2)} →{" "}
      {Math.max(...ys).toFixed(2)}, {Math.max(...xs).toFixed(2)}
    </span>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/70 p-3 backdrop-blur">
      <p className="font-mono text-[10px] uppercase tracking-wide-caps text-foreground/55">{label}</p>
      <p className={`mt-1 font-mono-num text-xl font-medium tabular-nums md:text-2xl ${accent ? "text-primary" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function Row({ term, def, mono }: { term: string; def: string; mono?: boolean }) {
  return (
    <div>
      <dt className="font-mono text-[11px] uppercase tracking-wide-caps text-foreground/55">{term}</dt>
      <dd className={mono ? "mt-0.5 font-mono-num tabular-nums text-foreground" : "mt-0.5 text-foreground"}>{def}</dd>
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

// ── Insight templating — deterministic, no LLM call ───────────────────
function makeHeadline(detail: ApiStormDetail, locationLabel?: string): string {
  const peak = detail.max_hail_size_in;
  const obj = hailColor(peak).object;
  const where = locationLabel ?? "the region";
  if (peak >= 3.0) {
    return `Softball-grade ${peak.toFixed(2)}″ hail near ${where} — major roof damage event.`;
  }
  if (peak >= 2.0) {
    return `${obj}-size hail (${peak.toFixed(2)}″) confirmed near ${where}.`;
  }
  if (peak >= 1.0) {
    return `${peak.toFixed(2)}″ hail near ${where} — claim-eligible damage likely.`;
  }
  return `Light hail (${peak.toFixed(2)}″) near ${where}.`;
}

function makeBody(detail: ApiStormDetail, locationLabel?: string): string {
  const peak = detail.max_hail_size_in;
  const where = locationLabel ?? "the area";
  const swathCount = detail.swaths.length;
  const dur = Math.round(
    (new Date(detail.end_time).getTime() -
      new Date(detail.start_time).getTime()) /
      (60 * 60 * 1000),
  );
  const lead = peak >= 1.5
    ? `Damaging hail event over ${where}.`
    : `Hail event mapped near ${where}.`;
  const swathPhrase = swathCount > 1
    ? `${swathCount} concentric size bands recorded across the swath — from the outer light-hail edge down to the ${peak.toFixed(2)}″ core.`
    : `One swath band mapped at this storm's peak intensity.`;
  const sourceLine = detail.source === "NEXRAD"
    ? `Source: NOAA NEXRAD high-resolution radar, tracked storm by storm.`
    : `Source: NOAA MRMS radar network (about 1 km detail), tracked storm by storm.`;
  const tracking = dur > 1 ? `Followed across ${dur} hour${dur === 1 ? "" : "s"} of back-to-back radar scans.` : "";
  return `${lead} ${swathPhrase} ${tracking} ${sourceLine}`.replace(/\s+/g, " ").trim();
}

function makeNextStep(detail: ApiStormDetail): string {
  if (detail.max_hail_size_in >= 1.5) {
    return "Recommended next step: pull every address inside this footprint and run a Hail GPS impact report before adjusters do.";
  }
  return "Recommended next step: check whether your monitored addresses sit inside this swath — surface damage may still qualify for claims.";
}
