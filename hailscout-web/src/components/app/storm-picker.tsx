"use client";

/**
 * Storm picker — recent storms with their nearest metro + date + size.
 *
 * Sits in the top-right of /app/map as a collapsible card. Always
 * shows the most recent N storms regardless of the map's date filter
 * so it's never blank.
 *
 * Click a row → map flies to the storm centroid. Sort: most recent
 * first — or, in "Deadlines" mode, storms approaching a 1-yr / 2-yr
 * statute-of-limitations claim deadline, soonest first.
 *
 * Visual: same atlas-card treatment used elsewhere (cream / teal /
 * copper, hail color badge per storm).
 */

import { useMemo, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Storm } from "@/lib/api-types";
import { nearestMetro } from "@/lib/metros";
import { hailColor } from "@/lib/hail";
import { timeAgo, statuteStatus, type SoLStatus } from "@/lib/time-ago";
import { cn } from "@/lib/utils";

interface Props {
  map: MapLibreMap | null;
  storms: Storm[];
  /** Max rows to render. Default 10 so the card stays tight. */
  limit?: number;
  /** Optional eyebrow label — e.g. "this region · 5 yr". Falls back
   *  to "Recent storms" when omitted. */
  scopeLabel?: string;
  /** When set, clicking a row also bubbles the storm to the parent
   *  (which can open a detail sheet). Map fly-to still happens. */
  onStormClick?: (storm: Storm) => void;
}

/** Impact 1-5 → severity color (forest → amber → copper → brick → plum). */
function impactColor(score: number): string {
  const colors = ["#2F7A4F", "#C19A2E", "#D88A3D", "#A8412D", "#7C2794"];
  return colors[Math.max(0, Math.min(4, score - 1))];
}

/** Days-until-deadline → urgency color (amber → copper → brick). */
function solColor(days: number): string {
  if (days <= 14) return "#A8412D"; // brick — critical
  if (days <= 30) return "#D88A3D"; // copper — warning
  return "#C19A2E"; // amber — on the radar
}

