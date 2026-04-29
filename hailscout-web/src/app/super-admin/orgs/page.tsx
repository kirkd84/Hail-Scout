"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { IconUsers } from "@/components/icons";

type OrgSummary = {
  id: string;
  name: string;
  plan_tier: string;
  user_count: number;
  created_at: string;
};

const PLAN_TIERS = ["free", "starter", "pro", "internal"] as const;
const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://hail-scout-production.up.railway.app";

export default function SuperAdminOrgsPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [orgs, setOrgs] = useState<OrgSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", plan_tier: "free", admin_email: "" });

  async function fetchOrgs() {
    setError(null);
    const token = await getToken();
    const res = await fetch(`${API}/v1/admin/orgs`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      setError(
        res.status === 403
          ? "You are not a super-admin. Contact kirk@copayee.com."
          : `Failed to load orgs: ${res.status} ${res.statusText}`,
      );
      return;
    }
    setOrgs((await res.json()) as OrgSummary[]);
  }

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    void fetchOrgs();
  }, [isLoaded, isSignedIn]);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${API}/v1/admin/orgs`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name,
          plan_tier: form.plan_tier,
          admin_email: form.admin_email || undefined,
        }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        setError(detail.detail ?? `Failed (${res.status})`);
        return;
      }
      setForm({ name: "", plan_tier: "free", admin_email: "" });
      setShowForm(false);
      void fetchOrgs();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-copper">Cross-tenant</p>
          <h1 className="mt-1 font-display text-3xl font-medium tracking-tight-display text-foreground">
            Organizations
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every tenant on HailScout. {orgs ? `${orgs.length} active.` : null}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-atlas transition-colors hover:bg-teal-900"
        >
          {showForm ? "Cancel" : "+ New tenant"}
        </button>
      </div>
      <div className="rule-atlas" />

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-copper/40 bg-copper/5 p-5 space-y-4"
        >
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="font-mono-num text-[10px] uppercase tracking-wide-caps text-foreground/55 block mb-1.5">
                Organization name
              </label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:border-copper focus:outline-none"
                placeholder="Acme Roofing Co."
              />
            </div>
            <div>
              <label className="font-mono-num text-[10px] uppercase tracking-wide-caps text-foreground/55 block mb-1.5">
                Plan tier
              </label>
              <select
                value={form.plan_tier}
                onChange={(e) => setForm({ ...form, plan_tier: e.target.value })}
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:border-copper focus:outline-none"
              >
                {PLAN_TIERS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-mono-num text-[10px] uppercase tracking-wide-caps text-foreground/55 block mb-1.5">
                Admin email (optional)
              </label>
              <input
                type="email"
                value={form.admin_email}
                onChange={(e) => setForm({ ...form, admin_email: e.target.value })}
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:border-copper focus:outline-none"
                placeholder="owner@acme.com"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center gap-1.5 rounded-md bg-copper px-4 py-2 text-sm font-medium text-primary-foreground shadow-atlas transition-colors hover:bg-copper-700 disabled:opacity-60"
            >
              {creating ? "Creating…" : "Create tenant"}
            </button>
          </div>
        </form>
      )}

      {!orgs ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : orgs.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <IconUsers className="mx-auto h-6 w-6 text-foreground/40" />
          <p className="mt-3 font-display text-xl text-foreground">No tenants yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">Create the first one above.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-[2fr_1fr_120px_1fr] border-b border-border bg-secondary/40 text-[11px] font-mono uppercase tracking-wide-caps text-foreground/65">
            <div className="px-5 py-3">Name</div>
            <div className="px-5 py-3">Plan</div>
            <div className="px-5 py-3">Users</div>
            <div className="px-5 py-3">Created</div>
          </div>
          {orgs.map((o, i) => (
            <div
              key={o.id}
              className={`grid grid-cols-[2fr_1fr_120px_1fr] hover:bg-secondary/30 transition-colors ${
                i < orgs.length - 1 ? "border-b border-border/60" : ""
              }`}
            >
              <div className="px-5 py-4">
                <p className="font-medium text-foreground">{o.name}</p>
                <p className="font-mono-num text-[11px] text-foreground/55">{o.id}</p>
              </div>
              <div className="px-5 py-4">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-mono uppercase tracking-wide-caps ${planTone(o.plan_tier)}`}>
                  {o.plan_tier}
                </span>
              </div>
              <div className="px-5 py-4 font-mono-num text-foreground/85">{o.user_count}</div>
              <div className="px-5 py-4 text-sm text-muted-foreground">
                {new Date(o.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function planTone(tier: string): string {
  switch (tier) {
    case "internal": return "bg-copper/15 text-copper-700 ring-1 ring-copper/30";
    case "pro":      return "bg-primary/10 text-primary ring-1 ring-primary/25";
    case "starter":  return "bg-forest/10 text-forest ring-1 ring-forest/25";
    default:         return "bg-secondary text-muted-foreground ring-1 ring-border";
  }
}
