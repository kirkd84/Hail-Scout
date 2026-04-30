"use client";

import { useState, useEffect } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { STORM_FIXTURES, type StormFixture } from "@/lib/storm-fixtures";
import { hailColor } from "@/lib/hail";
import { timeAgo } from "@/lib/time-ago";
import { IconChevronRight, IconBolt } from "@/components/icons";
import { cn } from "@/lib/utils";

interface Props {
  map: MapLibreMap | null;
}

/**
 * Floating glass panel — bottom-left of the map.
 *
 * Default: collapsed pill showing "Live · N storms" with a copper pulse.
 * Click expands to a vertical list:
 *   - "Live now" group — currently active storms (is_live)
 *   - "Recent" group — storms in the last 7 days (excluding live)
 * Each row shows city, peak hail size badge, time-ago. Click flies to centroid.
 */
export function StormActivityFeed({ map }: Props) {
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);

  // Re-render every 30s so time-ago labels stay fresh
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const live: StormFixture[] = [];
  const recent: StormFixture[] = [];
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

  for (const s of STORM_FIXTURES) {
    if (s.is_live) {
      live.push(s);
    } else if (Date.now() - new Date(s.start_time).getTime() < SEVEN_DAYS) {
      recent.push(s);
    }
  }

  // Sort: live first by start_time desc, recent same
  live.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
  recent.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());

  // Newest few from the full archive if recent is empty
  const recentToShow = recent.length > 0 ? recent : [...STORM_FIXTURES]
    .filter((s) => !s.is_live)
    .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
    .slice(0, 6);

  const flyTo = (s: StormFixture) => {
    if (!map) return;
    map.flyTo({ center: [s.centroid_lng, s.centroid_lat], zoom: 9, duration: 1100 });
  };

  // Tick used in deps to refresh time-ago text
  void tick;

  return (
    <div className="pointer-events-auto absolute bottom-6 left-4 z-20 max-w-[calc(100%-2rem)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "glass flex items-center gap-2.5 rounded-full px-3.5 py-2 shadow-panel transition-all",
          live.length > 0 ? "border-copper/50" : "hover:border-copper/40",
        )}
        aria-expanded={open}
      >
        <span className="relative inline-flex h-2.5 w-2.5">
          <span
            className={cn(
              "absolute inset-0 rounded-full",
              live.length > 0 ? "bg-copper" : "bg-foreground/40",
            )}
          />
          {live.length > 0 && (
            <span className="absolute inset-0 rounded-full bg-copper opacity-60 animate-ping" />
          )}
        </span>
        <span className="text-xs font-medium text-foreground/85">
          {live.length > 0 ? `Live · ${live.length} storm${live.length === 1 ? "" : "s"}` : "Storm activity"}
        </span>
        <IconChevronRight
          className={cn(
            "h-3.5 w-3.5 text-foreground/50 transition-transform",
            open && "rotate-90",
          )}
        />
      </button>

      {open && (
        <div className="glass mt-2 w-72 rounded-lg p-3 shadow-panel max-h-[55vh] overflow-y-auto">
          {live.length > 0 && (
            <Group title="Live now" tone="copper">
              {live.map((s) => (
                <Row key={s.id} storm={s} onClick={() => flyTo(s)} live />
              ))}
            </Group>
          )}

          <Group title={live.length > 0 ? "Earlier today" : "Recent storms"} tone="muted">
            {recentToShow.map((s) => (
              <Row key={s.id} storm={s} onClick={() => flyTo(s)} />
            ))}
          </Group>

          <p className="mt-3 pt-2 border-t border-border text-[10px] text-muted-foreground leading-relaxed">
            Live MRMS · refreshes every 2 minutes during active storms
          </p>
        </div>
      )}
    </div>
  );
}

function Group({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "copper" | "muted";
  children: React.ReactNode;
}) {
  return (
    <section className="mb-3 last:mb-0">
      <h4
        className={cn(
          "mb-1.5 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wide-caps",
          tone === "copper" ? "text-copper" : "text-foreground/55",
        )}
      >
        {tone === "copper" && <IconBolt className="h-3 w-3" />}
        {title}
      </h4>
      <ul className="space-y-1">{children}</ul>
    </section>
  );
}

function Row({
  storm,
  onClick,
  live,
}: {
  storm: StormFixture;
  onClick: () => void;
  live?: boolean;
}) {
  const c = hailColor(storm.max_hail_size_in);
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="group flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-foreground/5"
      >
        <span
          className="inline-flex h-7 w-9 shrink-0 flex-col items-center justify-center rounded-md border"
          style={{ background: c.bg, borderColor: c.border }}
        >
          <span
            className="font-mono-num text-[11px] font-medium leading-none"
            style={{ color: c.text }}
          >
            {storm.max_hail_size_in.toFixed(2)}″
          </span>
        </span>
        <span className="flex-1 min-w-0">
          <span className="block truncate text-xs font-medium text-foreground">
            {storm.city}
          </span>
          <span className="block truncate text-[10px] text-muted-foreground font-mono-num">
            {live ? (
              <>
                <span className="text-copper">●</span> active · {timeAgo(storm.start_time)}
              </>
            ) : (
              timeAgo(storm.start_time)
            )}
          </span>
        </span>
        <IconChevronRight className="h-3 w-3 text-foreground/30 transition-transform group-hover:translate-x-0.5 group-hover:text-copper" />
      </button>
    </li>
  );
}
