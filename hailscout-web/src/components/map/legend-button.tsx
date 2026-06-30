"use client";

/**
 * Legend button — a compact dock control that opens the hail-size color
 * ramp in a popover, instead of a separate always-on panel. Lives in the
 * bottom-center map dock next to the basemap + view toggles.
 */

import { useState } from "react";
import { HAIL_LEGEND } from "@/lib/hail";
import { cn } from "@/lib/utils";

export function LegendButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const ramp = [...HAIL_LEGEND].reverse(); // heaviest first

  return (
    <div className={cn("relative", className)}>
      {open && (
        <div className="glass absolute bottom-full right-0 mb-2 w-56 rounded-lg p-3 shadow-panel">
          <div className="mb-2 flex items-baseline justify-between">
            <p className="text-[10px] font-mono uppercase tracking-wide-caps text-copper">
              Hail diameter
            </p>
            <p className="text-[10px] font-mono uppercase tracking-wide-caps text-foreground/40">
              NWS · same as IHM
            </p>
          </div>
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
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="glass inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs shadow-panel transition-all hover:border-copper/40"
        aria-expanded={open}
      >
        <span className="flex items-center -space-x-0.5" aria-hidden>
          {ramp
            .slice(0, 6)
            .reverse()
            .map((b) => (
              <span
                key={b.short}
                className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-background"
                style={{ background: b.solid }}
              />
            ))}
        </span>
        <span className="font-medium text-foreground/85">Legend</span>
      </button>
    </div>
  );
}
