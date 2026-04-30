"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAlerts, type StormAlert } from "@/hooks/useAlerts";
import { hailColor } from "@/lib/hail";
import { timeAgo } from "@/lib/time-ago";
import { cn } from "@/lib/utils";
import { IconClose, IconChevronRight, IconBolt } from "@/components/icons";

/**
 * Topbar notification bell with dropdown panel.
 *
 * Shows a copper unread-count badge when alerts are pending. Click to
 * open the panel; clicking an alert marks it as read and (TODO) flies the
 * map to the affected address.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const { alerts, unreadCount, markRead, markAllRead, dismiss } = useAlerts();

  // Click-outside to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unreadCount > 0 ? ` — ${unreadCount} unread` : ""}`}
        className={cn(
          "relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card transition-colors",
          "hover:border-copper/40 hover:bg-muted",
        )}
      >
        <BellIcon className="h-4 w-4 text-foreground/75" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-copper px-1 text-[10px] font-mono-num font-medium text-primary-foreground ring-2 ring-card">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[min(380px,calc(100vw-2rem))] origin-top-right rounded-xl border border-border bg-card shadow-panel overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div>
              <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-copper">
                Storm alerts
              </p>
              <p className="font-display text-base font-medium tracking-tight-display">
                {alerts.length === 0
                  ? "All quiet"
                  : `${alerts.length} alert${alerts.length === 1 ? "" : "s"}`}
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-[11px] font-mono uppercase tracking-wide-caps text-foreground/55 hover:text-foreground"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {alerts.length === 0 && (
              <div className="px-4 py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  No active alerts. Add monitored addresses on the map to be
                  notified when hail touches them.
                </p>
                <Link
                  href="/app/addresses"
                  onClick={() => setOpen(false)}
                  className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-copper hover:text-copper-700"
                >
                  Manage addresses <span aria-hidden>→</span>
                </Link>
              </div>
            )}

            {alerts.map((a, i) => (
              <AlertRow
                key={a.id}
                alert={a}
                isLast={i === alerts.length - 1}
                onClick={() => {
                  if (a.read_at === null) void markRead(a.id);
                  setOpen(false);
                }}
                onDismiss={() => void dismiss(a.id)}
              />
            ))}
          </div>

          {alerts.length > 0 && (
            <div className="border-t border-border px-4 py-2 text-center">
              <Link
                href="/app/alerts"
                onClick={() => setOpen(false)}
                className="text-[11px] font-mono uppercase tracking-wide-caps text-foreground/55 hover:text-copper"
              >
                See all alerts →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AlertRow({
  alert,
  onClick,
  onDismiss,
  isLast,
}: {
  alert: StormAlert;
  onClick: () => void;
  onDismiss: () => void;
  isLast: boolean;
}) {
  const c = hailColor(alert.peak_size_in);
  const unread = alert.read_at === null;
  return (
    <div
      className={cn(
        "group relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/40",
        !isLast && "border-b border-border/60",
        unread && "bg-copper/5",
      )}
    >
      {alert.address ? (
        <Link
          href={`/app/map?address=${encodeURIComponent(alert.address)}`}
          onClick={onClick}
          className="flex flex-1 items-center gap-3 min-w-0"
        >
          <RowBody alert={alert} c={c} unread={unread} />
        </Link>
      ) : (
        <button type="button" onClick={onClick} className="flex flex-1 items-center gap-3 min-w-0 text-left">
          <RowBody alert={alert} c={c} unread={unread} />
        </button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss alert"
        className="text-foreground/30 transition-colors hover:text-destructive opacity-0 group-hover:opacity-100"
      >
        <IconClose className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function RowBody({ alert, c, unread }: { alert: StormAlert; c: ReturnType<typeof hailColor>; unread: boolean }) {
  return (
    <>
      <span
        className="inline-flex h-10 w-12 shrink-0 flex-col items-center justify-center rounded-md border"
        style={{ background: c.bg, borderColor: c.border }}
      >
        <span
          className="font-mono-num text-xs font-medium leading-none"
          style={{ color: c.text }}
        >
          {alert.peak_size_in.toFixed(2)}″
        </span>
        <span
          className="text-[8px] uppercase tracking-wide-caps font-mono leading-none mt-0.5"
          style={{ color: c.text, opacity: 0.75 }}
        >
          {c.object}
        </span>
      </span>
      <span className="flex-1 min-w-0">
        <span className="block truncate text-sm font-medium text-foreground">
          {unread && (
            <span
              className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-copper align-middle"
              aria-hidden
            />
          )}
          {alert.address_label || alert.address || "Monitored address"}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {alert.storm_city ?? "Storm"} · {timeAgo(alert.storm_started_at)}
        </span>
      </span>
      <IconChevronRight className="h-3.5 w-3.5 text-foreground/30" />
    </>
  );
}

function BellIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M8 1.5C8 1.5 4 2 4 6.5C4 10 2.5 11 2.5 11H13.5C13.5 11 12 10 12 6.5C12 2 8 1.5 8 1.5Z" />
      <path d="M6.5 13.5C7 14 7.5 14 8 14C8.5 14 9 14 9.5 13.5" />
    </svg>
  );
}
