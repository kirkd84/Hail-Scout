"use client";

/**
 * Mobile map control center.
 *
 * On phones the map page used to float nine separate widgets (search,
 * filters, legend, picker, activity feed, sweep tool, scrubber, basemap +
 * view toggles, drop mode) — unusable on a ~390px screen. On mobile
 * everything except search + drop-pin folds into this single bottom-sheet,
 * opened from one "Map controls" button.
 *
 * Sections: view mode · basemap · filters (date / specific day / size /
 * source) · unverified toggle · hail-size legend · recent storms.
 */

import { useMemo, useState } from "react";
import type { Storm } from "@/lib/api-types";
import { HAIL_LEGEND, hailColor } from "@/lib/hail";
import { nearestMetro } from "@/lib/metros";
import { cn } from "@/lib/utils";
import { BasemapToggle, type BasemapId } from "@/components/map/basemap-toggle";
import {
  SIZE_OPTIONS,
  SOURCE_OPTIONS,
  type SizeFilter,
  type SourceFilter,
} from "@/components/map/map-filters";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type ViewMode = "cells" | "smooth" | "heatmap";

interface Props {
  viewMode: ViewMode;
  onViewMode: (v: ViewMode) => void;
  basemap: BasemapId;
  onBasemap: (b: BasemapId) => void;
  size: SizeFilter;
  onSizeChange: (s: SizeFilter) => void;
  source: SourceFilter;
  onSourceChange: (s: SourceFilter) => void;
  selectedDates: string[];
  isRecentMode: boolean;
  onToggleDate: (day: string) => void;
  onMostRecent: () => void;
  onClear: () => void;
  showUnverified: boolean;
  onToggleUnverified: () => void;
  storms: Storm[];
  onStormClick: (storm: Storm) => void;
}

const VIEW_OPTIONS: { id: ViewMode; label: string }[] = [
  { id: "smooth", label: "Smooth" },
  { id: "cells", label: "Cells" },
  { id: "heatmap", label: "Heatmap" },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[10px] font-mono uppercase tracking-wide-caps text-copper">
      {children}
    </p>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        // 44px-ish touch targets
        "rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-secondary/60 text-foreground/80",
      )}
    >
      {children}
    </button>
  );
}

interface DayRow {
  date: string;
  maxSize: number;
  count: number;
  where: string;
}

/** The storm-day multi-select list. Shared by the full "Map controls" sheet
 *  and the dedicated "Storm date" sheet behind the map pill. */
