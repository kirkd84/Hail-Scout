"use client";

import { useState } from "react";
import { HAIL_LEGEND } from "@/lib/hail";
import { IconChevronRight } from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * Hail-size legend — industry-standard palette with reference object names.
 *
 * Default: a tight glass pill with a horizontal color ramp preview.
 * Click expands to a vertical list with size threshold and object name
 * (penny / quarter / golf ball / baseball / softball) so contractors
 * switching from HailTrace or IHM see the exact same vocabulary.
 */
export function SwathLegend() {
  const [expanded, setExpanded] = useState(false);

  // Reverse for display so the heaviest hail sits at the top of the list
  const ramp = [...HAIL_LEGEND].reverse();

  return (
    <div className="pointer-events-auto absolute top-24 right-4 z-20">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          "glass flex items-center gap-2.5 rounded-full px-3 py-2 shadow-panel transition-all",
          "hover:border-copper/40",
        )}
        aria-expanded={expanded}
      >
        <div className="flex items-center -space-x-0.5">
          {/* Mini ramp preview — show 7 stops */}
          {ramp.slice(0, 7).reverse().map((b) => (
            <span
              key={b.short}
              className="inline-block h-3 w-3 rounded-full ring-1 ring-background"
              style={{ background: b.solid }}
            />
          ))}
        </div>
        <span className="text-xs font-medium text-foreground/85">Hail size</span>
        <IconChevronRight
          className={cn(
            "h-3.5 w-3.5 text-foreground/50 transition-transform",
            expanded && "rotate-90",
          )}
        />
      </button>

      {expanded && (
        <div className="glass mt-2 w-60 rounded-lg p-3 shadow-panel">
          <div className="flex items-baseline justify-between mb-2">
            <p className="text-[10px] font-mono uppercase tracking-wide-caps text-copper">
              Hail diameter
            </p>
            <p className="text-[10px] font-mono uppercase tracking-wide-caps text-foreground/40">
              MRMS · NWS
            </p>
          </div>
          <ul className="space-y-1.5">
            {ramp.map((b) => (
              <li key={b.short} className="flex items-center gap-2.5 text-xs">
                <span
                  className="inline-block h-3.5 w-3.5 rounded-sm ring-1 ring-foreground/10"
                  style={{ background: b.solid }}
                />
                <span className="font-mono-num text-foreground/85 w-12">{b.short}</span>
                <span className="text-foreground/55 truncate">{b.object}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 pt-2 border-t border-border text-[10px] text-muted-foreground leading-relaxed">
            Same color scale as HailTrace and Interactive Hail Maps. Refreshes every 2 min during active storms.
          </p>
        </div>
      )}
    </div>
  );
}
