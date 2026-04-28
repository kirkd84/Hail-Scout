"use client";

/**
 * Super-admin: per-org usage drilldown.
 *
 * Lists every org and lets you click into per-tenant stats from
 * GET /v1/admin/orgs/{id}/usage.
 */
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.hailscout.com";

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
      <header>
        <h1 className="text-2xl font-semibold">Usage & Billing</h1>
        <p className="text-sm text-muted-foreground">
          Per-tenant stats. Most counters are stubbed pending Month 3 data
          pipeline integration.
        </p>
      </header>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
        <ul className="rounded-md border divide-y">
          {orgs.map((o) => (
            <li key={o.id}>
              <button
                onClick={() => loadUsage(o.id)}
                className={`w-full text-left px-4 py-3 hover:bg-muted ${
                  selected === o.id ? "bg-muted" : ""
                }`}
              >
                <div className="font-medium">{o.name}</div>
                <div className="text-xs text-muted-foreground">
                  {o.user_count} users · {o.plan_tier}
                </div>
              </button>
            </li>
          ))}
        </ul>

        <div className="rounded-md border p-6">
          {!selected && (
            <p className="text-muted-foreground">
              Select an org on the left to view usage.
            </p>
          )}
          {selected && !usage && <p>Loading…</p>}
          {usage && (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium">{usage.name}</dd>
              <dt className="text-muted-foreground">Plan tier</dt>
              <dd>{usage.plan_tier}</dd>
              <dt className="text-muted-foreground">Users</dt>
              <dd>{usage.user_count}</dd>
              <dt className="text-muted-foreground">Seats</dt>
              <dd>{usage.seat_count}</dd>
              <dt className="text-muted-foreground">Storms in period</dt>
              <dd>{usage.storms_in_period}</dd>
              <dt className="text-muted-foreground">Monitored addresses</dt>
              <dd>{usage.monitored_addresses}</dd>
              <dt className="text-muted-foreground">Impact reports</dt>
              <dd>{usage.impact_reports_generated}</dd>
              <dt className="text-muted-foreground">Last active</dt>
              <dd>
                {usage.last_active_at
                  ? new Date(usage.last_active_at).toLocaleString()
                  : "—"}
              </dd>
            </dl>
          )}
        </div>
      </div>
    </div>
  );
}
