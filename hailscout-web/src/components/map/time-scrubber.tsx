"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  /** Earliest cursor position (ISO date). Defaults to now − 7d. */
  rangeStart?: string;
  /** Latest cursor position (ISO date). Defaults to now. */
  rangeEnd?: string;
  /** Current cursor (ms epoch). null means 'all storms', no filter. */
  cursorMs: number | null;
  onCursorChange: (ms: number | null) => void;
  className?: string;
}

/**
 * Time scrubber — bottom-center floating glass pill, full-width on mobile.
 *
 * Drag the slider to set a time cursor; the map filters storms whose
 * start_time is at or before the cursor. A Play button animates the
 * cursor forward at 1× → 4× → 16× speed (one click cycles through).
 *
 * "All" toggle (right side) clears the cursor — restores the full
 * "show every storm we have" view.
 */
export function TimeScrubber({
  rangeStart,
  rangeEnd,
  cursorMs,
  onCursorChange,
  className,
}: Props) {
  const startMs = rangeStart ? new Date(rangeStart).getTime() : Date.now() - 7 * 24 * 60 * 60 * 1000;
  const endMs   = rangeEnd   ? new Date(rangeEnd).getTime()   : Date.now();
  const span    = Math.max(1, endMs - startMs);

  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed]   = useState<1 | 4 | 16>(1);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);

  // Animation loop
  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    const step = (now: number) => {
      const dt = lastTickRef.current ? now - lastTickRef.current : 16;
      lastTickRef.current = now;
      // Advance the cursor proportionally — a base "1×" speed sweeps the
      // full week in ~30 seconds. 4× and 16× scale that down to ~7s/~2s.
      const baseDur = 30_000;
      const cur = cursorMs ?? startMs;
      const next = cur + (dt / baseDur) * span * speed;
      if (next >= endMs) {
        onCursorChange(endMs);
        setPlaying(false);
      } else {
        onCursorChange(next);
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTickRef.current = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed]);

  const cycleSpeed = () => setSpeed((s) => (s === 1 ? 4 : s === 4 ? 16 : 1));
  const togglePlay = () => {
    if (!playing && (cursorMs === null || cursorMs >= endMs)) {
      onCursorChange(startMs);
    }
    setPlaying((v) => !v);
  };
  const reset = () => {
    onCursorChange(null);
    setPlaying(false);
  };

  const cursorOrEnd = cursorMs ?? endMs;
  const pct = Math.max(0, Math.min(1, (cursorOrEnd - startMs) / span));
  const isAllMode = cursorMs === null;

  const cursorLabel = isAllMode
    ? "All storms"
    : new Date(cursorOrEnd).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });

  return (
    <div
      className={cn(
        "glass pointer-events-auto rounded-full px-3 py-2 shadow-panel",
        "flex items-center gap-3 max-w-[min(560px,calc(100%-2rem))]",
        className,
      )}
    >
      <button
        type="button"
        onClick={togglePlay}
        className={cn(
          "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors",
          playing ? "bg-copper text-primary-foreground" : "border border-border bg-card text-foreground/70 hover:border-copper/40",
        )}
        aria-label={playing ? "Pause replay" : "Play replay"}
      >
        {playing ? (
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor"><rect x="3.5" y="3" width="3" height="10" /><rect x="9.5" y="3" width="3" height="10" /></svg>
        ) : (
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor"><path d="M4 2 L13 8 L4 14 Z" /></svg>
        )}
      </button>

      <button
        type="button"
        onClick={cycleSpeed}
        className="font-mono-num text-[10px] uppercase tracking-wide-caps text-foreground/55 hover:text-copper"
        aria-label={`Speed: ${speed}×`}
        title="Cycle replay speed"
      >
        {speed}×
      </button>

      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="relative h-3 flex items-center">
          {/* Full-track line */}
          <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-foreground/15" />
          {/* Filled portion up to cursor */}
          <div
            className="absolute left-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-copper transition-all"
            style={{ width: `${pct * 100}%` }}
          />
          {/* Cursor dot */}
          <div
            className={cn(
              "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-3 w-3 rounded-full ring-2 ring-card transition-colors",
              isAllMode ? "bg-foreground/40" : "bg-copper",
            )}
            style={{ left: `${pct * 100}%` }}
            aria-hidden
          />
          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={pct}
            onChange={(e) => {
              const next = startMs + Number(e.target.value) * span;
              onCursorChange(next);
              if (playing) setPlaying(false);
            }}
            className="absolute inset-0 w-full opacity-0 cursor-pointer"
            aria-label="Time cursor"
          />
        </div>
        <div className="flex items-center justify-between text-[10px] font-mono-num text-foreground/55">
          <span>{new Date(startMs).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
          <span className={cn(isAllMode ? "text-foreground/55" : "text-copper font-medium")}>
            {cursorLabel}
          </span>
          <span>{new Date(endMs).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={reset}
        className={cn(
          "font-mono-num text-[10px] uppercase tracking-wide-caps transition-colors",
          isAllMode ? "text-copper" : "text-foreground/55 hover:text-foreground",
        )}
        aria-label="Show all storms"
      >
        All
      </button>
    </div>
  );
}
