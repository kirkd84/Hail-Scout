"use client";

/**
 * Map tools menu — a single bottom-right control that folds the two
 * canvassing actions (drop a pin, draw an area for leads) into one button,
 * replacing the separate always-on pills. Desktop only; mobile keeps its
 * own drop-pin pill.
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import { IconPin } from "@/components/icons";

interface Props {
  /** Drop-pin mode is armed (next map click drops a marker). */
  dropActive: boolean;
  onToggleDrop: () => void;
  /** Start the draw-area / sweep tool. */
  onDrawArea: () => void;
  markerCount?: number;
}

export function MapToolsMenu({
  dropActive,
  onToggleDrop,
  onDrawArea,
  markerCount = 0,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="pointer-events-auto absolute bottom-6 right-4 z-20 flex flex-col items-end gap-2">
      {open && (
        <div className="w-48 overflow-hidden rounded-lg border border-border bg-card/95 shadow-panel backdrop-blur supports-[backdrop-filter]:bg-card/85">
          <button
            type="button"
            onClick={() => {
              onToggleDrop();
              setOpen(false);
            }}
            className={cn(
              "flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm transition-colors hover:bg-secondary/40",
              dropActive ? "text-copper" : "text-foreground/85",
            )}
          >
            <IconPin className="h-4 w-4 shrink-0 text-foreground/65" />
            {dropActive ? "Drop on next click" : "Drop a pin"}
          </button>
          <button
            type="button"
            onClick={() => {
              onDrawArea();
              setOpen(false);
            }}
            className="flex w-full items-center gap-2.5 border-t border-border/60 px-3.5 py-2.5 text-left text-sm text-foreground/85 transition-colors hover:bg-secondary/40"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-foreground/65" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
              <polygon points="4,7 14,4 21,12 11,21 4,15" />
            </svg>
            Draw area for leads
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "glass flex items-center gap-2 rounded-full px-3.5 py-2.5 shadow-panel transition-all",
          dropActive || open ? "border-copper" : "hover:border-copper/40",
        )}
        aria-expanded={open}
        aria-label="Map tools"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-foreground/70" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
        <span className="text-xs font-medium text-foreground/85">Tools</span>
        {markerCount > 0 && (
          <span className="ml-0.5 inline-flex items-center justify-center rounded-full bg-foreground/10 px-1.5 font-mono-num text-[10px] text-foreground/65">
            {markerCount}
          </span>
        )}
      </button>
    </div>
  );
}
