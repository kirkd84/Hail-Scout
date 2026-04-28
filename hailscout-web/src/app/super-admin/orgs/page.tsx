"use client";

/**
 * Super-admin: list every tenant org + create new ones.
 *
 * Calls GET /v1/admin/orgs and POST /v1/admin/orgs. The server enforces the
 * super_admin role; if the user is not super_admin they see a 403 panel.
 */
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";

type OrgSummary = {
  id: string;
  name: string;
  plan_tier: string;
  user_count: number;
  created_at: string;
};

const PLAN_TIERS = ["free", "starter", "pro", "internal"] as const;

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.hailscout.com";

export default function SuperAdminOrgsPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [orgs, setOrgs] = useState<OrgSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    plan_tier: "free",
    admin_email: "",
  });

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
      await fetchOrgs();
    } finally {
      setCreating(false);
    }
  }

  if (!isLoaded) return <p>Loading…</p>;
  if (!isSignedIn) return <p>Please sign in.</p>;

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Organizations</h1>
          <p className="text-sm text-muted-foreground">
            Every tenant org. Create one to onboard a new customer.
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          {orgs ? `${orgs.length} orgs` : "…"}
        </span>
      </header>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <section className="rounded-md border">
        <div className="border-b bg-muted/30 px-4 py-3">
          <h2 className="font-medium">Create a new tenant</h2>
        </div>
        <form
          onSubmit={handleCreate}
          className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4"
        >
          <input
            required
            placeholder="Org name (e.g. Acme Roofing)"
            className="rounded-md border px-3 py-2 text-sm md:col-span-2"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <select
            className="rounded-md border px-3 py-2 text-sm"
            value={form.plan_tier}
            onChange={(e) => setForm({ ...form, plan_tier: e.target.value })}
          >
            {PLAN_TIERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            type="email"
            placeholder="Admin email (optional)"
            className="rounded-md border px-3 py-2 text-sm md:col-span-3"
            value={form.admin_email}
            onChange={(e) =>
              setForm({ ...form, admin_email: e.target.value })
            }
          />
          <button
            type="submit"
            disabled={creating || !form.name}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create org"}
          </button>
        </form>
      </section>

      <section className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30">
            <tr className="text-left">
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Plan</th>
              <th className="px-4 py-2 font-medium">Users</th>
              <th className="px-4 py-2 font-medium">Created</th>
              <th className="px-4 py-2 font-medium">ID</th>
            </tr>
          </thead>
          <tbody>
            {(orgs ?? []).map((o) => (
              <tr key={o.id} className="border-t">
                <td className="px-4 py-2 font-medium">{o.name}</td>
                <td className="px-4 py-2 text-muted-foreground">{o.plan_tier}</td>
                <td className="px-4 py-2">{o.user_count}</td>
                <td className="px-4 py-2 text-muted-foreground">
                  {new Date(o.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                  {o.id}
                </td>
              </tr>
            ))}
            {orgs && orgs.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No tenants yet. Create the first one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
