"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

/**
 * Email + password sign-in (LOGIN-STANDARD: always present, social additive).
 * Posts to the BFF (/api/auth/password) which sets the httpOnly session
 * cookies — credentials and tokens never sit in browser-readable state.
 */
export function EmailSignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.detail ?? "Sign-in failed. Please try again.");
        return;
      }
      router.replace("/app/map");
    } catch {
      setError("Our servers are unreachable right now. Please try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-3">
      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <input
        type="email"
        required
        autoComplete="email"
        placeholder="you@company.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-md border border-border bg-card px-4 py-3 text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <input
        type="password"
        required
        autoComplete="current-password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full rounded-md border border-border bg-card px-4 py-3 text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>

      <p className="text-center text-xs">
        <Link href="/forgot-password" className="text-muted-foreground underline-offset-4 hover:underline">
          Forgot password? (also sets your first password)
        </Link>
      </p>
    </form>
  );
}
