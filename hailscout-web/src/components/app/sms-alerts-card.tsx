"use client";

import { useEffect, useState } from "react";
import { useSmsAlertsConfig } from "@/hooks/useSmsAlertsConfig";
import { cn } from "@/lib/utils";

/**
 * Per-org SMS-alert config card. Siblings the email + Slack cards on
 * Settings → Integrations. A text beats an email for getting a rep to the
 * door first. Up to 8 numbers per org. Sending requires Twilio configured
 * server-side; the card stays honest about that.
 */
export function SmsAlertsCard() {
  const { config, update, test } = useSmsAlertsConfig();

  const [draft, setDraft] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [flashTone, setFlashTone] = useState<"good" | "bad" | "info">("good");

  useEffect(() => {
    if (!config) return;
    setDraft(config.recipients.join(", "));
    setEnabled(config.enabled);
  }, [config]);

  const parseDraft = (raw: string): string[] =>
    raw
      .split(/[,\n;]+/)
      .map((s) => s.trim())
      .filter((s) => (s.match(/\d/g) || []).length >= 10);

  const count = parseDraft(draft).length;
  const configured = config?.configured ?? false;
  const canTest = enabled && count > 0 && configured;

  const handleSave = async () => {
    setBusy(true);
    setFlash(null);
    try {
      const next = await update({ recipients: parseDraft(draft), enabled });
      if (next) {
        setDraft(next.recipients.join(", "));
        setEnabled(next.enabled);
      }
      setFlashTone("good");
      setFlash("SMS alerts saved");
    } catch (e) {
      setFlashTone("bad");
      setFlash(e instanceof Error && e.message ? e.message : "Save failed");
    } finally {
      setBusy(false);
      setTimeout(() => setFlash(null), 2800);
    }
  };

  const handleTest = async () => {
    setBusy(true);
    setFlash(null);
    try {
      const r = await test();
      if (r?.ok) {
        setFlashTone("good");
        setFlash(`Test text sent to ${r.recipient_count} number${r.recipient_count === 1 ? "" : "s"}`);
      } else if (r?.note) {
        setFlashTone("info");
        setFlash(r.note);
      } else {
        setFlashTone("bad");
        setFlash("Send failed — check API logs");
      }
    } catch (e) {
      setFlashTone("bad");
      setFlash(e instanceof Error ? e.message : "Test failed");
    } finally {
      setBusy(false);
      setTimeout(() => setFlash(null), 4500);
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
            Text (SMS) alerts
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Text your crew the moment a monitored address takes a hit — the
            fastest way to get there first. Up to 8 numbers per org.
          </p>
        </div>
        <ConnectionBadge connected={enabled && count > 0 && configured} />
      </div>

      <div className="mt-6 space-y-5">
        <div>
          <label className="font-mono-num text-[10px] uppercase tracking-wide-caps text-foreground/55 block mb-1.5">
            Phone numbers
          </label>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="+1 555 123 4567, +1 888 555 0000"
            rows={2}
            className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm font-mono-num focus:border-copper focus:outline-none resize-none"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Separate with commas or new lines. US numbers are assumed +1.
            {count > 0 && (
              <>
                {" · "}
                <span className="font-mono-num text-foreground/70">{count} valid</span>
              </>
            )}
          </p>
        </div>

        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="accent-copper h-4 w-4"
            disabled={count === 0}
          />
          <span className="text-sm">
            <span className="font-medium text-foreground">Send alerts by text</span>{" "}
            <span className="text-muted-foreground">
              — fires whenever a new alert is generated for a monitored address
            </span>
          </span>
        </label>

        {!configured && (
          <p className="rounded-md border border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
            Texting isn&apos;t connected yet. Set the Twilio keys on the API server
            to start sending — your numbers save now and send once it&apos;s live.
          </p>
        )}

        {flash && (
          <p
            className={cn(
              "text-xs font-mono uppercase tracking-wide-caps",
              flashTone === "good" && "text-forest",
              flashTone === "bad" && "text-destructive",
              flashTone === "info" && "text-copper",
            )}
          >
            {flash}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          {canTest && (
            <button
              type="button"
              onClick={handleTest}
              disabled={busy}
              className="text-[11px] font-mono uppercase tracking-wide-caps text-foreground/55 hover:text-copper disabled:opacity-60"
            >
              Send test text
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-atlas hover:bg-teal-900 disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
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
