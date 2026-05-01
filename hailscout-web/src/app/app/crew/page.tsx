"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useTeam, type TeamMember } from "@/hooks/useTeam";
import { useMarkers } from "@/hooks/useMarkers";
import { useTerritories } from "@/hooks/useTerritories";
import { useReports } from "@/hooks/useReports";
import { MARKER_STATUSES, statusInfo, type Marker } from "@/lib/markers";
import { timeAgo } from "@/lib/time-ago";
import { EmptyState } from "@/components/app/empty-state";
import { IconUsers, IconChevronRight } from "@/components/icons";
import { cn } from "@/lib/utils";

interface CrewStats {
  member: TeamMember;
  markerCount: number;
  byStatus: Map<string, number>;
  contracts: number;
  knocked: number;
  appts: number;
  territoryCount: number;
  reportsCount: number;
  lastActivity: string | null;
}

export default function CrewPage() {
  const { members, isLoading: teamLoading } = useTeam();
  const { markers } = useMarkers();
  const { territories } = useTerritories();
  const { reports } = useReports();

  const stats: CrewStats[] = useMemo(() => {
    return members.map((m) => {
      const mine = markers.filter((mk) => mk.assignee_user_id === m.id);
      const byStatus = new Map<string, number>();
      for (const mk of mine) {
        byStatus.set(mk.status, (byStatus.get(mk.status) ?? 0) + 1);
      }
      const myReports = reports.filter((r) => r.user_id === m.id);
      const lastTs = [
        ...mine.map((mk) => new Date(mk.updated_at).getTime()),
        ...myReports.map((r) => new Date(r.created_at).getTime()),
      ];
      const last = lastTs.length > 0 ? new Date(Math.max(...lastTs)).toISOString() : null;
      return {
        member: m,
        markerCount: mine.length,
        byStatus,
        contracts: byStatus.get("contract") ?? 0,
        knocked:   byStatus.get("knocked") ?? 0,
        appts:     byStatus.get("appt") ?? 0,
        territoryCount: territories.filter((t) => t.assignee_user_id === m.id).length,
        reportsCount: myReports.length,
        lastActivity: last,
      };
    });
  }, [members, markers, territories, reports]);

  // Sort: contracts desc, then markers desc
  const sorted = [...stats].sort((a, b) => b.contracts - a.contracts || b.markerCount - a.markerCount);

  // Aggregate
  const total = {
    markers: markers.length,
    contracts: markers.filter((m) => m.status === "contract").length,
    knocked:   markers.filter((m) => m.status === "knocked").length,
    appts:     markers.filter((m) => m.status === "appt").length,
  };

  if (!teamLoading && members.length === 0) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="container max-w-3xl py-10">
          <EmptyState
            icon={IconUsers}
            eyebrow="Crew dashboard"
            title="Invite your crew"
            description="Once teammates accept their invite, you'll see per-member metrics here — markers dropped, contracts closed, territories assigned."
            primary={{ label: "Open team management", href: "/app/team" }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="container max-w-6xl py-10 space-y-8">
        <div>
          <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-copper">Crew</p>
          <h1 className="mt-1 font-display text-4xl font-medium tracking-tight-display text-foreground">
            Performance dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {members.length} member{members.length === 1 ? "" : "s"} · {total.markers} markers · {total.contracts} contracts
          </p>
        </div>

        <div className="rule-atlas" />

        {/* Workspace totals */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Total markers"   value={total.markers}   />
          <Stat label="Doors knocked"   value={total.knocked}   />
          <Stat label="Appointments"    value={total.appts}     />
          <Stat label="Contracts"       value={total.contracts} accent />
        </div>

        {/* Per-member cards */}
        <div className="grid gap-4 md:grid-cols-2">
          {sorted.map((s, i) => (
            <CrewCard key={s.member.id} stats={s} rank={i + 1} maxContracts={Math.max(1, ...stats.map((x) => x.contracts))} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <p className="text-[10px] font-mono uppercase tracking-wide-caps text-foreground/55">{label}</p>
      <p className={cn(
        "mt-1 font-display text-3xl font-medium tracking-tight-display",
        accent ? "text-copper" : "text-foreground",
      )}>
        {value}
      </p>
    </div>
  );
}

function CrewCard({
  stats: s, rank, maxContracts,
}: { stats: CrewStats; rank: number; maxContracts: number }) {
  const initials = s.member.email.split("@")[0].slice(0, 2).toUpperCase();
  const conversionPct = s.knocked > 0 ? Math.round((s.contracts / s.knocked) * 100) : 0;
  const isLeader = rank === 1 && s.contracts > 0;

  return (
    <div className={cn(
      "rounded-xl border bg-card p-5",
      isLeader ? "border-copper/40 shadow-atlas-lg" : "border-border",
    )}>
      <div className="flex items-start gap-4">
        <Avatar email={s.member.email} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-display text-xl font-medium tracking-tight-display text-foreground truncate">
              {s.member.email.split("@")[0]}
            </p>
            {isLeader && (
              <span className="inline-flex items-center rounded-full bg-copper/15 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide-caps text-copper-700 ring-1 ring-copper/30">
                Top closer
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {s.member.role}
            {s.lastActivity ? ` · last active ${timeAgo(s.lastActivity)}` : " · no activity yet"}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <SmallStat label="Markers"   value={s.markerCount} />
        <SmallStat label="Contracts" value={s.contracts} accent />
        <SmallStat label="Appts"     value={s.appts} />
        <SmallStat label="Reports"   value={s.reportsCount} />
      </div>

      {/* Status breakdown bar */}
      {s.markerCount > 0 && (
        <div className="mt-4">
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-foreground/5">
            {MARKER_STATUSES.map((ms) => {
              const c = s.byStatus.get(ms.id) ?? 0;
              if (c === 0) return null;
              return (
                <div
                  key={ms.id}
                  title={`${ms.label}: ${c}`}
                  style={{ background: ms.color, width: `${(c / s.markerCount) * 100}%` }}
                />
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-mono uppercase tracking-wide-caps text-foreground/55">
            {MARKER_STATUSES.map((ms) => {
              const c = s.byStatus.get(ms.id) ?? 0;
              if (c === 0) return null;
              return (
                <span key={ms.id} className="inline-flex items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: ms.color }} />
                  {ms.label} · {c}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {s.territoryCount > 0 && (
            <>
              {s.territoryCount} territor{s.territoryCount === 1 ? "y" : "ies"} · {conversionPct}% close rate
            </>
          )}
        </span>
        <Link
          href={`/app/markers`}
          className="inline-flex items-center gap-1 text-copper hover:text-copper-700 font-mono uppercase tracking-wide-caps"
        >
          See markers <IconChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Contracts vs leader */}
      <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-foreground/5">
        <div
          className="h-full bg-copper"
          style={{ width: `${(s.contracts / Math.max(1, maxContracts)) * 100}%` }}
        />
      </div>
    </div>
  );
}

function SmallStat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-secondary/30 p-3">
      <p className="text-[10px] font-mono uppercase tracking-wide-caps text-foreground/55">{label}</p>
      <p className={cn(
        "mt-1 font-display text-2xl font-medium tracking-tight-display",
        accent ? "text-copper" : "text-foreground",
      )}>
        {value}
      </p>
    </div>
  );
}

function Avatar({ email }: { email: string }) {
  const local = email.split("@")[0];
  const parts = local.split(/[._-]/).filter(Boolean);
  const initials =
    parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : local.slice(0, 2).toUpperCase();
  let h = 0;
  for (let i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return (
    <span
      className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-medium ring-1 ring-border"
      style={{ background: `hsl(${hue} 30% 88%)`, color: `hsl(${hue} 50% 25%)` }}
    >
      {initials}
    </span>
  );
}
