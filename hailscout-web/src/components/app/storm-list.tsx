"use client";

import type { Storm } from "@/lib/api-types";
import { formatDateTime } from "@/lib/utils";
import { hailColor } from "@/lib/hail";
import { IconChevronRight } from "@/components/icons";

interface StormListProps {
  storms: Storm[];
  onStormClick?: (storm: Storm) => void;
}

/**
 * Atlas-card list of storms at an address.
 *
 * Each card is its own field-guide entry:
 *  - copper-tinted hail-size badge (color encodes severity)
 *  - date + max hail in display serif
 *  - quiet metadata row (live/historical, source)
 */
export function StormList({ storms, onStormClick }: StormListProps) {
  if (storms.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card px-6 py-10 text-center">
        <p className="font-display text-lg text-foreground">No storms on record.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          This address has no documented hail in the past 15 years.
        </p>
      </div>
    );
  }

  // Sort by date desc — latest first
  const sorted = [...storms].sort(
    (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime(),
  );

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-mono uppercase tracking-wide-caps text-copper">
        Storms at this location · {storms.length}
      </p>
      <ul className="space-y-2">
        {sorted.map((storm) => {
          const c = hailColor(storm.max_hail_size_in);
          return (
            <li key={storm.id}>
              <button
                type="button"
                onClick={() => onStormClick?.(storm)}
                className="w-full text-left group rounded-lg border border-border bg-card px-4 py-3 transition-all hover:border-copper/50 hover:shadow-atlas"
              >
                <div className="flex items-center gap-4">
                  <div
                    className="flex h-12 w-14 shrink-0 flex-col items-center justify-center rounded-md border"
                    style={{ background: c.bg, borderColor: c.border }}
                  >
                    <span className="font-mono-num text-sm font-medium leading-none" style={{ color: c.text }}>
                      {storm.max_hail_size_in.toFixed(2)}″
                    </span>
                    <span className="mt-0.5 text-[9px] uppercase tracking-wide-caps font-mono leading-none" style={{ color: c.text, opacity: 0.75 }}>
                      {c.object}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-base text-foreground">
                      {formatDateTime(storm.start_time)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground flex items-center gap-2">
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ background: storm.source === "mrms" ? "hsl(var(--copper-500))" : "hsl(var(--muted-foreground))" }}
                      />
                      <span>{storm.source === "mrms" ? "Live MRMS" : "Historical archive"}</span>
                    </p>
                  </div>
                  <IconChevronRight className="h-4 w-4 shrink-0 text-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-copper" />
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
