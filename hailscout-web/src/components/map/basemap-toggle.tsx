"use client";

import { cn } from "@/lib/utils";

export type BasemapId = "atlas" | "streets" | "satellite" | "hybrid";

interface BasemapToggleProps {
  value: BasemapId;
  onChange: (next: BasemapId) => void;
  className?: string;
}

// Two basemaps only, both label-bearing (hail hunting needs street names):
//   • Classic   — the navigation map (atlas / Voyager, dark-mode aware).
//   • Satellite — aerial imagery WITH street labels (the MapTiler "hybrid"
//     style). The old label-less "satellite" and the redundant "streets"
//     (identical to Classic in dark mode) were removed.
const OPTIONS: { id: BasemapId; label: string; icon: React.ReactNode }[] = [
  {
    id: "atlas",
    label: "Classic",
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
    id: "hybrid",
    label: "Satellite",
    icon: (
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4">
        <circle cx="8" cy="8" r="6" />
        <path d="M2.5 9 Q8 5.5 13.5 9" />
        <path d="M2.5 7 Q8 10.5 13.5 7" />
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
