"use client";

/**
 * Live radar control + legend.
 *
 * The whole point of this panel is that a roofer — not a meteorologist —
 * can read the map at a glance. So: one switch labelled "Live radar", a
 * play/pause for the loop, a "Now" button that always gets you back to the
 * newest frame, and a legend in words ("Hail falling", "Hail likely",
 * "Storm") instead of MESH/POSH/dBZ.
 *
 * It also states the truth about freshness: how old the newest frame is, and
 * — when there's nothing — "No live radar right now" rather than an empty
 * panel that implies data exists.
 *
 * Sits top-right on both desktop and mobile, clear of the address search
 * above it, the bottom dock, and the mobile controls sheet. Every control is
 * at least 44px tall for thumbs.
 */

import { hailColor } from "@/lib/hail";
import { cn } from "@/lib/utils";
import type { LiveRadarState } from "@/hooks/useRadarFrames";

/**
 * The three sizes worth calling out, colored from the app's canonical hail
 * ramp so the legend matches the swath surface (and the rendered frames).
 */
const HAIL_FALLING: { sizeIn: number; label: string }[] = [
  { sizeIn: 1.0, label: "1.0in" },
  { sizeIn: 1.75, label: "1.75in" },
  { sizeIn: 2.5, label: "2.5in+" },
];

/** Amber — "hail likely" (the probability layer). */
const LIKELY_COLOR = "#F0A12C";
/** Muted blue-grey — the storm itself, deliberately quiet under the hail. */
const STORM_COLOR = "#6B87A8";

/** Swatch colour for a hail size.
 *
 * MUST come from the same table the pipeline renders with. The frames are
 * painted from radar_ramps.MESH_RAMP, which mirrors `BINS[].solid` — i.e.
 * exactly what hailColor() returns. Reading SMOOTH_RAMP here instead put a
 * dark-raspberry 2.5" swatch next to a light-magenta 2.5" pixel, so a rep
 * matching pixel to legend would read the wrong size off the map.
 */
function rampHex(sizeIn: number): string {
  return hailColor(sizeIn).solid;
}

