"use client";

import { useEffect, useState } from "react";
import { STORM_FIXTURES } from "@/lib/storm-fixtures";

interface PublicStats {
  storms_tracked: number;
  storms_live: number;
  addresses_monitored: number;
  alerts_this_week: number;
  organizations: number;
  live_as_of?: string | null;
  data_fresh?: boolean;
}

/** "3m ago" style relative time for the freshness readout. */
function freshnessLabel(iso?: string | null): string | null {
  if (!iso) return null;
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://hail-scout-production.up.railway.app";

/**
 * Top-of-page instrument readout — real numbers from /v1/public/stats.
 *
 * Mono, uppercase, tabular numerals: it should read like the status bar of
 * the product, not a marketing banner. Honest empty behavior: when the API
 * is unreachable the ticker renders NOTHING (fixture-derived counts appear
 * only in explicit demo builds) — it never invents public stats.
 */
export function StatTicker() {
  const [stats, setStats] = useState<PublicStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/v1/public/stats`);
        if (!res.ok) throw new Error(`${res.status}`);
        const data = (await res.json()) as PublicStats;
        if (!cancelled) setStats(data);
      } catch {
        // Never invent public stats. In explicit demo mode, show
        // fixture-derived counts; otherwise leave stats unset so the ticker
        // shows nothing rather than fabricated numbers on an API hiccup.
        if (cancelled) return;
        if (process.env.NEXT_PUBLIC_USE_FIXTURES === "1") {
          setStats({
            storms_tracked: STORM_FIXTURES.length,
            storms_live: STORM_FIXTURES.filter((s) => s.is_live).length,
            addresses_monitored: 0,
            alerts_this_week: 0,
            organizations: 0,
          });
        }
      }
    };
    void load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!stats) return null;

  const items: { label: string; value: number; tone?: "live" | "default" }[] = [
    { label: "STORMS LIVE", value: stats.storms_live, tone: "live" },
    { label: "STORMS TRACKED", value: stats.storms_tracked },
    { label: "ADDRESSES MONITORED", value: stats.addresses_monitored },
    { label: "ALERTS · 7 DAYS", value: stats.alerts_this_week },
  ];

  const fresh = freshnessLabel(stats.live_as_of);

  return (
    <div className="border-b border-border bg-card/80 backdrop-blur">
      <div className="container flex flex-wrap items-center justify-between gap-x-6 gap-y-1.5 py-2 font-mono text-[11px] uppercase tracking-[0.14em]">
        {items.map((item) => (
          <span key={item.label} className="inline-flex items-center gap-2">
            {item.tone === "live" && (
              <span className="relative inline-flex h-1.5 w-1.5">
                <span className="absolute inset-0 rounded-full bg-primary" />
                {item.value > 0 && (
                  <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-60" />
                )}
              </span>
            )}
            <span
              className={
                item.tone === "live" ? "text-primary" : "text-muted-foreground/80"
              }
            >
              {item.label}
            </span>
            <span
              className={
                item.tone === "live"
                  ? "font-mono-num font-medium text-primary"
                  : "font-mono-num font-medium text-foreground"
              }
            >
              {item.value.toLocaleString()}
            </span>
          </span>
        ))}
        {fresh && (
          <span className="inline-flex items-center gap-2">
            <span className={stats.data_fresh ? "text-primary" : "text-muted-foreground/80"}>
              {stats.data_fresh ? "LIVE DATA" : "DATA"} · UPDATED
            </span>
            <span className="font-mono-num font-medium text-foreground">{fresh}</span>
          </span>
        )}
      </div>
    </div>
  );
}
