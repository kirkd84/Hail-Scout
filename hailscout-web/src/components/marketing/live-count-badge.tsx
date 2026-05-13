"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useStorms } from "@/hooks/useStorms";

/**
 * Small "N cells tracking right now" badge for the marketing landing.
 * Pulls the live count from /v1/storms (CONUS, last 2 hours) — same
 * 2-hour window the /live and /app/map pages use for "live".
 *
 * Re-fetches every 60 seconds via SWR's dedupingInterval; revalidates
 * on focus so a returning visitor sees the latest count immediately.
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
      className={
        "inline-flex items-center gap-2 rounded-full border border-copper/40 bg-copper/5 px-3 py-1 text-xs transition-all hover:border-copper hover:bg-copper/10 " +
        (className ?? "")
      }
    >
      <span className="relative inline-flex h-2 w-2">
        <span className="absolute inset-0 rounded-full bg-copper" />
        {liveCount > 0 && (
          <span className="absolute inset-0 rounded-full bg-copper opacity-60 animate-ping" />
        )}
      </span>
      <span className="font-mono-num font-medium uppercase tracking-wide-caps text-copper-700">
        {liveCount > 0
          ? `${liveCount} cell${liveCount === 1 ? "" : "s"} tracking now`
          : "Storm tracker · live"}
      </span>
      <span className="text-foreground/45" aria-hidden>→</span>
    </Link>
  );
}