export function StormPicker({ map, storms, limit = 10, scopeLabel, onStormClick }: Props) {
  const [open, setOpen] = useState(true);
  const [solOnly, setSolOnly] = useState(false);

  // Per-storm statute-of-limitations status (within 60 days of a 1/2-yr deadline).
  const sols = useMemo(() => {
    const m = new Map<string, SoLStatus>();
    for (const s of storms) {
      const st = statuteStatus(s.start_time);
      if (st) m.set(s.id, st);
    }
    return m;
  }, [storms]);

  const solCount = sols.size;

  const top = useMemo(() => {
    if (solOnly) {
      return storms
        .filter((s) => sols.has(s.id))
        .sort((a, b) => sols.get(a.id)!.daysUntil - sols.get(b.id)!.daysUntil)
        .slice(0, limit);
    }
    return [...storms]
      .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
      .slice(0, limit);
  }, [storms, limit, solOnly, sols]);

  // Nothing at all to show → hide the card entirely.
  if (storms.length === 0) return null;

  return (
    <div className="pointer-events-auto absolute right-4 top-60 z-10 w-72 max-h-[calc(100vh-18rem)] overflow-hidden rounded-xl border border-border bg-card/95 shadow-panel backdrop-blur supports-[backdrop-filter]:bg-card/85 flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between px-4 py-3 border-b border-border hover:bg-secondary/40 transition-colors"
        aria-expanded={open}
      >
        <span className="flex items-baseline gap-2">
          <span className="font-mono-num text-[10px] uppercase tracking-wide-caps text-copper">
            {solOnly ? "Claim deadlines" : scopeLabel ?? "Recent storms"}
          </span>
          <span className="font-mono-num text-[10px] text-muted-foreground">
            {top.length}
          </span>
        </span>
        <span
          className={cn(
            "text-foreground/40 text-xs transition-transform",
            open ? "rotate-180" : "rotate-0",
          )}
          aria-hidden
        >
          ▾
        </span>
      </button>

      {open && (
        <>
          {/* Statute-of-limitations toggle. Surfaces storms whose 1- or 2-year
              claim deadline is within 60 days — the work that's about to expire. */}
          <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
            <button
              type="button"
              onClick={() => setSolOnly((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                solOnly
                  ? "bg-copper text-primary-foreground"
                  : "bg-secondary/60 text-foreground hover:bg-secondary",
              )}
              aria-pressed={solOnly}
              title="Show only storms nearing a 1- or 2-year claim deadline"
            >
              <span aria-hidden>⏳</span> Deadlines
            </button>
            {solCount > 0 ? (
              <span className="font-mono-num text-[10px] text-muted-foreground">
                {solCount} nearing
              </span>
            ) : (
              <span className="font-mono-num text-[10px] text-muted-foreground/60">
                none in view
              </span>
            )}
          </div>

          {top.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">
              No storms within 60 days of a 1- or 2-year claim deadline in this
              view. Zoom out to scan older storms.
            </p>
          ) : (
            <ul className="overflow-y-auto divide-y divide-border/60">
              {top.map((s) => {
                const where = nearestMetro(s.centroid_lat, s.centroid_lng);
                const c = hailColor(s.max_hail_size_in);
                const cityLabel = where?.label ?? "United States";
                const sol = sols.get(s.id);
                // Show "~12mi" if it's a near miss; hide for very close hits
                // and very distant ones (looks weird otherwise).
                const distanceLabel =
                  where && where.miles >= 5 && where.miles <= 250
                    ? ` · ${where.miles}mi`
                    : "";
                const isHeavy = s.max_hail_size_in >= 1.5;
                const badgeText = isHeavy ? "#FAF7F1" : c.text;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (map) {
                          map.flyTo({
                            center: [s.centroid_lng, s.centroid_lat],
                            zoom: 8,
                            duration: 1100,
                          });
                        }
                        onStormClick?.(s);
                      }}
                      className="w-full px-4 py-3 text-left transition-colors hover:bg-secondary/30 flex items-start gap-3"
                    >
                      <span
                        className="mt-0.5 inline-flex h-10 w-12 shrink-0 flex-col items-center justify-center rounded-md ring-1 ring-foreground/15 shadow-sm"
                        style={{ background: c.solid, color: badgeText }}
                      >
                        <span className="font-mono-num text-xs font-medium leading-none">
                          {s.max_hail_size_in.toFixed(2)}″
                        </span>
                        <span className="text-[8px] uppercase tracking-wide-caps font-mono leading-none mt-0.5 opacity-90">
                          {c.object}
                        </span>
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
                          <span className="truncate">{cityLabel}</span>
                          <span className="text-muted-foreground/70 font-mono-num text-xs font-normal">
                            {distanceLabel}
                          </span>
                          {s.impact && (
                            <span
                              className="ml-auto shrink-0 rounded-sm px-1.5 py-0.5 font-mono-num text-[10px] font-medium"
                              style={{
                                background: `${impactColor(s.impact.score)}22`,
                                color: impactColor(s.impact.score),
                              }}
                              title={`Impact ${s.impact.label}`}
                            >
                              IMPACT {s.impact.score}
                            </span>
                          )}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground font-mono-num">
                          {timeAgo(s.start_time)} ·{" "}
                          {new Date(s.start_time).toLocaleDateString(undefined, {
                            month: "short",
                            day: "2-digit",
                          })}
                        </span>
                        {sol && (
                          <span
                            className="mt-1 inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-mono-num text-[10px] font-medium"
                            style={{
                              background: `${solColor(sol.daysUntil)}1f`,
                              color: solColor(sol.daysUntil),
                            }}
                            title={`${sol.deadline}-year claim deadline on ${sol.deadlineDate.toLocaleDateString()}`}
                          >
                            <span aria-hidden>⏳</span>
                            {sol.deadline}-YR DEADLINE · {sol.daysUntil}d
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
