"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiClient } from "@/lib/api";
import { timeAgo } from "@/lib/time-ago";
import { cn } from "@/lib/utils";

interface AuditEvent {
  id: number;
  ts: string;
  org_id: string | null;
  user_id: string | null;
  user_email: string | null;
  action: string;
  subject_type: string | null;
  subject_id: string | null;
  metadata: Record<string, unknown> | null;
}

const ACTION_TONE: Record<string, { color: string; bg: string }> = {
  "alerts.generated":          { color: "#7A4A0E", bg: "rgba(216, 124, 74, 0.10)" },
  "marker.created":            { color: "#1A6B36", bg: "rgba(54, 193, 104, 0.10)" },
  "report.saved":              { color: "#0F4C5C", bg: "rgba(15, 76, 92, 0.10)"  },
  "branding.updated":          { color: "#0F4C5C", bg: "rgba(15, 76, 92, 0.10)"  },
  "integration.slack.updated": { color: "#7A340D", bg: "rgba(234, 122, 44, 0.10)" },
  "team.role_changed":         { color: "#491657", bg: "rgba(142, 60, 168, 0.10)" },
  "team.member_removed":       { color: "#791F1F", bg: "rgba(192, 57, 43, 0.10)" },
};

export default function AuditPage() {
  const { getToken } = useAuth();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<string>("");

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const t = await getToken();
        const params = new URLSearchParams();
        if (actionFilter) params.set("action", actionFilter);
        params.set("limit", "200");
        const url = `/v1/admin/audit?${params}`;
        const res = await apiClient.get<AuditEvent[]>(url, t || undefined);
        setEvents(res);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load audit");
      } finally {
        setLoading(false);
      }
    })();
  }, [getToken, actionFilter]);

  const ALL_ACTIONS = Array.from(new Set(events.map((e) => e.action))).sort();

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-copper">
          Cross-tenant
        </p>
        <h1 className="mt-1 font-display text-3xl font-medium tracking-tight-display text-foreground">
          Audit log
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every workspace operation across every tenant. Newest first.
        </p>
      </div>
      <div className="rule-atlas" />

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-foreground/55 mr-2">
          Filter by action:
        </p>
        <button
          type="button"
          onClick={() => setActionFilter("")}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-mono uppercase tracking-wide-caps transition-colors",
            actionFilter === ""
              ? "bg-primary text-primary-foreground"
              : "border border-border bg-card text-foreground/65 hover:border-copper/40",
          )}
        >
          All
        </button>
        {ALL_ACTIONS.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setActionFilter(a)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-mono uppercase tracking-wide-caps transition-colors",
              actionFilter === a
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-foreground/65 hover:border-copper/40",
            )}
          >
            {a}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-[120px_180px_2fr_2fr_1.5fr] border-b border-border bg-secondary/40 text-[11px] font-mono uppercase tracking-wide-caps text-foreground/65">
          <div className="px-4 py-3">When</div>
          <div className="px-4 py-3">Action</div>
          <div className="px-4 py-3">Org / User</div>
          <div className="px-4 py-3">Subject</div>
          <div className="px-4 py-3">Detail</div>
        </div>

        {loading && (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">Loading…</div>
        )}

        {!loading && events.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            No events yet.
          </div>
        )}

        {events.map((e, i) => {
          const tone = ACTION_TONE[e.action] ?? { color: "#444", bg: "rgba(0,0,0,0.05)" };
          return (
            <div
              key={e.id}
              className={cn(
                "grid grid-cols-[120px_180px_2fr_2fr_1.5fr] items-start text-xs",
                i < events.length - 1 ? "border-b border-border/60" : "",
              )}
            >
              <div className="px-4 py-3 text-foreground/85 font-mono-num">{timeAgo(e.ts)}</div>
              <div className="px-4 py-3">
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wide-caps"
                  style={{ background: tone.bg, color: tone.color }}
                >
                  {e.action}
                </span>
              </div>
              <div className="px-4 py-3 min-w-0">
                <div className="font-medium text-foreground truncate">
                  {e.user_email || e.user_id || "system"}
                </div>
                <div className="font-mono-num text-foreground/55 truncate">{e.org_id ?? "—"}</div>
              </div>
              <div className="px-4 py-3 min-w-0">
                {e.subject_type ? (
                  <div className="font-mono-num text-foreground/85 truncate">
                    {e.subject_type} · {e.subject_id ?? "—"}
                  </div>
                ) : (
                  <span className="text-foreground/40">—</span>
                )}
              </div>
              <div className="px-4 py-3 font-mono-num text-foreground/65 truncate">
                {e.metadata
                  ? Object.entries(e.metadata)
                      .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
                      .join(" · ")
                  : "—"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
