"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useAlerts, type StormAlert as StormAlertT } from "@/hooks/useAlerts";
import { useReports, type SavedReport as SavedReportT } from "@/hooks/useReports";
import { useMarkers } from "@/hooks/useMarkers";
import { useTeam } from "@/hooks/useTeam";
import { type Marker as MarkerT, statusInfo } from "@/lib/markers";
import { hailColor } from "@/lib/hail";
import { timeAgo } from "@/lib/time-ago";
import { IconBolt, IconReport, IconFlag, IconChevronRight } from "@/components/icons";
import { cn } from "@/lib/utils";

type Filter = "all" | "alerts" | "reports" | "markers";

type Item =
  | { kind: "alert";  ts: string; alert: StormAlertT }
  | { kind: "report"; ts: string; report: SavedReportT }
  | { kind: "marker"; ts: string; marker: MarkerT };

export default function ActivityPage() {
  const { alerts } = useAlerts();
  const { reports } = useReports();
  const { markers } = useMarkers();
  const { members } = useTeam();
  const [filter, setFilter] = useState<Filter>("all");

  const items: Item[] = useMemo(() => {
    const out: Item[] = [];
    if (filter === "all" || filter === "alerts") {
      for (const a of alerts) out.push({ kind: "alert", ts: a.created_at, alert: a });
    }
    if (filter === "all" || filter === "reports") {
      for (const r of reports) out.push({ kind: "report", ts: r.created_at, report: r });
    }
    if (filter === "all" || filter === "markers") {
      for (const m of markers) out.push({ kind: "marker", ts: m.updated_at, marker: m });
    }
    return out.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  }, [alerts, reports, markers, filter]);

  const counts = {
    alerts: alerts.length,
    reports: reports.length,
    markers: markers.length,
  };

  const memberEmailById = (id: string | null | undefined): string | null => {
    if (!id) return null;
    return members.find((m) => m.id === id)?.email ?? null;
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="container max-w-4xl py-10 space-y-8">
        <div>
          <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-copper">
            Activity
          </p>
          <h1 className="mt-1 font-display text-4xl font-medium tracking-tight-display text-foreground">
            Recent across the workspace
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every alert, report, and marker — newest first.
          </p>
        </div>
        <div className="rule-atlas" />

        <div className="flex flex-wrap items-center gap-2">
          <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-foreground/55 mr-2">
            Filter:
          </p>
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>
            All ({counts.alerts + counts.reports + counts.markers})
          </Chip>
          <Chip active={filter === "alerts"} onClick={() => setFilter("alerts")}>
            Alerts ({counts.alerts})
          </Chip>
          <Chip active={filter === "reports"} onClick={() => setFilter("reports")}>
            Reports ({counts.reports})
          </Chip>
          <Chip active={filter === "markers"} onClick={() => setFilter("markers")}>
            Markers ({counts.markers})
          </Chip>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {items.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <p className="font-display text-2xl text-foreground">No activity yet.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Save an address, drop a marker, or generate a report.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {items.map((it, idx) => (
                <li key={`${it.kind}-${idx}-${it.ts}`}>
                  <Row item={it} memberEmailById={memberEmailById} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1 text-xs font-mono uppercase tracking-wide-caps transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "border border-border bg-card text-foreground/65 hover:border-copper/40",
      )}
    >
      {children}
    </button>
  );
}

function Row({
  item,
  memberEmailById,
}: {
  item: Item;
  memberEmailById: (id: string | null | undefined) => string | null;
}) {
  if (item.kind === "alert") {
    const a = item.alert;
    const c = hailColor(a.peak_size_in);
    return (
      <Link href="/app/alerts" className="block group">
        <div className="px-5 py-4 flex items-center gap-4 hover:bg-secondary/30 transition-colors">
          <span
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ background: c.bg, color: c.text }}
          >
            <IconBolt className="h-4 w-4" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              <span className="text-copper">Alert</span> · {a.peak_size_in.toFixed(2)}″ at{" "}
              {a.address_label || a.address || "monitored address"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground font-mono-num truncate">
              {timeAgo(a.created_at)} · {a.storm_city ?? "Storm"}
            </p>
          </div>
          <IconChevronRight className="h-4 w-4 text-foreground/30 group-hover:text-copper transition-colors" />
        </div>
      </Link>
    );
  }

  if (item.kind === "report") {
    const r = item.report;
    return (
      <Link href="/app/reports" className="block group">
        <div className="px-5 py-4 flex items-center gap-4 hover:bg-secondary/30 transition-colors">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <IconReport className="h-4 w-4" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              <span className="text-primary">Report</span> · {r.title || r.address || "Untitled"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground font-mono-num truncate">
              {timeAgo(r.created_at)} · {r.storm_city ?? "—"}
              {r.peak_size_in ? ` · ${r.peak_size_in.toFixed(2)}″` : ""}
            </p>
          </div>
          <IconChevronRight className="h-4 w-4 text-foreground/30 group-hover:text-copper transition-colors" />
        </div>
      </Link>
    );
  }

  // marker
  const m = item.marker;
  const info = statusInfo(m.status);
  const assigneeEmail = memberEmailById(m.assignee_user_id);
  return (
    <Link href="/app/markers" className="block group">
      <div className="px-5 py-4 flex items-center gap-4 hover:bg-secondary/30 transition-colors">
        <span
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{ background: `${info.color}1a`, color: info.outline }}
        >
          <IconFlag className="h-4 w-4" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            <span style={{ color: info.outline }}>Marker</span> · {info.label} at {m.lat.toFixed(3)}, {m.lng.toFixed(3)}
            {assigneeEmail && (
              <span className="ml-2 inline-flex items-center rounded-full bg-copper/10 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide-caps text-copper-700">
                → {assigneeEmail.split("@")[0]}
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground font-mono-num truncate">
            {timeAgo(m.updated_at)}
            {m.notes ? ` · ${m.notes}` : ""}
          </p>
        </div>
        <IconChevronRight className="h-4 w-4 text-foreground/30 group-hover:text-copper transition-colors" />
      </div>
    </Link>
  );
}
