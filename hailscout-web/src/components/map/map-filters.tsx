"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { IconChevronRight } from "@/components/icons";

export type DateFilter = "24h" | "7d" | "30d" | "all";
export type SizeFilter = "any" | "1.0" | "1.75" | "2.5";

const DATE_OPTIONS: { id: DateFilter; label: string; days: number | null }[] = [
  { id: "24h", label: "24 hr",  days: 1 },
  { id: "7d",  label: "7 days", days: 7 },
  { id: "30d", label: "30 days", days: 30 },
  { id: "all", label: "All",    days: null },
];

const SIZE_OPTIONS: { id: SizeFilter; label: string; min: number }[] = [
  { id: "any",  label: "Any size", min: 0 },
  { id: "1.0",  label: "≥ 1.0″",   min: 1.0  },
  { id: "1.75", label: "≥ 1.75″",  min: 1.75 },
  { id: "2.5",  label: "≥ 2.5″",   min: 2.5  },
];

export function dateFilterToCutoff(f: DateFilter): number | null {
  const opt = DATE_OPTIONS.find((o) => o.id === f);
  if (!opt || opt.days === null) return null;
  return Date.now() - opt.days * 24 * 60 * 60 * 1000;
}

export function sizeFilterToMin(f: SizeFilter): number {
  return SIZE_OPTIONS.find((o) => o.id === f)?.min ?? 0;
}

interface Props {
  date: DateFilter;
  size: SizeFilter;
  onDateChange: (next: DateFilter) => void;
  onSizeChange: (next: SizeFilter) => void;
}

export function MapFilters({ date, size, onDateChange, onSizeChange }: Props) {
  const [open, setOpen] = useState(false);

  const activeDate = DATE_OPTIONS.find((o) => o.id === date)!;
  const activeSize = SIZE_OPTIONS.find((o) => o.id === size)!;
  const filtersActive = date !== "all" || size !== "any";

  return (
    <div className="pointer-events-auto absolute top-24 left-4 z-20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "glass flex items-center gap-2 rounded-full px-3 py-2 shadow-panel transition-all",
          filtersActive ? "border-copper/60" : "hover:border-copper/40",
        )}
        aria-expanded={open}
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-foreground/65" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 4 H14 M4 8 H12 M6 12 H10" />
        </svg>
        <span className="text-xs font-medium text-foreground/85">Filter</span>
        {filtersActive && (
          <span className="font-mono text-[10px] uppercase tracking-wide-caps text-copper">
            {activeDate.id !== "all" ? activeDate.id : ""}{" "}
            {activeSize.id !== "any" ? `· ${activeSize.label.replace("≥ ", "")}` : ""}
          </span>
        )}
        <IconChevronRight
          className={cn(
            "h-3.5 w-3.5 text-foreground/50 transition-transform",
            open && "rotate-90",
          )}
        />
      </button>

      {open && (
        <div className="glass mt-2 w-64 rounded-lg p-3 shadow-panel space-y-4">
          <div>
            <p className="mb-1.5 text-[10px] font-mono uppercase tracking-wide-caps text-copper">
              Date range
            </p>
            <div className="grid grid-cols-2 gap-1">
              {DATE_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => onDateChange(o.id)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    date === o.id
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground/75 hover:bg-foreground/5",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-mono uppercase tracking-wide-caps text-copper">
              Min hail size
            </p>
            <div className="grid grid-cols-2 gap-1">
              {SIZE_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => onSizeChange(o.id)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium font-mono-num transition-colors",
                    size === o.id
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground/75 hover:bg-foreground/5",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {filtersActive && (
            <button
              type="button"
              onClick={() => {
                onDateChange("all");
                onSizeChange("any");
              }}
              className="w-full text-center text-[11px] font-mono uppercase tracking-wide-caps text-copper hover:text-copper-700 pt-2 border-t border-border"
            >
              Reset filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
