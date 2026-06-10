"use client";

import { useState } from "react";
import Link from "next/link";
import { ContourBg } from "@/components/brand/contour-bg";
import { Wordmark } from "@/components/brand/wordmark";

/** Request a password-reset link (doubles as set-initial-password). */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await fetch("/api/auth/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
    } catch {
      /* same outcome either way — no enumeration */
    }
    setSent(true);
    setBusy(false);
  };

  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      <ContourBg className="opacity-90" density="sparse" fadeBottom={false} />
      <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
        <div className="mb-8">
          <Wordmark size="lg" />
        </div>
        <h1 className="mb-6 font-display text-2xl font-medium tracking-tight-display text-foreground">
          Reset your password
        </h1>

        {sent ? (
          <div className="w-full max-w-sm space-y-4 text-center">
            <p className="rounded-md border border-border bg-card px-4 py-3 text-sm text-card-foreground">
              If that email is registered, a reset link is on its way. The link
              works for 1 hour.
            </p>
            <Link href="/sign-in" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="w-full max-w-sm space-y-3">
            <p className="text-center text-sm text-muted-foreground">
              Enter your work email and we&apos;ll send a link to set a new password.
            </p>
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-4 py-3 text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {busy ? "Sending…" : "Send reset link"}
            </button>
            <p className="text-center text-xs">
              <Link href="/sign-in" className="text-muted-foreground underline-offset-4 hover:underline">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
