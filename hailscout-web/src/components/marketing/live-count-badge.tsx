"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useStorms } from "@/hooks/useStorms";

/**
 * Live storm-cell count — the hero's eyebrow.
 *
 * Pulls the real count from /v1/storms (CONUS, last 2 hours) — the same
 * 2-hour "live" window the /live and /app/map pages use. Never invents a
 * number: when nothing is live (or the API is unreachable) it falls back
 * to a plain "Live storm tracker" label with no count.
 *
 * Styled as a mono instrument readout for the always-dark hero plate
 * (mode-invariant cream/cyan ramps), with a 44px tap target.
 *
 * Re-fetches every 60 seconds; revalidates on focus so a returning
 * visitor sees the latest count immediately.
 */
export function LiveCountBadge({ className }: { className?: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Last 24h window for the API query (it's bounded at day granularity);
  // we count "live" client-side as started in the last 2 hours.
  const from = useMemo(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  }, []);
  const to = useMemo(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  }, []);

  const { storms } = useStorms({
    bbox: [-125, 24, -66, 50],
    from,
    to,
    limit: 50,
    fallbackToFixtures: true,
  });

  const liveCutoff = Date.now() - 2 * 60 * 60 * 1000;
  const liveCount = storms.filter(
    (s) => new Date(s.start_time).getTime() >= liveCutoff,
  ).length;

  return (
    <Link
      href="/live"
      className={cn(
        "inline-flex min-h-11 items-center gap-2.5 rounded-full border border-copper-500/35 bg-copper-500/10 px-4",
        "font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-copper-300",
        "transition-colors hover:border-copper-500/60 hover:bg-copper-500/15",
        className,
      )}
    >
      <span className="relative inline-flex h-2 w-2">
        <span className="absolute inset-0 rounded-full bg-copper-500" />
        {liveCount > 0 && (
          <span className="absolute inset-0 animate-ping rounded-full bg-copper-500 opacity-60" />
        )}
      </span>
      <span className="font-mono-num">
        {liveCount > 0
          ? `${liveCount} storm cell${liveCount === 1 ? "" : "s"} on radar now`
          : "Live storm tracker"}
      </span>
      <span className="text-cream-50/45" aria-hidden>
        →
      </span>
    </Link>
  );
}
