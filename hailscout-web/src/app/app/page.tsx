"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMarkers } from "@/hooks/useMarkers";
import { useSavedAddresses } from "@/hooks/useSavedAddresses";
import { useAlerts } from "@/hooks/useAlerts";
import { useReports } from "@/hooks/useReports";
import { useMe } from "@/hooks/useMe";
import { hailColor } from "@/lib/hail";
import { timeAgo } from "@/lib/time-ago";
import { STORM_FIXTURES } from "@/lib/storm-fixtures";
import { MARKER_STATUSES, statusInfo } from "@/lib/markers";
import { ContourBg } from "@/components/brand/contour-bg";
import { OnboardingWizard } from "@/components/app/onboarding-wizard";
import { FollowUpsWidget } from "@/components/app/follow-ups-widget";
import {
  IconBolt,
  IconAddresses,
  IconFlag,
  IconReport,
  IconChevronRight,
  IconPin,
} from "@/components/icons";
import { cn } from "@/lib/utils";
import type { StormAlert as StormAlertT } from "@/hooks/useAlerts";
import type { SavedReport as SavedReportT } from "@/hooks/useReports";
import type { Marker as MarkerT, MarkerStatus as MarkerStatusT } from "@/lib/markers";

type ActivityItem =
  | { kind: "alert";  ts: string; alert: StormAlertT }
  | { kind: "report"; ts: string; report: SavedReportT }
  | { kind: "marker"; ts: string; marker: MarkerT };


/**
 * /app — dashboard.
 *
 * Replaces the previous `redirect("/app/map")` so signed-in users land
 * on a useful overview. Aggregates data from every existing hook —
 * markers, addresses, alerts, reports — and the static storm fixtures.
 *
 * Layout (Apple-grade restraint):
 *  - Eyebrow + display heading + greeting
 *  - 4 KPI tiles
 *  - 2-col grid: Live storms (left) + Recent activity (right)
 *  - Marker pipeline strip across the bottom (status counts)
 */
