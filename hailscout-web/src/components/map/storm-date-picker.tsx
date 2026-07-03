"use client";

/**
 * Storm date picker — the primary map control.
 *
 * Lists every distinct UTC storm DAY that hit the visible area (derived
 * from the storms already fetched for the viewport's history window).
 * The rep checks one day to view a single storm (the default — most
 * recent), or checks several to overlay them and see where an area was
 * hit more than once. Selecting nothing leaves the map clear.
 *
 * Replaces the old StormPicker + the date section of MapFilters. Size /
 * source / unverified filters fold into a collapsible "Filters" section
 * so the whole left rail is one panel instead of three.
 */

import { useMemo, useState } from "react";
import type { StormWithSwaths } from "@/hooks/useStorms";
import { nearestMetro } from "@/lib/metros";
import { hailColor } from "@/lib/hail";
import { statuteStatus, type SoLStatus } from "@/lib/time-ago";
import {
  SIZE_OPTIONS,
  SOURCE_OPTIONS,
  type SizeFilter,
  type SourceFilter,
} from "@/components/map/map-filters";
import { cn } from "@/lib/utils";

/** A single storm day rolled up from the storms in view. */
interface DayRow {
  date: string; // YYYY-MM-DD (UTC)
  count: number;
  maxSize: number;
  where: string;
  sol: SoLStatus | null;
}

