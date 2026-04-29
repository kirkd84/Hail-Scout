"use client";

import { cn } from "@/lib/utils";

export type BasemapId = "atlas" | "streets" | "satellite" | "hybrid";

interface BasemapToggleProps {
  value: BasemapId;
  onChange: (next: BasemapId) => void;
  className?: string;
}

const OPTIONS: { id: BasemapId; label: string; icon: React.ReactNode }[] = [
  {
    id: "atlas",
    label: "Atlas",
    icon: (
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4">
        <ellipse cx="8" cy="8" rx="6.5" ry="4" />
        <ellipse cx="8" cy="8" rx="4" ry="2.5" />
        <circle cx="8" cy="8" r="1.2" />
      </svg>
    ),
  },
  {
    id: "streets",
    label: "Streets",
    icon: (
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <path d="M3 2 L3 14" />
        <path d="M9 2 L9 14" />
        <path d="M2 5 L14 5" />
        <path d="M2 11 L14 11" />
      </svg>
    ),
  },
  {
    id: "satellite",
    label: "Satellite",
    icon: (
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4">
        <circle cx="8" cy="8" r="6" />
        <path d="M2.5 9 Q8 5.5 13.5 9" />
        <path d="M2.5 7 Q8 10.5 13.5 7" />
      </svg>
    ),
  },
  {
    id: "hybrid",
    label: "Hybrid",
    icon: (
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4">
        <rect x="2" y="2" width="12" height="12" rx="1.5" />
        <path d="M2 8 H14" />
        <path d="M8 2 V14" strokeDasharray="1.4 1.4" />
      </svg>
    ),
  },
];

/**
 * Glass-morphism segmented control for swapping the basemap layer.
 *
 * Lives at the bottom-center of the map (above MapLibre attribution,
 * below the user-content area). Reads as "Apple Maps layers chip"
 * crossed with "Linear segmented control".
 */
export function BasemapToggle({ value, onChange, className }: BasemapToggleProps) {
  return (
    <div
      className={cn(
        "glass pointer-events-auto inline-flex rounded-full p-1 shadow-panel",
        className,
      )}
      role="tablist"
      aria-label="Map style"
    >
      {OPTIONS.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
              active
                ? "bg-primary text-primary-foreground shadow-atlas"
                : "text-foreground/75 hover:bg-muted hover:text-foreground",
            )}
          >
            <span className={cn(active ? "text-primary-foreground" : "text-foreground/60")}>
              {opt.icon}
            </span>
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