export default function DashboardPage() {
  const { me } = useMe();
  const { markers } = useMarkers();
  const { addresses } = useSavedAddresses();
  const { alerts, unreadCount } = useAlerts();
  const { reports } = useReports();

  // Live + recent storms (mirror activity-feed logic)
  const live = STORM_FIXTURES.filter((s) => s.is_live);
  const recent = [...STORM_FIXTURES]
    .filter((s) => !s.is_live)
    .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
    .slice(0, 5);

  // Marker pipeline — count per status
  const markerCounts = MARKER_STATUSES.map((s) => ({
    ...s,
    count: markers.filter((m) => m.status === s.id).length,
  }));

  // "Recent activity" — combine + sort 10 newest items
  const activity: ActivityItem[] = [
    ...alerts.slice(0, 6).map((a): ActivityItem => ({ kind: "alert",  ts: a.created_at, alert: a })),
    ...reports.slice(0, 6).map((r): ActivityItem => ({ kind: "report", ts: r.created_at, report: r })),
    ...markers.slice(0, 6).map((m): ActivityItem => ({ kind: "marker", ts: m.updated_at, marker: m })),
  ];
  activity.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  const activityToShow = activity.slice(0, 8);

  const greeting = (() => {
    const hr = new Date().getHours();
    if (hr < 5)  return "Up early.";
    if (hr < 12) return "Good morning.";
    if (hr < 17) return "Good afternoon.";
    return "Good evening.";
  })();

  return (
    <div className="h-full overflow-y-auto">
      <OnboardingWizard />
      <NotificationsPermissionBar />
      {/* Hero strip with subtle topo decoration */}
      <div className="relative overflow-hidden border-b border-border bg-card">
        <ContourBg className="opacity-60" density="sparse" fadeBottom />
        <div className="relative container max-w-6xl py-10">
          <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-copper">
            Atlas overview
          </p>
          <h1 className="mt-1 font-display text-4xl font-medium tracking-tight-display text-foreground md:text-5xl">
            {greeting}
            {me?.user?.email && (
              <span className="text-foreground/45">
                {" "}— {me.user.email.split("@")[0]}
              </span>
            )}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {live.length > 0 ? (
              <>
                <span className="text-copper font-medium">{live.length} storm{live.length === 1 ? "" : "s"}</span>{" "}
                are tracking right now. {unreadCount > 0 && `${unreadCount} new alert${unreadCount === 1 ? "" : "s"} on your monitored addresses.`}
              </>
            ) : (
              "All quiet on the atlas. Browse recent storms below or hit the map."
            )}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href="/app/map"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-atlas hover:bg-teal-900"
            >
              Open the atlas <span aria-hidden>→</span>
            </Link>
            <Link
              href="/app/alerts"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:border-copper/50"
            >
              {unreadCount > 0 ? `${unreadCount} unread alerts` : "All alerts"} <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="container max-w-6xl py-10 space-y-10">
        {/* KPIs */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi
            label="Monitored addresses"
            value={addresses.length.toString()}
            href="/app/addresses"
            icon={<IconAddresses className="h-4 w-4" />}
          />
          <Kpi
            label="Active alerts"
            value={alerts.length.toString()}
            badge={unreadCount > 0 ? `${unreadCount} new` : undefined}
            href="/app/alerts"
            icon={<IconBolt className="h-4 w-4" />}
            tone={unreadCount > 0 ? "copper" : undefined}
          />
          <Kpi
            label="Markers dropped"
            value={markers.length.toString()}
            href="/app/markers"
            icon={<IconFlag className="h-4 w-4" />}
          />
          <Kpi
            label="Reports generated"
            value={reports.length.toString()}
            href="/app/reports"
            icon={<IconReport className="h-4 w-4" />}
          />
        </section>

        {/* Two-column main grid */}
        <section className="grid gap-6 md:grid-cols-2">
          {/* Live storms */}
          <Card title="Today on the atlas" eyebrow={live.length > 0 ? "Live · MRMS" : "Recent"}>
            {live.length > 0 ? (
              <ul className="divide-y divide-border/60">
                {live.map((s) => {
                  const c = hailColor(s.max_hail_size_in);
                  return (
                    <li key={s.id}>
                      <Link
                        href="/app/map"
                        className="flex items-center gap-3 py-3 transition-colors hover:bg-secondary/30 -mx-2 px-2 rounded-md"
                      >
                        <span className="relative inline-flex h-2.5 w-2.5">
                          <span className="absolute inset-0 rounded-full bg-copper" />
                          <span className="absolute inset-0 rounded-full bg-copper opacity-60 animate-ping" />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block truncate text-sm font-medium text-foreground">{s.city}</span>
                          <span className="block truncate text-xs text-muted-foreground font-mono-num">
                            {timeAgo(s.start_time)} · started {new Date(s.start_time).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                          </span>
                        </span>
                        <span
                          className="inline-flex h-9 w-12 flex-col items-center justify-center rounded-md border"
                          style={{ background: c.bg, borderColor: c.border }}
                        >
                          <span className="font-mono-num text-xs font-medium leading-none" style={{ color: c.text }}>
                            {s.max_hail_size_in.toFixed(2)}″
                          </span>
                        </span>
                        <IconChevronRight className="h-4 w-4 text-foreground/30" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <ul className="divide-y divide-border/60">
                {recent.map((s) => {
                  const c = hailColor(s.max_hail_size_in);
                  return (
                    <li key={s.id}>
                      <Link
                        href="/app/map"
                        className="flex items-center gap-3 py-3 transition-colors hover:bg-secondary/30 -mx-2 px-2 rounded-md"
                      >
                        <IconPin className="h-4 w-4 text-foreground/40" />
                        <span className="flex-1 min-w-0">
                          <span className="block truncate text-sm font-medium text-foreground">{s.city}</span>
                          <span className="block truncate text-xs text-muted-foreground font-mono-num">
                            {timeAgo(s.start_time)}
                          </span>
                        </span>
                        <span className="font-mono-num text-xs" style={{ color: c.text }}>
                          {s.max_hail_size_in.toFixed(2)}″
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            <Link
              href="/app/map"
              className="mt-3 inline-flex items-center gap-1 text-xs font-mono uppercase tracking-wide-caps text-copper hover:text-copper-700"
            >
              See all storms <span aria-hidden>→</span>
            </Link>
          </Card>

          {/* Recent activity */}
          <Card title="Recent activity" eyebrow="Across the workspace">
            {activityToShow.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Nothing yet — drop a marker, save an address, generate a report.
              </p>
            ) : (
              <ul className="divide-y divide-border/60">
                {activityToShow.map((a) => (
                  <li key={`${a.kind}-${a.ts}-${"alert" in a ? a.alert.id : "report" in a ? a.report.id : a.marker.id}`} className="py-2.5">
                    <ActivityRow activity={a} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>

        {/* Follow-ups due — CRM widget */}
        <section>
          <FollowUpsWidget />
        </section>

        {/* Marker pipeline strip */}
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-copper">
              Canvassing pipeline
            </p>
            <Link
              href="/app/markers"
              className="text-[11px] font-mono uppercase tracking-wide-caps text-foreground/55 hover:text-foreground"
            >
              All markers →
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
            {markerCounts.map((s) => (
              <div key={s.id} className="rounded-md border border-border bg-card p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-full ring-2 ring-white" style={{ background: s.color }} />
                  <span className="text-[10px] font-mono uppercase tracking-wide-caps text-foreground/55 truncate">
                    {s.label}
                  </span>
                </div>
                <p className="font-display text-2xl font-medium tracking-tight-display text-foreground">
                  {s.count}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

interface KpiProps {
  label: string;
  value: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
  tone?: "copper";
}

function Kpi({ label, value, href, icon, badge, tone }: KpiProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group rounded-xl border border-border bg-card p-4 transition-colors hover:border-copper/50",
        tone === "copper" && "border-copper/40 bg-copper/5",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-foreground/50">{icon}</span>
        {badge && (
          <span className="rounded-full bg-copper px-2 py-0.5 font-mono-num text-[10px] uppercase tracking-wide-caps text-primary-foreground">
            {badge}
          </span>
        )}
      </div>
      <p className="mt-3 font-display text-3xl font-medium tracking-tight-display text-foreground">{value}</p>
      <p className="mt-1 text-xs font-mono uppercase tracking-wide-caps text-foreground/55">{label}</p>
    </Link>
  );
}

function Card({ title, eyebrow, children }: { title: string; eyebrow?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3">
        {eyebrow && (
          <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-copper mb-1">{eyebrow}</p>
        )}
        <h2 className="font-display text-2xl font-medium tracking-tight-display text-foreground">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function ActivityRow({ activity }: { activity: ActivityItem }) {
  if (activity.kind === "alert") {
    const a = activity.alert;
    return (
      <Link href="/app/alerts" className="flex items-start gap-3">
        <span className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-copper/15 text-copper">
          <IconBolt className="h-3 w-3" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block truncate text-sm text-foreground">
            <span className="font-medium">Alert</span>{" "}
            — {a.peak_size_in.toFixed(2)}″ at {a.address_label || a.address || "monitored address"}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground font-mono-num">
            {timeAgo(a.created_at)}{a.storm_city ? ` · ${a.storm_city}` : ""}
          </span>
        </span>
      </Link>
    );
  }
  if (activity.kind === "report") {
    const r = activity.report;
    return (
      <Link href="/app/reports" className="flex items-start gap-3">
        <span className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <IconReport className="h-3 w-3" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block truncate text-sm text-foreground">
            <span className="font-medium">Report</span> — {r.title || r.address || "Untitled"}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground font-mono-num">
            {timeAgo(r.created_at)}
          </span>
        </span>
      </Link>
    );
  }
  const m = activity.marker;
  const info = statusInfo(m.status as MarkerStatusT);
  return (
    <Link href="/app/markers" className="flex items-start gap-3">
      <span
        className="mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-card"
        style={{ background: info.color }}
      />
      <span className="flex-1 min-w-0">
        <span className="block truncate text-sm text-foreground">
          <span className="font-medium">Marker</span> — {info.label} at {m.lat.toFixed(3)}, {m.lng.toFixed(3)}
        </span>
        <span className="block truncate text-[11px] text-muted-foreground font-mono-num">
          {timeAgo(m.updated_at)}
        </span>
      </span>
    </Link>
  );
}


function NotificationsPermissionBar() {
  const [perm, setPerm] = useState<NotificationPermission | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setPerm(Notification.permission);
  }, []);

  if (perm !== "default") return null;

  const ask = async () => {
    if (!("Notification" in window)) return;
    const next = await Notification.requestPermission();
    setPerm(next);
  };

  return (
    <div className="border-b border-copper/30 bg-copper/5 px-4 py-3">
      <div className="container max-w-6xl flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-foreground/85">
          <span className="font-medium">Get hit-the-second-it-happens alerts.</span>{" "}
          Enable browser notifications to be alerted the moment hail touches a
          monitored address — even with the app closed.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPerm("denied" as NotificationPermission)}
            className="text-[11px] font-mono uppercase tracking-wide-caps text-foreground/55 hover:text-foreground"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={() => void ask()}
            className="inline-flex items-center gap-1.5 rounded-md bg-copper px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-copper-700"
          >
            Enable notifications
          </button>
        </div>
      </div>
    </div>
  );
}