function utcDay(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function solColor(days: number): string {
  if (days <= 14) return "#A8412D";
  if (days <= 30) return "#D88A3D";
  return "#C19A2E";
}

interface Props {
  storms: StormWithSwaths[];
  /** Currently rendered UTC days (YYYY-MM-DD). */
  selectedDates: string[];
  /** True when selection is auto-following "most recent" (vs hand-picked). */
  isRecentMode: boolean;
  onToggleDate: (date: string) => void;
  /** Snap back to "just the most recent storm". */
  onMostRecent: () => void;
  /** Clear the surface (show nothing until a day is picked). */
  onClear: () => void;
  scopeLabel?: string;
  /** True while the viewport storm fetch is in flight. */
  isLoading?: boolean;
  /** Filters (folded into the collapsible section). */
  size: SizeFilter;
  source: SourceFilter;
  showUnverified: boolean;
  onSizeChange: (s: SizeFilter) => void;
  onSourceChange: (s: SourceFilter) => void;
  onToggleUnverified: () => void;
}

export function StormDatePicker({
  storms,
  selectedDates,
  isRecentMode,
  onToggleDate,
  onMostRecent,
  onClear,
  scopeLabel,
  isLoading = false,
  size,
  source,
  showUnverified,
  onSizeChange,
  onSourceChange,
  onToggleUnverified,
}: Props) {
  const [open, setOpen] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Roll storms up into one row per UTC day.
  const days = useMemo<DayRow[]>(() => {
    const byDay = new Map<string, StormWithSwaths[]>();
    for (const s of storms) {
      const d = utcDay(s.start_time);
      const arr = byDay.get(d);
      if (arr) arr.push(s);
      else byDay.set(d, [s]);
    }
    const rows: DayRow[] = [];
    for (const [date, group] of byDay) {
      const biggest = group.reduce((a, b) =>
        b.max_hail_size_in > a.max_hail_size_in ? b : a,
      );
      const metro = nearestMetro(biggest.centroid_lat, biggest.centroid_lng);
      let sol: SoLStatus | null = null;
      for (const s of group) {
        const st = statuteStatus(s.start_time);
        if (st && (!sol || st.daysUntil < sol.daysUntil)) sol = st;
      }
      rows.push({
        date,
        count: group.length,
        maxSize: biggest.max_hail_size_in,
        where: metro?.label ?? "United States",
        sol,
      });
    }
    rows.sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first
    return rows;
  }, [storms]);

  const selected = new Set(selectedDates);
  const filtersActive = size !== "any" || source !== "all" || showUnverified;

  // NEVER return null — this panel is the map's primary control surface.
  // (It used to vanish entirely whenever the storms fetch came back empty,
  // e.g. for ~2 min around an API deploy — "the storm picker is gone".)
  // With no days we render the shell with a loading / empty message.

  const fmtDate = (d: string) => {
    const dt = new Date(d + "T00:00:00Z");
    return dt.toLocaleDateString(undefined, {
      month: "short",
      day: "2-digit",
      year: "numeric",
      timeZone: "UTC",
    });
  };
  const todayUTC = new Date().toISOString().slice(0, 10);

  return (
    <div className="pointer-events-auto absolute left-4 top-24 z-20 flex max-h-[calc(100vh-12rem)] w-72 flex-col overflow-hidden rounded-xl border border-border bg-card/95 shadow-panel backdrop-blur supports-[backdrop-filter]:bg-card/85">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between border-b border-border px-4 py-3 transition-colors hover:bg-secondary/40"
        aria-expanded={open}
      >
        <span className="flex items-baseline gap-2">
          <span className="font-mono-num text-[10px] uppercase tracking-wide-caps text-copper">
            Storm dates
          </span>
          <span className="font-mono-num text-[10px] text-muted-foreground">
            {scopeLabel ?? `${days.length} in view`}
          </span>
        </span>
        <span
          className={cn(
            "text-xs text-foreground/40 transition-transform",
            open ? "rotate-180" : "rotate-0",
          )}
          aria-hidden
        >
          ▾
        </span>
      </button>

      {open && days.length === 0 && (
        <p className="px-4 py-4 text-[12px] leading-snug text-muted-foreground">
          {isLoading
            ? "Loading storms…"
            : "No storms found in this view. Pan or zoom out — or loosen the filters below."}
        </p>
      )}

      {open && days.length > 0 && (
        <>
          <p className="px-4 pb-2 pt-2.5 text-[11px] leading-snug text-muted-foreground">
            Pick a day to view one storm — or check several to see where an
            area was hit more than once.
          </p>

          <ul className="divide-y divide-border/60 overflow-y-auto">
            {days.map((row) => {
              const c = hailColor(row.maxSize);
              const checked = selected.has(row.date);
              const isHeavy = row.maxSize >= 1.5;
              return (
                <li key={row.date}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-secondary/30",
                      checked && "bg-primary/5",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleDate(row.date)}
                      className="h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
                      aria-label={`Show storms on ${fmtDate(row.date)}`}
                    />
                    <span
                      className="inline-flex h-9 w-11 shrink-0 flex-col items-center justify-center rounded-md shadow-sm ring-1 ring-foreground/15"
                      style={{ background: c.solid, color: isHeavy ? "#FAF7F1" : c.text }}
                    >
                      <span className="font-mono-num text-xs font-medium leading-none">
                        {row.maxSize.toFixed(2)}″
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {row.date === todayUTC ? "Today" : fmtDate(row.date)}
                      </span>
                      <span className="block truncate font-mono-num text-[11px] text-muted-foreground">
                        {row.where}
                        {row.count > 1 ? ` · ${row.count} cells` : ""}
                      </span>
                      {row.sol && (
                        <span
                          className="mt-1 inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-mono-num text-[10px] font-medium"
                          style={{
                            background: `${solColor(row.sol.daysUntil)}1f`,
                            color: solColor(row.sol.daysUntil),
                          }}
                          title={`${row.sol.deadline}-year claim deadline`}
                        >
                          <span aria-hidden>⏳</span>
                          {row.sol.deadline}-yr deadline · {row.sol.daysUntil}d
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          {/* Selection summary + quick actions */}
          <div className="flex items-center justify-between gap-2 border-t border-border/60 px-4 py-2">
            <span className="font-mono-num text-[10px] text-foreground/60">
              {selectedDates.length === 0
                ? "none shown"
                : selectedDates.length === 1
                ? "1 day shown"
                : `${selectedDates.length} days · overlap = repeat hits`}
            </span>
            <span className="flex items-center gap-2">
              {!isRecentMode && (
                <button
                  type="button"
                  onClick={onMostRecent}
                  className="text-[10px] font-mono uppercase tracking-wide-caps text-copper hover:text-copper-700"
                >
                  Most recent
                </button>
              )}
              {selectedDates.length > 0 && (
                <button
                  type="button"
                  onClick={onClear}
                  className="text-[10px] font-mono uppercase tracking-wide-caps text-foreground/55 hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </span>
          </div>
        </>
      )}

      {open && (
        <>
          {/* Collapsible filters — rendered even when no days are listed,
              so the panel's controls never disappear with an empty fetch. */}
          <div className="border-t border-border/60">
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-2 transition-colors hover:bg-secondary/30"
              aria-expanded={filtersOpen}
            >
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-foreground/80">
                <svg viewBox="0 0 16 16" className="h-3 w-3 text-foreground/60" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M2 4 H14 M4 8 H12 M6 12 H10" />
                </svg>
                Filters
                {filtersActive && (
                  <span className="h-1.5 w-1.5 rounded-full bg-copper" aria-hidden />
                )}
              </span>
              <span className={cn("text-xs text-foreground/40 transition-transform", filtersOpen ? "rotate-180" : "rotate-0")} aria-hidden>▾</span>
            </button>

            {filtersOpen && (
              <div className="space-y-3 px-4 pb-3 pt-1">
                <div>
                  <p className="mb-1.5 text-[10px] font-mono uppercase tracking-wide-caps text-copper">Min hail size</p>
                  <div className="grid grid-cols-2 gap-1">
                    {SIZE_OPTIONS.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => onSizeChange(o.id)}
                        className={cn(
                          "rounded-md px-2.5 py-1.5 font-mono-num text-xs font-medium transition-colors",
                          size === o.id ? "bg-primary text-primary-foreground" : "text-foreground/75 hover:bg-foreground/5",
                        )}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-[10px] font-mono uppercase tracking-wide-caps text-copper">Data source</p>
                  <div className="grid grid-cols-1 gap-1">
                    {SOURCE_OPTIONS.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => onSourceChange(o.id)}
                        className={cn(
                          "rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-colors",
                          source === o.id ? "bg-primary text-primary-foreground" : "text-foreground/75 hover:bg-foreground/5",
                        )}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onToggleUnverified}
                  className="flex w-full items-center justify-between"
                  aria-pressed={showUnverified}
                >
                  <span className="text-xs text-foreground/85">Unverified cells</span>
                  <span className={cn("relative inline-flex h-4 w-7 items-center rounded-full transition-colors", showUnverified ? "bg-primary" : "bg-foreground/25")}>
                    <span className={cn("inline-block h-3 w-3 rounded-full bg-white shadow transition-transform", showUnverified ? "translate-x-3.5" : "translate-x-0.5")} />
                  </span>
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