function DayList({
  days,
  selected,
  todayStr,
  onToggle,
}: {
  days: DayRow[];
  selected: Set<string>;
  todayStr: string;
  onToggle: (day: string) => void;
}) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
      {days.map((row) => {
        const c = hailColor(row.maxSize);
        const checked = selected.has(row.date);
        return (
          <li key={row.date}>
            <button
              type="button"
              onClick={() => onToggle(row.date)}
              className={cn(
                "flex w-full items-center gap-3 px-3 py-2.5 text-left",
                checked ? "bg-primary/5" : "bg-card",
              )}
              aria-pressed={checked}
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[11px]",
                  checked
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border",
                )}
                aria-hidden
              >
                {checked ? "✓" : ""}
              </span>
              <span
                className="inline-flex w-14 shrink-0 items-center justify-center rounded-md py-1 font-mono-num text-xs font-medium"
                style={{
                  background: c.solid,
                  color: row.maxSize >= 1.5 ? "#FAF7F1" : c.text,
                }}
              >
                {row.maxSize.toFixed(2)}″
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-foreground/90">
                  {row.date === todayStr
                    ? "Today"
                    : new Date(row.date + "T00:00:00Z").toLocaleDateString(undefined, {
                        month: "short",
                        day: "2-digit",
                        year: "numeric",
                        timeZone: "UTC",
                      })}
                </span>
                <span className="block font-mono-num text-[11px] text-foreground/55">
                  {row.where}
                  {row.count > 1 ? ` · ${row.count} cells` : ""}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Short label for the map date pill: the day being shown right now. */
function dayLabel(day: string, todayStr: string): string {
  if (day === todayStr) return "Today";
  return new Date(day + "T00:00:00Z").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function MobileMapControls(props: Props) {
  const [open, setOpen] = useState(false);
  // Dedicated storm-date sheet. Dates were previously buried three sections
  // deep in the controls sheet, so on a phone there was no visible way to
  // pick a storm day (field feedback: "I'd like to search hail maps by storm
  // date"). The pill below surfaces the current day and opens just this.
  const [dateOpen, setDateOpen] = useState(false);
  const filtersActive =
    props.size !== "any" || props.source !== "all" || props.showUnverified;

  // Distinct storm days in view, newest first — the multi-select date list.
  const days = useMemo(() => {
    const byDay = new Map<string, Storm[]>();
    for (const s of props.storms) {
      const d = new Date(s.start_time).toISOString().slice(0, 10);
      const arr = byDay.get(d);
      if (arr) arr.push(s);
      else byDay.set(d, [s]);
    }
    return [...byDay.entries()]
      .map(([date, group]) => {
        const biggest = group.reduce((a, b) =>
          b.max_hail_size_in > a.max_hail_size_in ? b : a,
        );
        return {
          date,
          maxSize: biggest.max_hail_size_in,
          count: group.length,
          where:
            nearestMetro(biggest.centroid_lat, biggest.centroid_lng)?.label ??
            "United States",
        };
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [props.storms]);
  const todayStr = new Date().toISOString().slice(0, 10);
  const selected = new Set(props.selectedDates);

  const recent = [...props.storms]
    .sort(
      (a, b) =>
        new Date(b.start_time).getTime() - new Date(a.start_time).getTime(),
    )
    .slice(0, 8);

  // What the date pill reads right now.
  const pillLabel = (() => {
    if (props.selectedDates.length === 0) {
      return days.length ? "Pick a storm date" : "No storms in view";
    }
    if (props.selectedDates.length === 1) {
      const d = dayLabel(props.selectedDates[0], todayStr);
      return props.isRecentMode ? `Latest · ${d}` : d;
    }
    return `${props.selectedDates.length} storm days`;
  })();

  return (
    <>
      {/* Storm-date pill — sits under the address search. Picking the storm
          day is the control a rep reaches for most, so it's visible on the
          map instead of buried inside the controls sheet. */}
      <div className="pointer-events-none absolute inset-x-0 top-[4.75rem] z-20 flex justify-center px-4">
        <button
          type="button"
          onClick={() => setDateOpen(true)}
          className="glass pointer-events-auto flex max-w-full items-center gap-2 rounded-full px-3.5 py-2 shadow-panel"
          aria-haspopup="dialog"
        >
          <svg
            viewBox="0 0 16 16"
            className="h-3.5 w-3.5 shrink-0 text-copper"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <rect x="2" y="3.5" width="12" height="10" rx="1.5" />
            <path d="M2 6.5 H14 M5.5 2 V4.5 M10.5 2 V4.5" />
          </svg>
          <span className="truncate text-xs font-medium text-foreground/85">
            {pillLabel}
          </span>
          <svg
            viewBox="0 0 16 16"
            className="h-3 w-3 shrink-0 text-foreground/45"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          >
            <path d="M4 6 L8 10 L12 6" />
          </svg>
        </button>
      </div>

      {/* Focused storm-date sheet */}
      <Sheet open={dateOpen} onOpenChange={setDateOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[82vh] overflow-y-auto rounded-t-2xl border-t border-border bg-card p-0 pb-[env(safe-area-inset-bottom)]"
        >
          <SheetHeader className="px-5 pt-5 pb-2">
            <p className="text-[10px] font-mono uppercase tracking-wide-caps text-copper">
              Storm date
            </p>
            <SheetTitle className="font-display text-xl font-medium tracking-tight-display">
              Which storm?
            </SheetTitle>
          </SheetHeader>

          <div className="px-5 pb-8 pt-2">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-[11px] text-muted-foreground">
                Tap a day for one storm — or several to see repeat hits.
              </p>
              <span className="flex shrink-0 items-center gap-3">
                {!props.isRecentMode && (
                  <button
                    type="button"
                    onClick={props.onMostRecent}
                    className="text-[10px] font-mono uppercase tracking-wide-caps text-copper"
                  >
                    Latest
                  </button>
                )}
                {props.selectedDates.length > 0 && (
                  <button
                    type="button"
                    onClick={props.onClear}
                    className="text-[10px] font-mono uppercase tracking-wide-caps text-foreground/55"
                  >
                    Clear
                  </button>
                )}
              </span>
            </div>

            {days.length === 0 ? (
              <p className="text-xs text-muted-foreground">No storms in view.</p>
            ) : (
              <DayList
                days={days}
                selected={selected}
                todayStr={todayStr}
                onToggle={props.onToggleDate}
              />
            )}

            <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
              Showing storm days in the area you&apos;re viewing. Zoom into a city
              to go further back — the map loads up to 5 years of history at
              street level.
            </p>
          </div>
        </SheetContent>
      </Sheet>

      {/* Single launcher — bottom-left, mirrors the drop-pin pill on the right. */}
      <div className="pointer-events-auto absolute bottom-6 left-4 z-20 pb-[env(safe-area-inset-bottom)]">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "glass flex items-center gap-2 rounded-full px-3.5 py-2.5 shadow-panel",
            filtersActive ? "border-copper/60" : "",
          )}
          aria-haspopup="dialog"
        >
          <svg
            viewBox="0 0 16 16"
            className="h-4 w-4 text-foreground/70"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <path d="M2 4 H14 M4 8 H12 M6 12 H10" />
          </svg>
          <span className="text-xs font-medium text-foreground/85">Map controls</span>
          {filtersActive && (
            <span className="h-1.5 w-1.5 rounded-full bg-copper" aria-hidden />
          )}
        </button>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[82vh] overflow-y-auto rounded-t-2xl border-t border-border bg-card p-0 pb-[env(safe-area-inset-bottom)]"
        >
          <SheetHeader className="px-5 pt-5 pb-2">
            <p className="text-[10px] font-mono uppercase tracking-wide-caps text-copper">
              Map controls
            </p>
            <SheetTitle className="font-display text-xl font-medium tracking-tight-display">
              View, filters &amp; legend
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-6 px-5 pb-8 pt-2">
            {/* View mode */}
            <div>
              <SectionLabel>Swath view</SectionLabel>
              <div className="grid grid-cols-3 gap-1.5">
                {VIEW_OPTIONS.map((o) => (
                  <Chip
                    key={o.id}
                    active={props.viewMode === o.id}
                    onClick={() => props.onViewMode(o.id)}
                  >
                    {o.label}
                  </Chip>
                ))}
              </div>
            </div>

            {/* Basemap (reuses the desktop segmented control) */}
            <div>
              <SectionLabel>Basemap</SectionLabel>
              <BasemapToggle
                value={props.basemap}
                onChange={props.onBasemap}
                className="w-full justify-between"
              />
            </div>

            {/* Storm dates — multi-select */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <SectionLabel>Storm dates</SectionLabel>
                <span className="flex items-center gap-3">
                  {!props.isRecentMode && (
                    <button
                      type="button"
                      onClick={props.onMostRecent}
                      className="text-[10px] font-mono uppercase tracking-wide-caps text-copper"
                    >
                      Most recent
                    </button>
                  )}
                  {props.selectedDates.length > 0 && (
                    <button
                      type="button"
                      onClick={props.onClear}
                      className="text-[10px] font-mono uppercase tracking-wide-caps text-foreground/55"
                    >
                      Clear
                    </button>
                  )}
                </span>
              </div>
              <p className="mb-2 text-[11px] text-muted-foreground">
                Tap a day for one storm — or several to see repeat hits.
              </p>
              {days.length === 0 ? (
                <p className="text-xs text-muted-foreground">No storms in view.</p>
              ) : (
                <DayList
                  days={days}
                  selected={selected}
                  todayStr={todayStr}
                  onToggle={props.onToggleDate}
                />
              )}
            </div>

            {/* Min size */}
            <div>
              <SectionLabel>Min hail size</SectionLabel>
              <div className="grid grid-cols-4 gap-1.5">
                {SIZE_OPTIONS.map((o) => (
                  <Chip
                    key={o.id}
                    active={props.size === o.id}
                    onClick={() => props.onSizeChange(o.id)}
                  >
                    <span className="font-mono-num">
                      {o.id === "any" ? "Any" : o.label.replace("≥ ", "≥")}
                    </span>
                  </Chip>
                ))}
              </div>
            </div>

            {/* Source */}
            <div>
              <SectionLabel>Data source</SectionLabel>
              <div className="grid grid-cols-3 gap-1.5">
                {SOURCE_OPTIONS.map((o) => (
                  <Chip
                    key={o.id}
                    active={props.source === o.id}
                    onClick={() => props.onSourceChange(o.id)}
                  >
                    {o.id === "all" ? "All" : o.id}
                  </Chip>
                ))}
              </div>
            </div>

            {/* Unverified toggle */}
            <button
              type="button"
              onClick={props.onToggleUnverified}
              className="flex w-full items-center justify-between rounded-lg border border-border bg-secondary/40 px-4 py-3"
              aria-pressed={props.showUnverified}
            >
              <span className="text-sm text-foreground/85">
                Show unverified cells
                <span className="block text-[11px] text-muted-foreground">
                  Radar-only, not yet cross-confirmed — drawn dimmed
                </span>
              </span>
              <span
                className={cn(
                  "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
                  props.showUnverified ? "bg-primary" : "bg-foreground/25",
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
                    props.showUnverified ? "translate-x-4" : "translate-x-0.5",
                  )}
                />
              </span>
            </button>

            {/* Legend */}
            <div>
              <SectionLabel>Hail size legend</SectionLabel>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {[...HAIL_LEGEND].reverse().map((b) => (
                  <div key={b.short} className="flex items-center gap-2 text-xs">
                    <span
                      className="inline-block h-3.5 w-3.5 shrink-0 rounded-sm ring-1 ring-foreground/10"
                      style={{ background: b.solid }}
                    />
                    <span className="font-mono-num text-foreground/85">{b.short}</span>
                    <span className="truncate text-foreground/55">{b.object}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent storms */}
            {recent.length > 0 && (
              <div>
                <SectionLabel>Recent storms in view</SectionLabel>
                <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                  {recent.map((s) => {
                    const c = hailColor(s.max_hail_size_in);
                    const where = nearestMetro(s.centroid_lat, s.centroid_lng);
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setOpen(false);
                            props.onStormClick(s);
                          }}
                          className="flex w-full items-center gap-3 bg-card px-3 py-2.5 text-left"
                        >
                          <span
                            className="inline-flex w-14 shrink-0 items-center justify-center rounded-md py-1 font-mono-num text-xs font-medium"
                            style={{
                              background: c.solid,
                              color: s.max_hail_size_in >= 1.5 ? "#FAF7F1" : c.text,
                            }}
                          >
                            {s.max_hail_size_in.toFixed(2)}″
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-foreground/90">
                              {where?.label ?? "United States"}
                            </span>
                            <span className="block font-mono-num text-[11px] text-foreground/55">
                              {new Date(s.start_time).toLocaleDateString(undefined, {
                                month: "short",
                                day: "2-digit",
                                year: "numeric",
                              })}
                              {s.lsr_confirmed ? " · ✓ confirmed" : ""}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
