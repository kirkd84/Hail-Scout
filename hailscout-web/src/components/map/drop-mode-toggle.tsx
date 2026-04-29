"use client";

import { cn } from "@/lib/utils";
import { IconPin } from "@/components/icons";

interface Props {
  active: boolean;
  onToggle: () => void;
  /** Total marker count, displayed as a small badge. */
  count?: number;
}

/**
 * Floating pill that turns "drop a pin on click" mode on/off.
 *
 * When active:
 *  - Pill is filled copper, prominent
 *  - Cursor on the map becomes a crosshair (set in HailMap)
 *  - The next map click drops a marker
 */
export function DropModeToggle({ active, onToggle, count = 0 }: Props) {
  return (
    <div className="pointer-events-auto absolute bottom-6 right-4 z-20">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "glass flex items-center gap-2.5 rounded-full px-3.5 py-2.5 shadow-panel transition-all",
          active
            ? "border-copper bg-copper text-primary-foreground"
            : "hover:border-copper/40",
        )}
        aria-pressed={active}
      >
        <IconPin
          className={cn("h-4 w-4 transition-colors", active ? "text-primary-foreground" : "text-foreground/65")}
        />
        <span className={cn("text-xs font-medium", active ? "text-primary-foreground" : "text-foreground/85")}>
          {active ? "Drop on next click" : "Drop a pin"}
        </span>
        {count > 0 && (
          <span
            className={cn(
              "ml-1 inline-flex items-center justify-center rounded-full px-1.5 font-mono-num text-[10px]",
              active
                ? "bg-primary-foreground/20 text-primary-foreground"
                : "bg-foreground/10 text-foreground/65",
            )}
          >
            {count}
          </span>
        )}
      </button>
    </div>
  );
}
