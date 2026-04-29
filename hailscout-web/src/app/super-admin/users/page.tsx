"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://hail-scout-production.up.railway.app";

export default function SuperAdminUsersPage() {
  const { getToken } = useAuth();
  const [email, setEmail] = useState("");
  const [grant, setGrant] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${API}/v1/admin/users/super-admin`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ user_email: email, is_super_admin: grant }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.detail ?? `Failed (${res.status})`);
      } else {
        setMessage(`${grant ? "Promoted" : "Demoted"}: ${body.email} (org=${body.org_id})`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-copper">Cross-tenant</p>
        <h1 className="mt-1 font-display text-3xl font-medium tracking-tight-display text-foreground">
          Super-admins
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Grant or revoke cross-tenant access. The system prevents revoking the last super-admin.
        </p>
      </div>
      <div className="rule-atlas" />

      <form onSubmit={submit} className="rounded-xl border border-border bg-card p-6 space-y-5">
        <div>
          <label className="font-mono-num text-[10px] uppercase tracking-wide-caps text-foreground/55 block mb-1.5">
            User email
          </label>
          <input
            type="email"
            required
            placeholder="user@example.com"
            className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm focus:border-copper focus:outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <fieldset>
          <legend className="font-mono-num text-[10px] uppercase tracking-wide-caps text-foreground/55 mb-1.5">
            Action
          </legend>
          <div className="grid grid-cols-2 gap-2">
            <label className={`flex items-center gap-2 rounded-md border px-3 py-2.5 text-sm cursor-pointer transition-colors ${grant ? "border-copper bg-copper/5" : "border-border hover:border-copper/40"}`}>
              <input type="radio" name="grant" checked={grant} onChange={() => setGrant(true)} className="accent-copper" />
              Grant super-admin
            </label>
            <label className={`flex items-center gap-2 rounded-md border px-3 py-2.5 text-sm cursor-pointer transition-colors ${!grant ? "border-destructive/60 bg-destructive/5" : "border-border hover:border-destructive/40"}`}>
              <input type="radio" name="grant" checked={!grant} onChange={() => setGrant(false)} className="accent-destructive" />
              Revoke super-admin
            </label>
          </div>
        </fieldset>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={busy || !email}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-atlas transition-colors hover:bg-teal-900 disabled:opacity-60"
          >
            {busy ? "Applying…" : "Apply change"}
          </button>
        </div>
      </form>

      {message && (
        <div className="rounded-lg border border-forest/30 bg-forest/5 p-4 text-sm text-forest">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}
