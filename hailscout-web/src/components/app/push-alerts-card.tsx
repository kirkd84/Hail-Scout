"use client";

import { useState } from "react";
import { usePush } from "@/hooks/usePush";
import { cn } from "@/lib/utils";

/**
 * Web-push config card. Two levels: the org toggle (does this workspace send
 * push at all) and this device's subscription (install the field app, allow
 * notifications). A push lands on the lock screen the instant hail hits.
 */
export function PushAlertsCard() {
  const { config, supported, subscribedHere, setEnabled, subscribeHere, unsubscribeHere, test } = usePush();
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [tone, setTone] = useState<"good" | "bad" | "info">("good");

  const configured = config?.configured ?? false;
  const enabled = config?.enabled ?? false;

  const say = (msg: string, t: "good" | "bad" | "info" = "good") => {
    setTone(t);
    setFlash(msg);
    setTimeout(() => setFlash(null), 4000);
  };

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      say(ok);
    } catch (e) {
      say(e instanceof Error ? e.message : "Something went wrong", "bad");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-foreground/55">
            Integrations
          </p>
          <h2 className="mt-1 font-display text-2xl font-medium tracking-tight-display">
            Push notifications
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A lock-screen notification the instant a monitored address is hit.
            Install HailScout to your home screen, then enable it here.
          </p>
        </div>
        <ConnectionBadge connected={enabled && subscribedHere} />
      </div>

      <div className="mt-6 space-y-5">
        {!configured && (
          <p className="rounded-md border border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
            Push isn&apos;t connected yet. Set the VAPID keys on the API server to
            enable it.
          </p>
        )}
        {!supported && (
          <p className="rounded-md border border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
            This browser can&apos;t receive push. On iPhone/iPad, add HailScout to
            your Home Screen first, then open it from there.
          </p>
        )}

        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => void run(() => setEnabled(e.target.checked), "Saved")}
            className="accent-copper h-4 w-4"
            disabled={busy || !configured}
          />
          <span className="text-sm">
            <span className="font-medium text-foreground">Send alerts by push</span>{" "}
            <span className="text-muted-foreground">— for this whole workspace</span>
          </span>
        </label>

        <div className="rounded-lg border border-border bg-background p-4">
          <p className="text-sm font-medium text-foreground">This device</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {subscribedHere
              ? "This device is set up to receive push alerts."
              : "Turn on notifications for this phone or computer."}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {subscribedHere ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(unsubscribeHere, "Disabled on this device")}
                className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:border-destructive/40 hover:text-destructive disabled:opacity-60"
              >
                Disable on this device
              </button>
            ) : (
              <button
                type="button"
                disabled={busy || !supported || !configured}
                onClick={() => void run(subscribeHere, "Enabled on this device")}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-atlas hover:bg-teal-900 disabled:opacity-60"
              >
                Enable on this device
              </button>
            )}
            {subscribedHere && configured && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const r = await test();
                    if (!r?.ok) throw new Error("No test push delivered");
                  }, "Test push sent")
                }
                className="text-[11px] font-mono uppercase tracking-wide-caps text-foreground/55 hover:text-copper disabled:opacity-60"
              >
                Send test push
              </button>
            )}
          </div>
        </div>

        {flash && (
          <p
            className={cn(
              "text-xs font-mono uppercase tracking-wide-caps",
              tone === "good" && "text-forest",
              tone === "bad" && "text-destructive",
              tone === "info" && "text-copper",
            )}
          >
            {flash}
          </p>
        )}
      </div>
    </section>
  );
}

function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-wide-caps",
        connected
          ? "bg-forest/10 text-forest ring-1 ring-forest/30"
          : "bg-muted text-foreground/55 ring-1 ring-border",
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", connected ? "bg-forest" : "bg-foreground/35")} />
      {connected ? "On" : "Off"}
    </span>
  );
}
