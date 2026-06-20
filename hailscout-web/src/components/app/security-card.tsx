"use client";

import { useState } from "react";
import { apiErrorMessage, useMfa } from "@/hooks/useMfa";

/**
 * Settings → Security: SMS two-factor (LOGIN-STANDARD §4 — text codes only,
 * no authenticator apps).
 *
 *   • Enroll: phone → texted 6-digit code → confirm → done.
 *   • Enrolled: masked phone, turn off (gated by a fresh texted code), and
 *     remembered-device management ("forget all devices").
 *
 * Also rendered by /mfa/enroll for past-grace owners/admins holding the
 * restricted enrollment-scoped token (pass `enrollOnly`).
 */

const inputCls =
  "w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";
const primaryBtn =
  "inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60";
const ghostBtn =
  "inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60";

/**
 * Phone-input UX helpers (US-default). The MFA API still receives E.164
 * ("+1XXXXXXXXXX"); these only shape what the user types and sees.
 */

/** Live-format keystrokes to US "(xxx) xxx-xxxx"; a leading "+" stays raw. */
function formatUsPhone(v: string): string {
  if (v.trim().startsWith("+")) return "+" + v.replace(/[^\d]/g, "");
  const d = v.replace(/\D/g, "").slice(0, 10);
  if (!d) return "";
  if (d.length < 4) return `(${d}`;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/** Normalize the typed value to E.164, or null if it isn't a valid number. */
function toE164(v: string): string | null {
  v = v.trim();
  if (v.startsWith("+")) {
    const e = "+" + v.slice(1).replace(/\D/g, "");
    return /^\+[1-9]\d{7,14}$/.test(e) ? e : null;
  }
  const d = v.replace(/\D/g, "");
  if (d.length === 10) return "+1" + d;
  if (d.length === 11 && d.startsWith("1")) return "+" + d;
  return null;
}

function ErrorNote({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
      {msg}
    </p>
  );
}

function Notice({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <p className="rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs text-foreground">
      {msg}
    </p>
  );
}

/** Phone → texted code → done. Used voluntarily and force-enroll. */
export function MfaEnrollFlow({
  onDone,
}: {
  onDone: (reloginRequired: boolean) => void;
}) {
  const { smsStart, smsVerify } = useMfa();
  const [step, setStep] = useState<"phone" | "code" | "done">("phone");
  const [phone, setPhone] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [code, setCode] = useState("");
  const [reloginRequired, setReloginRequired] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const e164 = toE164(phone);
    if (!e164) {
      setError("Enter a 10-digit US mobile number, e.g. (555) 123-4567.");
      return;
    }
    setBusy(true);
    try {
      const res = await smsStart(e164);
      setMaskedPhone(res.phone);
      setNotice(
        res.sent
          ? null
          : "Texting is not fully configured yet — your code is in the server logs (setup only).",
      );
      setStep("code");
    } catch (err) {
      setError(apiErrorMessage(err, "Could not start enrollment. Check the number and try again."));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(null);
    const e164 = toE164(phone);
    if (!e164) {
      setError("Enter a 10-digit US mobile number, e.g. (555) 123-4567.");
      return;
    }
    setBusy(true);
    try {
      await smsStart(e164);
      setNotice("New code sent.");
    } catch (err) {
      setError(apiErrorMessage(err, "Could not resend the code."));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await smsVerify(code.trim());
      setReloginRequired(res.relogin_required);
      // Clear any transient "code sent"/"new code sent" notice so the success
      // state shows clean — no stale banner left over from earlier steps.
      setNotice(null);
      setStep("done");
    } catch (err) {
      setError(apiErrorMessage(err, "That code didn't match. Check the text and try again."));
    } finally {
      setBusy(false);
    }
  };

  if (step === "phone") {
    return (
      <form onSubmit={start} className="space-y-3">
        <label className="block text-[11px] font-mono uppercase tracking-wide-caps text-foreground/55">
          Mobile number
        </label>
        <input
          className={`${inputCls} max-w-[16rem]`}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="(555) 123-4567"
          required
          value={phone}
          onChange={(e) => setPhone(formatUsPhone(e.target.value))}
        />
        <p className="text-xs text-muted-foreground">
          We&apos;ll text your codes to this number. (Outside the US? Start with
          a +.)
        </p>
        <ErrorNote msg={error} />
        <button type="submit" className={primaryBtn} disabled={busy}>
          {busy ? "Sending…" : "Text me a code"}
        </button>
      </form>
    );
  }

  if (step === "code") {
    return (
      <form onSubmit={confirm} className="space-y-3">
        <p className="text-sm text-foreground">
          We texted a 6-digit code to{" "}
          <span className="font-mono-num">{maskedPhone}</span>.
        </p>
        <input
          className={`${inputCls} max-w-[10rem]`}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          required
          placeholder="6-digit code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <Notice msg={notice} />
        <ErrorNote msg={error} />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className={primaryBtn}
            disabled={busy || code.trim().length < 6}
          >
            {busy ? "Confirming…" : "Turn on two-factor"}
          </button>
          <button type="button" onClick={resend} disabled={busy} className={ghostBtn}>
            Resend code
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("phone");
              setCode("");
              setError(null);
              setNotice(null);
            }}
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            Change number
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">Two-factor is on.</p>
      <p className="text-sm text-muted-foreground">
        {reloginRequired
          ? "From now on we'll text a 6-digit code to your phone each time you sign in. Sign in again to continue."
          : "From now on we'll text a 6-digit code to your phone each time you sign in."}
      </p>
      <button
        type="button"
        onClick={() => onDone(reloginRequired)}
        className={primaryBtn}
      >
        {reloginRequired ? "Sign in again" : "Done"}
      </button>
    </div>
  );
}

