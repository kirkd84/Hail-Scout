"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { STORM_FIXTURES } from "@/lib/storm-fixtures";

/**
 * Small "N storms tracking right now" badge for the marketing landing.
 * Pulls live count from the same fixture data the rest of the app uses
 * (re-evaluates on a 60s tick to refresh elapsed-time semantics).
 */
export function LiveCountBadge({ className }: { className?: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const liveCount = STORM_FIXTURES.filter((s) => s.is_live).length;

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
        {liveCount > 0 ? `${liveCount} storm${liveCount === 1 ? "" : "s"} tracking now` : "Storm tracker · live"}
      </span>
      <span className="text-foreground/45" aria-hidden>→</span>
    </Link>
  );
}
