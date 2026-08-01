"use client";

import { useState } from "react";
import { apiClient } from "@/lib/api";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-chrome";

/**
 * Public account-deletion page (hailgps.com/account/delete).
 *
 * Reachable WITHOUT signing in — Google Play / App Store require a deletion
 * path users can reach even if they're locked out. Records the request via
 * the public API endpoint; the team completes deletion within 30 days.
 */
export default function DeleteAccountPage() {
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  const submit = async () => {
    if (!email.trim() || !confirm || status === "sending") return;
    setStatus("sending");
    try {
      const r = await apiClient.post<{ ok: boolean; message: string }>(
        "/v1/account/deletion-request",
        { email: email.trim(), reason: reason.trim() || undefined },
      );
      setMsg(r.message);
      setStatus("done");
    } catch {
      setStatus("error");
      setMsg(
        "Something went wrong submitting the request. Please email privacy@hailgps.com and we'll handle it.",
      );
    }
  };

  return (
    <main className="bg-background text-foreground">
      <SiteHeader />
      <div className="container max-w-2xl py-16 md:py-24">
        <p className="eyebrow">Account &amp; data</p>
        <h1 className="display-2 mt-3 text-foreground">
          Delete your Hail GPS account
        </h1>
        <p className="mt-4 max-w-prose text-base leading-[1.65] text-muted-foreground">
          Request permanent deletion of your account and the personal data tied to
          it. You don&apos;t need to be signed in. We complete deletions within 30
          days and email a confirmation.
        </p>
        <div className="rule-atlas my-8" />

        <div className="grid gap-6 text-sm sm:grid-cols-2">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wide-caps text-foreground/55">
              What gets deleted
            </p>
            <ul className="mt-2 space-y-1 text-foreground/85">
              <li>• Your account &amp; profile (name, email, role)</li>
              <li>• Saved / monitored addresses</li>
              <li>• Canvassing markers &amp; notes you created</li>
              <li>• Alert subscriptions &amp; history</li>
            </ul>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wide-caps text-foreground/55">
              What we keep
            </p>
            <ul className="mt-2 space-y-1 text-foreground/85">
              <li>• Public NOAA/SPC weather data (not personal to you)</li>
              <li>• Anonymized, aggregated usage with no identifiers</li>
              <li>• Records we&apos;re legally required to retain (e.g. billing)</li>
            </ul>
          </div>
        </div>

        {status === "done" ? (
          <div className="mt-8 rounded-xl border border-copper/30 bg-copper/5 p-6">
            <p className="eyebrow">Request received</p>
            <p className="mt-2 text-sm leading-relaxed text-foreground/85">{msg}</p>
          </div>
        ) : (
          <div className="mt-8 space-y-4 rounded-xl border border-border bg-card p-6">
            <div>
              <label
                htmlFor="delete-email"
                className="mb-1.5 block font-mono text-[11px] uppercase tracking-wide-caps text-foreground/55"
              >
                Account email
              </label>
              <input
                id="delete-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="min-h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-copper"
              />
            </div>
            <div>
              <label
                htmlFor="delete-reason"
                className="mb-1.5 block font-mono text-[11px] uppercase tracking-wide-caps text-foreground/55"
              >
                Reason (optional)
              </label>
              <textarea
                id="delete-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-copper"
              />
            </div>
            <label className="flex min-h-11 cursor-pointer items-start gap-2.5 text-sm text-foreground/85">
              <input
                type="checkbox"
                checked={confirm}
                onChange={(e) => setConfirm(e.target.checked)}
                className="mt-1 h-4 w-4"
              />
              <span>
                I understand this permanently deletes my account and associated
                data and can&apos;t be undone.
              </span>
            </label>
            {status === "error" && (
              <p className="text-sm text-destructive">{msg}</p>
            )}
            <button
              type="button"
              onClick={submit}
              disabled={!email.trim() || !confirm || status === "sending"}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-copper-700 disabled:opacity-50"
            >
              {status === "sending" ? "Submitting…" : "Request account deletion"}
            </button>
            <p className="text-xs text-muted-foreground">
              Prefer email? Write{" "}
              <a
                className="text-copper-700 underline"
                href="mailto:privacy@hailgps.com?subject=Account%20deletion%20request"
              >
                privacy@hailgps.com
              </a>
              . See our{" "}
              <a className="text-copper-700 underline" href="/privacy">
                Privacy Policy
              </a>
              .
            </p>
          </div>
        )}
      </div>
      <SiteFooter />
    </main>
  );
}
