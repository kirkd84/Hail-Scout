"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ContourBg } from "@/components/brand/contour-bg";
import { Wordmark } from "@/components/brand/wordmark";

/** Complete a password reset from the emailed link (?token=...). */
export default function ResetPasswordPage() {
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token"));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.detail ?? "Reset failed. Request a new link.");
        return;
      }
      setDone(true);
    } catch {
      setError("Our servers are unreachable right now. Please try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      <ContourBg className="opacity-90" density="sparse" fadeBottom={false} />
      <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
        <div className="mb-8">
          <Wordmark size="lg" />
        </div>
        <h1 className="mb-6 font-display text-2xl font-medium tracking-tight-display text-foreground">
          Choose a new password
        </h1>

        {done ? (
          <div className="w-full max-w-sm space-y-4 text-center">
            <p className="rounded-md border border-border bg-card px-4 py-3 text-sm text-card-foreground">
              Password set. You&apos;re signed out everywhere — sign in with your
              new password.
            </p>
            <Link
              href="/sign-in"
              className="inline-block w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Go to sign in
            </Link>
          </div>
        ) : !token ? (
          <p className="w-full max-w-sm rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-center text-sm text-destructive">
            This reset link is missing its token. Use the link from your email,
            or <Link href="/forgot-password" className="underline">request a new one</Link>.
          </p>
        ) : (
          <form onSubmit={submit} className="w-full max-w-sm space-y-3">
            {error && (
              <p className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error}
              </p>
            )}
            <input
              type="password"
              required
              autoComplete="new-password"
              placeholder="New password (10+ characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-4 py-3 text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              type="password"
              required
              autoComplete="new-password"
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-4 py-3 text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {busy ? "Saving…" : "Set new password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
