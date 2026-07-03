"use client";

/**
 * Legend button — a compact dock control that opens the hail-size color
 * ramp in a popover, instead of a separate always-on panel. Lives in the
 * bottom-center map dock next to the basemap + view toggles.
 *
 * View-aware: the Smooth surface is a continuous gold→red→magenta gradient
 * (the API's raster ramp), so in Smooth mode the legend shows a matching
 * gradient bar. Cells/Heatmap show the discrete NWS-style swatches.
 */

import { useState } from "react";
import { HAIL_LEGEND, SMOOTH_RAMP } from "@/lib/hail";
import { cn } from "@/lib/utils";

type ViewMode = "cells" | "smooth" | "heatmap";

export function LegendButton({
  viewMode = "cells",
  className,
}: {
  viewMode?: ViewMode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const smooth = viewMode === "smooth";

  // The button's preview dots reflect whichever palette is on the map.
  const previewDots = smooth
    ? SMOOTH_RAMP.map((s) => s.hex)
    : [...HAIL_LEGEND].reverse().map((b) => b.solid);

  return (
    <div className={cn("relative", className)}>
      {open && (
        <div className="glass absolute bottom-full right-0 mb-2 w-56 rounded-lg p-3 shadow-panel">
          <div className="mb-2 flex items-baseline justify-between">
            <p className="text-[10px] font-mono uppercase tracking-wide-caps text-copper">
              Hail diameter
            </p>
            <p className="text-[10px] font-mono uppercase tracking-wide-caps text-foreground/40">
              {smooth ? "Smooth view" : "NWS · same as IHM"}
            </p>
          </div>
          {smooth ? <SmoothLegend /> : <SwatchLegend />}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="glass inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs shadow-panel transition-all hover:border-copper/40"
        aria-expanded={open}
      >
        <span className="flex items-center -space-x-0.5" aria-hidden>
          {previewDots.slice(0, 6).map((hex, i) => (
            <span
              key={i}
              className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-background"
              style={{ background: hex }}
            />
          ))}
        </span>
        <span className="font-medium text-foreground/85">Legend</span>
      </button>
    </div>
  );
}

/** Discrete swatch list — for Cells / Heatmap views. */
function SwatchLegend() {
  const ramp = [...HAIL_LEGEND].reverse(); // heaviest first
  return (
    <ul className="space-y-1.5">
      {ramp.map((b) => (
        <li key={b.short} className="flex items-center gap-2.5 text-xs">
          <span
            className="inline-block h-3.5 w-3.5 rounded-sm ring-1 ring-foreground/10"
            style={{ background: b.solid }}
          />
          <span className="w-12 font-mono-num text-foreground/85">{b.short}</span>
          <span className="truncate text-foreground/55">{b.object}</span>
        </li>
      ))}
    </ul>
  );
}

/** Continuous gradient bar — matches the Smooth raster surface. */
function SmoothLegend() {
  const min = SMOOTH_RAMP[0].sizeIn;
  const max = SMOOTH_RAMP[SMOOTH_RAMP.length - 1].sizeIn;
  const pos = (s: number) => ((s - min) / (max - min)) * 100;
  // CSS lerps RGB between stops exactly as the API ramp does, so this bar
  // is a faithful copy of the on-map color-vs-size mapping.
  const gradient = `linear-gradient(to top, ${SMOOTH_RAMP.map(
    (s) => `${s.hex} ${pos(s.sizeIn).toFixed(1)}%`,
  ).join(", ")})`;
  return (
    <div className="flex gap-2.5 py-1">
      <div
        className="h-40 w-3.5 shrink-0 rounded-sm ring-1 ring-foreground/10"
        style={{ background: gradient }}
      />
      <div className="relative h-40 flex-1">
        {SMOOTH_RAMP.map((s) => (
          <div
            key={s.short}
            className="absolute left-0 flex -translate-y-1/2 items-center gap-2 text-xs"
            style={{ top: `${100 - pos(s.sizeIn)}%` }}
          >
            <span className="w-11 font-mono-num text-foreground/85">{s.short}</span>
            <span className="truncate text-foreground/55">{s.object}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
