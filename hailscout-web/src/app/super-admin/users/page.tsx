"use client";

/**
 * Super-admin: promote/demote users to super-admin.
 *
 * Uses POST /v1/admin/users/super-admin. Server-side guard prevents
 * revoking the last super-admin.
 */
import { useState } from "react";
import { useAuth } from "@clerk/nextjs";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.hailscout.com";

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
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user_email: email, is_super_admin: grant }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.detail ?? `Failed (${res.status})`);
      } else {
        setMessage(
          `${grant ? "Promoted" : "Demoted"}: ${body.email} (org=${body.org_id})`,
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="text-sm text-muted-foreground">
          Grant or revoke cross-tenant super-admin access.
        </p>
      </header>

      <form onSubmit={submit} className="rounded-md border p-4 space-y-3">
        <input
          type="email"
          required
          placeholder="user@example.com"
          className="w-full rounded-md border px-3 py-2 text-sm"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div className="flex items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={grant}
              onChange={() => setGrant(true)}
            />
            Grant super-admin
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={!grant}
              onChange={() => setGrant(false)}
            />
            Revoke super-admin
          </label>
        </div>
        <button
          type="submit"
          disabled={busy || !email}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Submitting…" : "Apply"}
        </button>
      </form>

      {message && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-300">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}
