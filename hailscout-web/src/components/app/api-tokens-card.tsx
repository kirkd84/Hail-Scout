"use client";

import { useState } from "react";
import { useApiTokens, type ApiTokenCreated } from "@/hooks/useApiTokens";

/**
 * Personal access tokens for the read-only API. Generate (shown once), list,
 * and revoke. Replaces the old "On the way" placeholder.
 */
export function ApiTokensCard() {
  const { tokens, create, revoke } = useApiTokens();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<ApiTokenCreated | null>(null);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onCreate = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const row = await create(name.trim());
      if (row) {
        setCreated(row);
        setName("");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't create token");
    } finally {
      setBusy(false);
    }
  };

  const copy = () => {
    if (!created) return;
    void navigator.clipboard?.writeText(created.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const active = tokens.filter((t) => !t.revoked);

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-foreground/55">
        API
      </p>
      <h2 className="mt-1 font-display text-2xl font-medium tracking-tight-display">
        API tokens
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Read-only personal access tokens. Send as{" "}
        <span className="font-mono">Authorization: Bearer hsk_…</span> to query
        markers, addresses, and alerts. Full spec at{" "}
        <span className="font-mono">/v1/openapi.json</span>.
      </p>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Token name (e.g. Zapier, internal dashboard)"
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-copper focus:outline-none"
        />
        <button
          type="button"
          onClick={() => void onCreate()}
          disabled={busy || !name.trim()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-atlas hover:bg-teal-900 disabled:opacity-60"
        >
          {busy ? "Generating…" : "Generate token"}
        </button>
      </div>

      {err && <p className="mt-2 text-xs text-destructive">{err}</p>}

      {created && (
        <div className="mt-4 rounded-md border border-copper/40 bg-copper/5 p-4">
          <p className="text-xs font-medium text-copper-700">
            Copy your token now — you won&apos;t be able to see it again.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 break-all rounded bg-background px-2 py-1.5 font-mono text-xs text-foreground">
              {created.token}
            </code>
            <button
              type="button"
              onClick={copy}
              className="shrink-0 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:border-copper/50"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {active.length > 0 && (
        <ul className="mt-5 divide-y divide-border/60">
          {active.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{t.name}</p>
                <p className="font-mono-num text-xs text-muted-foreground">
                  {t.prefix}…{"  ·  "}
                  {t.last_used_at
                    ? `last used ${new Date(t.last_used_at).toLocaleDateString()}`
                    : "never used"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void revoke(t.id)}
                className="shrink-0 text-xs font-mono uppercase tracking-wide-caps text-foreground/55 hover:text-destructive"
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