/** Code-gated action: "Text me a code" → enter code → run. */
function CodeGatedAction({
  label,
  confirmLabel,
  danger,
  onSend,
  onConfirm,
}: {
  label: string;
  confirmLabel: string;
  danger?: boolean;
  onSend: () => Promise<{ sent: boolean; phone: string }>;
  onConfirm: (code: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const begin = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await onSend();
      setNotice(
        res.sent
          ? `We texted a 6-digit code to ${res.phone}.`
          : "Texting is not fully configured — the code is in the server logs.",
      );
      setOpen(true);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not send a code."));
    } finally {
      setBusy(false);
    }
  };

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onConfirm(code.trim());
      setOpen(false);
      setCode("");
      setNotice(null);
    } catch (err) {
      setError(apiErrorMessage(err, "That code didn't match."));
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={begin}
          disabled={busy}
          className={
            danger
              ? "inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive disabled:opacity-60"
              : ghostBtn
          }
        >
          {busy ? "Sending…" : label}
        </button>
        <ErrorNote msg={error} />
      </div>
    );
  }

  return (
    <form onSubmit={run} className="space-y-2">
      <Notice msg={notice} />
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${inputCls} max-w-[14rem]`}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          required
          placeholder="6-digit code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button
          type="submit"
          className={primaryBtn}
          disabled={busy || code.trim().length < 6}
        >
          {busy ? "Working…" : confirmLabel}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setCode("");
            setError(null);
          }}
          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          Cancel
        </button>
      </div>
      <ErrorNote msg={error} />
    </form>
  );
}

/** The full Settings → Security card. */
export function SecurityCard({ mfaNag }: { mfaNag?: boolean }) {
  const mfa = useMfa();
  const [deviceNotice, setDeviceNotice] = useState<string | null>(null);

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-foreground/55">
        Two-factor authentication
      </p>
      <h2 className="mt-1 font-display text-2xl font-medium tracking-tight-display">
        Text-message sign-in codes
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        A 6-digit code texted to your phone at sign-in — applies to
        email+password logins. Google/Microsoft sign-ins keep your provider&apos;s
        own two-factor.
      </p>

      <div className="mt-4 space-y-4">
        {mfaNag && !mfa.status?.enrolled && (
          <p className="rounded-md border border-copper/50 bg-copper/10 px-3 py-2 text-xs text-foreground">
            Your role requires two-factor for password sign-ins. Enroll below
            before the grace period ends or password sign-in will be limited
            to enrollment only.
          </p>
        )}

        {mfa.isLoading && (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}

        {!mfa.isLoading && !mfa.status?.enrolled && (
          <MfaEnrollFlow onDone={() => void mfa.refresh()} />
        )}

        {mfa.status?.enrolled && (
          <>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-[11px] font-mono uppercase tracking-wide-caps text-foreground/55">
                  Status
                </dt>
                <dd className="text-sm font-medium text-foreground">
                  On — codes go to{" "}
                  <span className="font-mono-num">{mfa.status.phone}</span>
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-mono uppercase tracking-wide-caps text-foreground/55">
                  Remembered devices
                </dt>
                <dd className="text-sm text-foreground">
                  {mfa.status.trusted_devices} active
                </dd>
              </div>
            </dl>

            {!mfa.status.sms_configured && (
              <Notice msg="The SMS gateway isn't configured yet — codes are written to the API logs instead of texted." />
            )}

            <div className="flex flex-col gap-3 border-t border-border pt-4">
              <CodeGatedAction
                label="Turn off two-factor"
                confirmLabel="Turn off"
                danger
                onSend={mfa.smsSend}
                onConfirm={async (code) => {
                  await mfa.disable(code);
                }}
              />
              <div className="space-y-2">
                <button
                  type="button"
                  className={ghostBtn}
                  onClick={async () => {
                    setDeviceNotice(null);
                    try {
                      await mfa.forgetTrustedDevices();
                      setDeviceNotice(
                        "All remembered devices forgotten — every device gets a texted code at its next sign-in.",
                      );
                    } catch (err) {
                      setDeviceNotice(
                        apiErrorMessage(err, "Could not forget devices."),
                      );
                    }
                  }}
                >
                  Forget all remembered devices
                </button>
                <Notice msg={deviceNotice} />
                <p className="text-xs text-muted-foreground">
                  Devices where you ticked &quot;remember this device&quot; skip the
                  texted code for 90 days. Forgetting them (or resetting your
                  password) revokes that everywhere.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
