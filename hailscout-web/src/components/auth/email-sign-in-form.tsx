"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

/**
 * Email + password sign-in (LOGIN-STANDARD: always present, social additive).
 * Posts to the BFF (/api/auth/password) which sets the httpOnly session
 * cookies — credentials and tokens never sit in browser-readable state.
 *
 * SMS 2FA: the code field stays hidden until the API answers `mfa_required`
 * (correct password on an enrolled account — that answer is also what texts
 * the code). Submitting again without a code re-sends a fresh one. "Remember
 * this device" stores a 90-day httpOnly trust cookie so this browser skips
 * the code next time.
 */
export function EmailSignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Revealed only after the API answers mfa_required.
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [rememberDevice, setRememberDevice] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const postLogin = async (withCode: boolean) => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          ...(withCode && mfaCode.trim() ? { mfa_code: mfaCode.trim() } : {}),
          ...(mfaStep ? { remember_device: rememberDevice } : {}),
        }),
      });
      const data = await res.json().catch(() => null);

      if (res.status === 401 && data?.error === "mfa_required") {
        setMfaStep(true);
        setMfaCode("");
        setNotice(
          data.detail ??
            (data.phone
              ? `We texted a 6-digit code to ${data.phone}.`
              : "We texted a 6-digit code to your phone."),
        );
        return;
      }
      if (res.status === 401 && data?.error === "invalid_mfa_code") {
        setError(data.detail ?? "That code didn't match. Try a fresh one.");
        return;
      }
      if (!res.ok) {
        setError(data?.detail ?? "Sign-in failed. Please try again.");
        return;
      }

      // Grace window lapsed (owner/admin): only MFA enrollment is allowed.
      if (data?.mfa_enrollment_required) {
        router.replace("/mfa/enroll");
        return;
      }
      // Grace window running: land on Settings → Security so they enroll.
      if (data?.mfa_enrollment?.required) {
        router.replace("/app/settings?tab=security&mfaNag=1");
        return;
      }
      router.replace("/app/map");
    } catch {
      setError("Our servers are unreachable right now. Please try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await postLogin(true);
  };

  // Re-submitting email+password WITHOUT a code = the API texts a fresh one
  // (its mfa_required answer re-populates the notice).
  const resend = async () => {
    setMfaCode("");
    setNotice(null);
    await postLogin(false);
  };

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-3">
      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {notice && !error && (
        <p className="rounded-md border border-border bg-secondary/40 px-4 py-3 text-sm text-foreground">
          {notice}
        </p>
      )}

      <input
        type="email"
        required
        autoComplete="email"
        placeholder="you@company.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={mfaStep}
        className="w-full rounded-md border border-border bg-card px-4 py-3 text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
      />
      <input
        type="password"
        required
        autoComplete="current-password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={mfaStep}
        className="w-full rounded-md border border-border bg-card px-4 py-3 text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
      />

      {mfaStep && (
        <div className="space-y-2 rounded-md border border-border bg-card/60 p-3">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="6-digit code"
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value)}
            className="w-full rounded-md border border-border bg-card px-4 py-3 text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={rememberDevice}
              onChange={(e) => setRememberDevice(e.target.checked)}
              className="h-3.5 w-3.5 accent-current"
            />
            Remember this device for 90 days (skip the code here next time)
          </label>
          <button
            type="button"
            onClick={resend}
            disabled={busy}
            className="text-xs text-muted-foreground underline-offset-4 hover:underline disabled:opacity-60"
          >
            Resend code
          </button>
        </div>
      )}

      <button
        type="submit"
        disabled={busy || (mfaStep && mfaCode.trim().length < 6)}
        className="w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
      >
        {busy ? "Signing in…" : mfaStep ? "Verify code" : "Sign in"}
      </button>

      <p className="text-center text-xs">
        <Link href="/forgot-password" className="text-muted-foreground underline-offset-4 hover:underline">
          Forgot password? (also sets your first password)
        </Link>
      </p>
    </form>
  );
}
