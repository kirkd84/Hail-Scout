"use client";

import Link from "next/link";
import { useAlerts } from "@/hooks/useAlerts";
import { hailColor } from "@/lib/hail";
import { timeAgo } from "@/lib/time-ago";
import { EmptyState } from "@/components/app/empty-state";
import { IconBolt, IconClose, IconChevronRight } from "@/components/icons";
import { cn } from "@/lib/utils";

export default function AlertsPage() {
  const { alerts, unreadCount, markAllRead, markRead, dismiss } = useAlerts();

  if (alerts.length === 0) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="container max-w-3xl py-10">
          <EmptyState
            icon={IconBolt}
            eyebrow="Storm alerts"
            title="No active alerts"
            description="Add addresses to your watchlist on the map. We'll surface an alert here every time a hailstorm above your threshold touches one of them."
            primary={{ label: "Manage addresses", href: "/app/addresses" }}
            secondary={{ label: "Search the atlas", href: "/app/map" }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="container max-w-4xl py-10 space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-copper">
              Storm alerts
            </p>
            <h1 className="mt-1 font-display text-4xl font-medium tracking-tight-display text-foreground">
              {alerts.length} alert{alerts.length === 1 ? "" : "s"}
              {unreadCount > 0 && (
                <span className="ml-3 inline-flex items-center rounded-full bg-copper/15 px-2.5 py-1 text-xs font-mono uppercase tracking-wide-caps text-copper-700 align-middle">
                  {unreadCount} unread
                </span>
              )}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Live MRMS hits on your monitored addresses.
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:border-copper/50"
            >
              Mark all read
            </button>
          )}
        </div>

        <div className="rule-atlas" />

        <ul className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border/60">
          {alerts.map((a) => {
            const c = hailColor(a.peak_size_in);
            const unread = a.read_at === null;
            return (
              <li
                key={a.id}
                className={cn(
                  "group relative flex items-center gap-4 px-5 py-4 transition-colors hover:bg-secondary/40",
                  unread && "bg-copper/5",
                )}
              >
                <span
                  className="inline-flex h-12 w-14 shrink-0 flex-col items-center justify-center rounded-md border"
                  style={{ background: c.bg, borderColor: c.border }}
                >
                  <span className="font-mono-num text-sm font-medium leading-none" style={{ color: c.text }}>
                    {a.peak_size_in.toFixed(2)}″
                  </span>
                  <span className="text-[9px] uppercase tracking-wide-caps font-mono leading-none mt-0.5" style={{ color: c.text, opacity: 0.75 }}>
                    {c.object}
                  </span>
                </span>

                <div className="flex-1 min-w-0">
                  <Link
                    href={`/app/map?address=${encodeURIComponent(a.address ?? "")}`}
                    onClick={() => {
                      if (unread) void markRead(a.id);
                    }}
                    className="block"
                  >
                    <p className="font-medium text-foreground truncate flex items-center gap-2">
                      {unread && (
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-copper" aria-hidden />
                      )}
                      {a.address_label || a.address || "Monitored address"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground truncate">
                      {a.storm_city ?? "Storm"} · started {timeAgo(a.storm_started_at)}
                      {" · "}
                      <span className="font-mono-num">id {a.storm_id.slice(-8)}</span>
                    </p>
                  </Link>
                </div>

                <div className="flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                  {unread && (
                    <button
                      type="button"
                      onClick={() => void markRead(a.id)}
                      className="text-[11px] font-mono uppercase tracking-wide-caps text-foreground/65 hover:text-copper"
                    >
                      Mark read
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void dismiss(a.id)}
                    aria-label="Dismiss alert"
                    className="text-foreground/40 hover:text-destructive"
                  >
                    <IconClose className="h-4 w-4" />
                  </button>
                  <IconChevronRight className="h-4 w-4 text-foreground/30" />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