/** "Updated 2 min ago" — plain, and honest about staleness. */
function freshnessLabel(iso: string | null): string | null {
  if (!iso) return null;
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return null;
  const mins = Math.floor((Date.now() - ts) / 60_000);
  if (mins <= 0) return "Updated just now";
  if (mins === 1) return "Updated 1 min ago";
  if (mins < 60) return `Updated ${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return hrs === 1 ? "Updated 1 hour ago" : `Updated ${hrs} hours ago`;
}

/** Local wall-clock time of the frame on screen, e.g. "7:42 PM". */
function clockLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** How far back in the loop the current frame is. */
function offsetLabel(currentIso: string, newestIso: string | null): string {
  if (!newestIso) return "";
  const mins = Math.round(
    (Date.parse(newestIso) - Date.parse(currentIso)) / 60_000,
  );
  if (!Number.isFinite(mins) || mins <= 0) return "Right now";
  return `${mins} min earlier`;
}

interface Props {
  radar: LiveRadarState;
  /** Shifts clear of the mobile storm-date pill instead of the desktop dock. */
  isMobile?: boolean;
  className?: string;
}

export function LiveRadarControl({ radar, isMobile = false, className }: Props) {
  const hasFrames = radar.steps.length > 0;
  const freshness = freshnessLabel(radar.newestAt);

  return (
    <div
      className={cn(
        "pointer-events-auto absolute z-20 flex flex-col items-end",
        // Mobile: under the storm-date pill, opposite the drop-pin button.
        // Desktop: under the address search, above the sweep panel.
        isMobile ? "right-3 top-[7.5rem]" : "right-4 top-24",
        className,
      )}
    >
      <button
        type="button"
        onClick={radar.toggle}
        aria-pressed={radar.enabled}
        className={cn(
          "glass flex min-h-[44px] items-center gap-2 rounded-full px-3.5 shadow-panel transition-all",
          radar.enabled ? "border-copper" : "hover:border-copper/40",
        )}
      >
        <RadarIcon
          className={cn(
            "h-4 w-4",
            radar.enabled ? "text-copper" : "text-foreground/60",
          )}
        />
        <span className="text-xs font-medium text-foreground/85">Live radar</span>
        <span
          className={cn(
            "relative h-5 w-9 shrink-0 rounded-full transition-colors",
            radar.enabled ? "bg-primary" : "bg-foreground/20",
          )}
          aria-hidden
        >
          <span
            className={cn(
              "absolute top-0.5 h-4 w-4 rounded-full bg-background shadow-sm transition-all",
              radar.enabled ? "left-[1.125rem]" : "left-0.5",
            )}
          />
        </span>
      </button>

      {radar.enabled && (
        <div className="glass mt-2 w-[15.5rem] max-w-[calc(100vw-1.5rem)] rounded-lg p-3 shadow-panel">
          {hasFrames ? (
            <LoopControls radar={radar} freshness={freshness} />
          ) : (
            <EmptyState isLoading={radar.isLoading} hasError={!!radar.error} />
          )}

          {hasFrames && <Legend />}
        </div>
      )}
    </div>
  );
}

/** Play/pause + where we are in the loop + "Now". */
function LoopControls({
  radar,
  freshness,
}: {
  radar: LiveRadarState;
  freshness: string | null;
}) {
  const current = radar.current;
  const canAnimate = radar.steps.length > 1;
  // Position through the loop, for the progress bar.
  const progress =
    radar.steps.length > 1 ? radar.index / (radar.steps.length - 1) : 1;

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-mono uppercase tracking-wide-caps text-copper">
          Live radar
        </p>
        {freshness && (
          <p className="text-[10px] text-foreground/50">{freshness}</p>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={radar.togglePlay}
          disabled={!canAnimate}
          aria-label={radar.playing ? "Pause the radar loop" : "Play the radar loop"}
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors",
            canAnimate
              ? "border-border bg-secondary/40 text-foreground/80 hover:bg-secondary/70"
              : "border-border/50 text-foreground/30",
          )}
        >
          {radar.playing ? (
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
              <rect x="4" y="3" width="3" height="10" rx="1" />
              <rect x="9" y="3" width="3" height="10" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
              <path d="M5 3.5 L12.5 8 L5 12.5 Z" />
            </svg>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <p className="font-mono-num text-sm text-foreground/85">
            {current ? clockLabel(current.at) : "—"}
          </p>
          <p className="truncate text-[11px] text-foreground/50">
            {current ? offsetLabel(current.at, radar.newestAt) : ""}
          </p>
        </div>

        <button
          type="button"
          onClick={radar.snapToNow}
          disabled={radar.atNow}
          className={cn(
            "min-h-[44px] shrink-0 rounded-full px-3 text-xs font-medium transition-colors",
            radar.atNow
              ? "text-foreground/30"
              : "bg-primary text-primary-foreground hover:opacity-90",
          )}
        >
          Now
        </button>
      </div>

      {canAnimate && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-foreground/10">
          <div
            className="h-full rounded-full bg-copper transition-all"
            style={{ width: `${Math.max(4, progress * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * No frames. Says so plainly — never dress an empty response up as data.
 * The error wording is different from the quiet-sky wording on purpose:
 * "we can't reach it" and "there's nothing falling" are not the same fact.
 */
function EmptyState({
  isLoading,
  hasError,
}: {
  isLoading: boolean;
  hasError: boolean;
}) {
  if (isLoading) {
    return (
      <p className="text-xs text-foreground/70">Checking for live radar…</p>
    );
  }
  if (hasError) {
    return (
      <>
        <p className="text-xs text-foreground/85">
          Live radar is unavailable right now.
        </p>
        <p className="mt-1 text-[11px] leading-snug text-foreground/50">
          We couldn&apos;t reach the radar feed. It&apos;ll come back on its own.
        </p>
      </>
    );
  }
  return (
    <>
      <p className="text-xs text-foreground/85">No live radar right now.</p>
      <p className="mt-1 text-[11px] leading-snug text-foreground/50">
        Nothing is coming in for this moment. We check again every minute.
      </p>
    </>
  );
}

/** The legend, in words a rep uses on a roof. */
function Legend() {
  return (
    <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
      <div>
        <p className="text-[11px] font-medium text-foreground/85">Hail falling</p>
        <div className="mt-1.5 flex items-center gap-1.5">
          {HAIL_FALLING.map((h) => (
            <span key={h.label} className="flex items-center gap-1">
              <span
                className="inline-block h-3 w-3 rounded-sm ring-1 ring-foreground/10"
                style={{ background: rampHex(h.sizeIn) }}
                aria-hidden
              />
              <span className="font-mono-num text-[11px] text-foreground/70">
                {h.label}
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span
          className="inline-block h-3 w-3 shrink-0 rounded-sm ring-1 ring-foreground/10"
          style={{ background: LIKELY_COLOR, opacity: 0.55 }}
          aria-hidden
        />
        <span className="text-[11px] text-foreground/70">Hail likely</span>
      </div>

      <div className="flex items-center gap-2">
        <span
          className="inline-block h-3 w-3 shrink-0 rounded-sm ring-1 ring-foreground/10"
          style={{ background: STORM_COLOR, opacity: 0.45 }}
          aria-hidden
        />
        <span className="text-[11px] text-foreground/70">Storm</span>
      </div>
    </div>
  );
}

function RadarIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none" />
      <path d="M8 3.6 A4.4 4.4 0 0 1 12.4 8" />
      <path d="M8 1 A7 7 0 0 1 15 8" />
    </svg>
  );
}
