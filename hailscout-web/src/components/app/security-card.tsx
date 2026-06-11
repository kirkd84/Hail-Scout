"use client";

import { useState } from "react";
import { apiErrorMessage, useMfa } from "@/hooks/useMfa";

/**
 * Settings → Security: SMS two-factor (LOGIN-STANDARD §4 — text codes only,
 * no authenticator apps).
 *
 *   • Enroll: phone → texted 6-digit code → confirm → recovery codes (once).
 *   • Enrolled: masked phone, regenerate recovery codes, turn off (both
 *     gated by a fresh texted code or a recovery code), and remembered-
 *     device management ("forget all devices").
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

function RecoveryCodesPanel({
  codes,
  onDone,
  doneLabel,
}: {
  codes: string[];
  onDone: () => void;
  doneLabel: string;
}) {
  const download = () => {
    const blob = new Blob(
      [
        "HailScout recovery codes\n" +
          "Each code signs you in once if you lose your phone. Store them somewhere safe.\n\n" +
          codes.join("\n") +
          "\n",
      ],
      { type: "text/plain" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "hailscout-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-foreground">
        Save your recovery codes — each one signs you in once if you ever lose
        your phone. They won&apos;t be shown again:
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border border-border bg-card p-3 font-mono text-xs">
        {codes.map((rc) => (
          <span key={rc}>{rc}</span>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={download} className={ghostBtn}>
          Download .txt
        </button>
        <button type="button" onClick={onDone} className={primaryBtn}>
          {doneLabel}
        </button>
      </div>
    </div>
  );
}

/** Phone → texted code → recovery codes. Used voluntarily and force-enroll. */
export function MfaEnrollFlow({
  onDone,
}: {
  onDone: (reloginRequired: boolean) => void;
}) {
  const { smsStart, smsVerify } = useMfa();
  const [step, setStep] = useState<"phone" | "code" | "codes">("phone");
  const [phone, setPhone] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [reloginRequired, setReloginRequired] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await smsStart(phone.trim());
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
    setBusy(true);
    try {
      await smsStart(phone.trim());
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
      setRecoveryCodes(res.recovery_codes);
      setReloginRequired(res.relogin_required);
      setStep("codes");
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
          placeholder="+15551234567"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          We&apos;ll text a 6-digit code here at each sign-in. Use international
          format (+1 for the US).
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
      <RecoveryCodesPanel
        codes={recoveryCodes}
        onDone={() => onDone(reloginRequired)}
        doneLabel="Done"
      />
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
          ? `We texted a code to ${res.phone}. You can also use a recovery code.`
          : "Texting is not fully configured — the code is in the server logs. A recovery code works too.",
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
          placeholder="Code or recovery code"
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
  const [freshCodes, setFreshCodes] = useState<string[] | null>(null);
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

        {!mfa.isLoading && !mfa.status?.enrolled && !freshCodes && (
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

            {freshCodes ? (
              <RecoveryCodesPanel
                codes={freshCodes}
                onDone={() => setFreshCodes(null)}
                doneLabel="I saved them"
              />
            ) : (
              <div className="flex flex-col gap-3 border-t border-border pt-4">
                <CodeGatedAction
                  label="Regenerate recovery codes"
                  confirmLabel="Regenerate"
                  onSend={mfa.smsSend}
                  onConfirm={async (code) => {
                    const res = await mfa.regenerateRecovery(code);
                    setFreshCodes(res.recovery_codes);
                  }}
                />
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
            )}
          </>
        )}
      </div>
    </section>
  );
}
