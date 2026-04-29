"use client";

import { useState } from "react";
import { HAIL_LEGEND } from "@/lib/hail";
import { IconChevronRight } from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * Compact glass-morphism hail-size legend.
 *
 * Default state: single pill labeled "Legend" with a stack of color
 * dots — gets out of the way. Click expands to a vertical list with
 * size labels.
 */
export function SwathLegend() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="pointer-events-auto absolute top-24 right-4 z-20">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          "glass flex items-center gap-2 rounded-full px-3 py-2 shadow-panel transition-all",
          "hover:border-copper/40",
        )}
        aria-expanded={expanded}
      >
        <div className="flex items-center -space-x-0.5">
          {HAIL_LEGEND.slice(-5).map((b) => (
            <span
              key={b.label}
              className="inline-block h-3 w-3 rounded-full ring-1 ring-background"
              style={{ background: b.solid }}
            />
          ))}
        </div>
        <span className="text-xs font-medium text-foreground/80">Hail size</span>
        <IconChevronRight
          className={cn(
            "h-3.5 w-3.5 text-foreground/50 transition-transform",
            expanded && "rotate-90",
          )}
        />
      </button>

      {expanded && (
        <div className="glass mt-2 w-48 rounded-lg p-3 shadow-panel">
          <p className="text-[10px] font-mono uppercase tracking-wide-caps text-copper mb-2">
            Hail diameter
          </p>
          <ul className="space-y-1.5">
            {HAIL_LEGEND.map((b) => (
              <li key={b.label} className="flex items-center gap-2.5 text-xs">
                <span className="inline-block h-3.5 w-3.5 rounded-sm" style={{ background: b.solid }} />
                <span className="font-mono-num text-foreground/80">{b.label}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 pt-2 border-t border-border text-[10px] text-muted-foreground leading-relaxed">
            Live MRMS · refreshes every 2 min during active storms
          </p>
        </div>
      )}
    </div>
  );
}
