"use client";

import type { Map as MapLibreMap } from "maplibre-gl";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { Storm } from "@/lib/api-types";
import { formatDateTime } from "@/lib/utils";
import { hailColor } from "@/lib/hail";
import { DownloadReportButton } from "@/components/reports/download-report-button";
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
        </dl>

        <div className="px-6 pb-6">
          <div className="rule-atlas mb-5" />
          <DownloadReportButton storm={storm} address={address} map={map} />
          <p className="mt-2 text-center text-[10px] font-mono uppercase tracking-wide-caps text-foreground/45">
            Branded PDF · ~1 page · ready to share
          </p>
        </div>
      </SheetContent>
    </Sheet>
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
