"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://hail-scout-production.up.railway.app";

type OrgSummary = {
  id: string;
  name: string;
  plan_tier: string;
  user_count: number;
  created_at: string;
};

type OrgUsage = {
  org_id: string;
  name: string;
  plan_tier: string;
  user_count: number;
  seat_count: number;
  storms_in_period: number;
  monitored_addresses: number;
  impact_reports_generated: number;
  last_active_at: string | null;
};

export default function SuperAdminUsagePage() {
  const { getToken } = useAuth();
  const [orgs, setOrgs] = useState<OrgSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [usage, setUsage] = useState<OrgUsage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      const res = await fetch(`${API}/v1/admin/orgs`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) {
        setError(`Failed to load orgs: ${res.status}`);
        return;
      }
      setOrgs(await res.json());
    })();
  }, [getToken]);

  async function loadUsage(orgId: string) {
    setSelected(orgId);
    setUsage(null);
    const token = await getToken();
    const res = await fetch(`${API}/v1/admin/orgs/${orgId}/usage`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      setError(`Failed to load usage: ${res.status}`);
      return;
    }
    setUsage(await res.json());
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-copper">Cross-tenant</p>
        <h1 className="mt-1 font-display text-3xl font-medium tracking-tight-display text-foreground">
          Usage &amp; billing
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Per-tenant stats. Most counters stubbed until the data pipeline lands.
        </p>
      </div>
      <div className="rule-atlas" />

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-5">
        <ul className="rounded-xl border border-border bg-card overflow-hidden">
          {orgs.map((o, i) => (
            <li key={o.id} className={i < orgs.length - 1 ? "border-b border-border/60" : ""}>
              <button
                onClick={() => loadUsage(o.id)}
                className={`w-full text-left px-4 py-3 transition-colors ${
                  selected === o.id ? "bg-copper/10" : "hover:bg-secondary/50"
                }`}
              >
                <p className="font-medium text-foreground">{o.name}</p>
                <p className="mt-0.5 font-mono-num text-[11px] text-foreground/55">
                  {o.user_count} user{o.user_count === 1 ? "" : "s"} · {o.plan_tier}
                </p>
              </button>
            </li>
          ))}
        </ul>

        <div className="rounded-xl border border-border bg-card p-6">
          {!selected && (
            <p className="text-sm text-muted-foreground">Select a tenant on the left.</p>
          )}
          {selected && !usage && (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
          {usage && (
            <>
              <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-copper">Tenant</p>
              <h2 className="mt-1 font-display text-2xl font-medium tracking-tight-display">{usage.name}</h2>
              <p className="font-mono-num text-[11px] text-foreground/55">{usage.org_id}</p>

              <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-3">
                <Stat label="Plan tier"          value={usage.plan_tier} />
                <Stat label="Users"              value={String(usage.user_count)} />
                <Stat label="Seats"              value={String(usage.seat_count)} />
                <Stat label="Storms in period"   value={String(usage.storms_in_period)} />
                <Stat label="Monitored adresses" value={String(usage.monitored_addresses)} />
                <Stat label="Impact reports"     value={String(usage.impact_reports_generated)} />
              </div>

              <div className="rule-atlas mt-7" />
              <p className="mt-4 text-sm">
                <span className="font-mono-num text-[11px] uppercase tracking-wide-caps text-foreground/55">Last active</span>
                <br />
                <span className="font-mono-num text-foreground/85">
                  {usage.last_active_at ? new Date(usage.last_active_at).toLocaleString() : "—"}
                </span>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-secondary/40 p-3">
      <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-foreground/55">{label}</p>
      <p className="mt-1 font-display text-2xl font-medium tracking-tight-display text-foreground">
        {value}
      </p>
    </div>
  );
}
