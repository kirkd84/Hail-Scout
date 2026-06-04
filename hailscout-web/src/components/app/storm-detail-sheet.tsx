"use client";

import type { Map as MapLibreMap } from "maplibre-gl";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { Storm } from "@/lib/api-types";
import { formatDateTime } from "@/lib/utils";
import { hailColor } from "@/lib/hail";
import * as React from "react";
import { synthesize } from "@/lib/storm-narrative";
import { DownloadReportButton } from "@/components/reports/download-report-button";
import { ExportLeadsButton } from "@/components/reports/export-leads-button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface StormDetailSheetProps {
  storm: Storm | null;
  isOpen: boolean;
  onClose: () => void;
  /** Optional address context (passed from the address-search flow). */
  address?: string;
  /** Live MapLibre instance — when present, the report embeds a swath snapshot. */
  map?: MapLibreMap | null;
}

/**
 * Storm detail — atlas plate of metadata.
 *
 * Hero: a large hail-size dial (the topographic mark riff) with the
 * inches in the display serif. Below: meta rows in a clean two-column
 * "term/definition" pattern.
 */
export function StormDetailSheet({ storm, isOpen, onClose, address, map }: StormDetailSheetProps) {
  const isMobile = useIsMobile();
  if (!storm) return null;
  const c = hailColor(storm.max_hail_size_in);

  const startTs = new Date(storm.start_time).getTime();
  const endTs   = new Date(storm.end_time).getTime();
  const durationMin = Math.max(1, Math.round((endTs - startTs) / 60000));

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={isMobile ? "p-0 bg-card border-t border-border max-h-[88vh] overflow-y-auto rounded-t-2xl" : "w-full sm:max-w-md p-0 bg-card border-l border-border"}
      >
        <SheetHeader className="px-6 pt-6 pb-3">
          <p className="text-[10px] font-mono uppercase tracking-wide-caps text-copper">Storm record</p>
          <SheetTitle className="font-display text-2xl font-medium tracking-tight-display">
            {formatDateTime(storm.start_time)}
          </SheetTitle>
        </SheetHeader>

        <div className="px-6">
          <div className="rule-atlas" />
        </div>

        {/* Hero hail size */}
        <div className="px-6 py-6">
          <div
            className="rounded-xl border p-6 flex items-center gap-5"
            style={{ background: c.bg, borderColor: c.border }}
          >
            <div className="relative h-20 w-20 shrink-0">
              {/* Topographic ring riff */}
              <svg viewBox="0 0 80 80" className="h-full w-full" aria-hidden>
                <circle cx="40" cy="40" r="36" fill="none" stroke={c.solid} strokeWidth="1.4" opacity="0.5" />
                <circle cx="40" cy="40" r="26" fill="none" stroke={c.solid} strokeWidth="1.2" opacity="0.7" />
                <circle cx="40" cy="40" r="16" fill={c.solid} opacity="0.9" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-mono uppercase tracking-wide-caps" style={{ color: c.text }}>
                Max hail diameter
              </p>
              <p className="font-display text-5xl font-medium tracking-tight-display" style={{ color: c.text }}>
                {storm.max_hail_size_in.toFixed(2)}″
              </p>
              <p className="mt-1 text-sm font-medium" style={{ color: c.text, opacity: 0.85 }}>
                {c.object}
              </p>
              <p className="mt-0.5 text-[11px] font-mono uppercase tracking-wide-caps" style={{ color: c.text, opacity: 0.55 }}>
                MRMS · {c.label}
              </p>
            </div>
          </div>
        </div>

        {/* Impact Score — the rep's triage number (size + footprint +
            ground-truth confirmation). */}
        {storm.impact && (
          <div className="px-6 pb-2">
            <ImpactMeter score={storm.impact.score} label={storm.impact.label} />
          </div>
        )}

        {/* AI insight */}
        <div className="px-6 pb-2">
          <AiInsightPanel storm={storm} />
        </div>

        {/* Meta rows */}
        <dl className="px-6 pb-8 grid grid-cols-1 gap-y-4 text-sm">
          <Row term="Duration" def={`${durationMin} min`} />
          <Row term="Started" def={formatDateTime(storm.start_time)} />
          <Row term="Ended"   def={formatDateTime(storm.end_time)} />
          <Row
            term="Centroid"
            def={
              storm.centroid_lat != null && storm.centroid_lng != null ? (
                <span className="font-mono-num">
                  {storm.centroid_lat.toFixed(4)}°N, {Math.abs(storm.centroid_lng).toFixed(4)}°W
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )
            }
          />
          {storm.bbox && (
            <Row
              term="Bounds"
              def={
                <span className="font-mono-num text-xs">
                  {storm.bbox.min_lat.toFixed(2)}, {storm.bbox.min_lng.toFixed(2)}
                  <br />
                  {storm.bbox.max_lat.toFixed(2)}, {storm.bbox.max_lng.toFixed(2)}
                </span>
              }
            />
          )}
          <Row
            term="Source"
            def={
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{
                    background:
                      storm.source === "mrms" ? "hsl(var(--copper-500))" : "hsl(var(--muted-foreground))",
                  }}
                />
                {storm.source === "mrms" ? "Real-time MRMS" : "Historical archive"}
              </span>
            }
          />
          {storm.lsr_confirmed && (
            <Row
              term="Ground truth"
              def={
                <span className="inline-flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-forest/10 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide-caps text-forest ring-1 ring-forest/30">
                    <span className="h-1.5 w-1.5 rounded-full bg-forest" />
                    SPC LSR confirmed
                  </span>
                  {storm.lsr_observed_size_in != null && (
                    <span className="font-mono-num text-xs text-foreground/70">
                      {storm.lsr_observed_size_in.toFixed(2)}″ reported
                    </span>
                  )}
                </span>
              }
            />
          )}
          {storm.suspect && (
            <Row
              term="Quality"
              def={
                <div className="space-y-1.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-copper/10 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide-caps text-copper ring-1 ring-copper/30">
                    <span className="h-1.5 w-1.5 rounded-full bg-copper" />
                    Unverified · likely false positive
                  </span>
                  {storm.suspect_reasons && storm.suspect_reasons.length > 0 && (
                    <ul className="text-xs text-foreground/60 list-none space-y-0.5">
                      {storm.suspect_reasons.map((reason) => (
                        <li key={reason} className="font-mono-num">
                          · {humanizeReason(reason)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              }
            />
          )}
        </dl>

        <div className="px-6 pb-6">
          <div className="rule-atlas mb-5" />
          <DownloadReportButton storm={storm} address={address} map={map} />
          <p className="mt-2 text-center text-[10px] font-mono uppercase tracking-wide-caps text-foreground/45">
            Branded PDF · ~1 page · ready to share
          </p>
          <div className="mt-3">
            <ExportLeadsButton storm={storm} />
          </div>
          <p className="mt-2 text-center text-[10px] font-mono uppercase tracking-wide-caps text-foreground/45">
            CSV · monitored addresses inside this storm
          </p>
          <ShareLinkButton storm={storm} className="mt-3" />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ImpactMeter({ score, label }: { score: number; label: string }) {
  // Color climbs with severity: forest → amber → copper → brick → plum.
  const colors = ["#2F7A4F", "#C19A2E", "#D88A3D", "#A8412D", "#7C2794"];
  const c = colors[Math.max(0, Math.min(4, score - 1))];
  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-mono uppercase tracking-wide-caps text-foreground/55">
          Impact score
        </span>
        <span className="text-sm font-medium" style={{ color: c }}>
          {label}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <span
              key={n}
              className="h-2.5 w-7 rounded-sm"
              style={{ background: n <= score ? c : "hsl(var(--border))" }}
            />
          ))}
        </div>
        <span className="font-mono-num text-sm font-medium text-foreground">
          {score}/5
        </span>
      </div>
    </div>
  );
}

function Row({ term, def }: { term: string; def: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-x-4 items-baseline">
      <dt className="text-[11px] font-mono uppercase tracking-wide-caps text-foreground/55">{term}</dt>
      <dd className="text-foreground">{def}</dd>
    </div>
  );
}

/** Map a screener tag (snake_case) to a one-line plain-English
 *  explanation. The server-side tags are stable identifiers; this
 *  function owns the user-facing copy so we can iterate on tone
 *  without a re-deploy of the API. */
function humanizeReason(tag: string): string {
  switch (tag) {
    case "implausibly_small_for_size":
      return "Footprint too small for the claimed peak hail size";
    case "no_cross_source_confirmation":
      return "Neither MRMS nor NEXRAD corroborated this reading";
    case "single_frame_no_persistence":
      return "Detected in a single radar frame only";
  }
  if (tag.startsWith("no_lsr_near_")) {
    const metro = tag
      .replace("no_lsr_near_", "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return `No ground report filed near ${metro} within ±3 hours`;
  }
  // Fall back to the raw tag — easier to debug than a silent drop.
  return tag.replace(/_/g, " ");
}

function ShareLinkButton({ storm, className }: { storm: Storm; className?: string }) {
  const [copied, setCopied] = React.useState(false);
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/storm/${storm.id}`
      : `/storm/${storm.id}`;

  const handle = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  return (
    <button
      type="button"
      onClick={handle}
      className={
        "inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-card px-4 py-2.5 text-sm text-foreground/85 hover:border-copper/50 hover:text-foreground transition-colors " +
        (className ?? "")
      }
    >
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-copper" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9 L10 5 M6 7 L4 7 A3 3 0 0 0 4 13 L7 13 M10 9 L12 9 A3 3 0 0 1 12 15 L9 15" />
      </svg>
      {copied ? "Copied · share away" : "Copy share link"}
    </button>
  );
}

function AiInsightPanel({ storm }: { storm: Storm }) {
  const n = synthesize(storm);
  return (
    <section className="rounded-lg border border-copper/40 bg-copper/5 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-copper/20 text-copper">
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 2 L9.5 6.5 L14 8 L9.5 9.5 L8 14 L6.5 9.5 L2 8 L6.5 6.5 Z" />
          </svg>
        </span>
        <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-copper-700">
          HailScout AI · Storm insight
        </p>
      </div>
      <p className="font-display text-base font-medium tracking-tight-display text-foreground leading-snug">
        {n.headline}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-foreground/85">
        {n.body}
      </p>
      <p className="mt-2 text-sm font-medium text-copper-700">
        {n.next_step}
      </p>
    </section>
  );
}
