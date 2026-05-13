"use client";

/**
 * Storm picker — recent storms with their nearest metro + date + size.
 *
 * Sits in the top-right of /app/map as a collapsible card. Always
 * shows the most recent N storms regardless of the map's date filter
 * so it's never blank.
 *
 * Click a row → map flies to the storm centroid. Sort: most recent
 * first.
 *
 * Visual: same atlas-card treatment used elsewhere (cream / teal /
 * copper, hail color badge per storm).
 */

import { useMemo, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Storm } from "@/lib/api-types";
import { nearestMetro } from "@/lib/metros";
import { hailColor } from "@/lib/hail";
import { timeAgo } from "@/lib/time-ago";
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

export function StormPicker({ map, storms, limit = 10, scopeLabel, onStormClick }: Props) {
  const [open, setOpen] = useState(true);

  const top = useMemo(() => {
    return [...storms]
      .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
      .slice(0, limit);
  }, [storms, limit]);

  // Don't render the card if we genuinely have nothing.
  if (top.length === 0) return null;

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
            {scopeLabel ?? "Recent storms"}
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
        <ul className="overflow-y-auto divide-y divide-border/60">
          {top.map((s) => {
            const where = nearestMetro(s.centroid_lat, s.centroid_lng);
            const c = hailColor(s.max_hail_size_in);
            const cityLabel = where?.label ?? "United States";
            // Show "~12mi" if it's a near miss; hide for very close hits
            // and very distant ones (looks weird otherwise).
            const distanceLabel =
              where && where.miles >= 5 && where.miles <= 250
                ? ` · ${where.miles}mi`
                : "";
            // Heavy hail tiers (>= 1.5") use white text on the dark solid
            // background; lighter tiers use the dark per-tier text on a
            // lighter solid background. Works in both light + dark modes
            // because the badge is opaque, not theme-tinted.
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
                    <span className="block truncate text-sm font-medium text-foreground">
                      {cityLabel}
                      <span className="text-muted-foreground/70 font-mono-num text-xs font-normal">
                        {distanceLabel}
                      </span>
                    </span>
                    <span className="block truncate text-xs text-muted-foreground font-mono-num">
                      {timeAgo(s.start_time)} ·{" "}
                      {new Date(s.start_time).toLocaleDateString(undefined, {
                        month: "short",
                        day: "2-digit",
                      })}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
