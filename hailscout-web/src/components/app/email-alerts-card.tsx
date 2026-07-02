"use client";

import { useEffect, useState } from "react";
import { useEmailAlertsConfig } from "@/hooks/useEmailAlertsConfig";
import { cn } from "@/lib/utils";

/**
 * Per-org email-alert config card. Siblings the Slack card on
 * Settings → Integrations. Three controls:
 *
 *   1. Recipient list (≤ 8 addresses) — comma/whitespace-separated
 *   2. Enable toggle — auto-disables if zero recipients
 *   3. Minimum hail size — org-wide default, overridable per address
 *
 * Test-send button is conditional on the recipient list being non-empty
 * AND the toggle being on, so it can't fire mystery emails after the
 * user wipes the list.
 */
export function EmailAlertsCard() {
  const { config, update, test } = useEmailAlertsConfig();

  const [draft, setDraft] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [minSize, setMinSize] = useState(0.75);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [flashTone, setFlashTone] = useState<"good" | "bad" | "info">("good");

  useEffect(() => {
    if (!config) return;
    setDraft(config.recipients.join(", "));
    setEnabled(config.enabled);
    setMinSize(config.min_size_in);
  }, [config]);

  const parseDraft = (raw: string): string[] =>
    raw
      .split(/[,\s;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.includes("@"));

  const recipientsCount = parseDraft(draft).length;
  const canTest = enabled && recipientsCount > 0;

  const handleSave = async () => {
    setBusy(true);
    setFlash(null);
    try {
      const next = await update({
        recipients: parseDraft(draft),
        enabled,
        min_size_in: minSize,
      });
      if (next) {
        // Re-mirror server-cleaned values
        setDraft(next.recipients.join(", "));
        setEnabled(next.enabled);
        setMinSize(next.min_size_in);
      }
      setFlashTone("good");
      setFlash("Email alerts saved");
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
        setFlash(
          `Test sent to ${r.recipient_count} recipient${
            r.recipient_count === 1 ? "" : "s"
          } — check inboxes`,
        );
      } else if (r?.note) {
        // Server returned ok:false with an explanation (typically the
        // RESEND_API_KEY-missing skip path). Surface the note verbatim
        // so this card is honest about prod-vs-dev send state.
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
            Email alerts
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Send a notification email when a monitored address takes a hit at
            or above your threshold. Up to 8 recipients per org.
          </p>
        </div>
        <ConnectionBadge connected={enabled && recipientsCount > 0} />
      </div>

      <div className="mt-6 space-y-5">
        <div>
          <label className="font-mono-num text-[10px] uppercase tracking-wide-caps text-foreground/55 block mb-1.5">
            Recipients
          </label>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="ops@yourroofing.com, sales@yourroofing.com"
            rows={2}
            className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm font-mono-num focus:border-copper focus:outline-none resize-none"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Separate addresses with commas, semicolons, or new lines.
            {recipientsCount > 0 && (
              <>
                {" · "}
                <span className="font-mono-num text-foreground/70">
                  {recipientsCount} valid
                </span>
              </>
            )}
          </p>
        </div>

        <div>
          <label className="font-mono-num text-[10px] uppercase tracking-wide-caps text-foreground/55 block mb-1.5">
            Minimum hail size
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0.50"
              max="3.00"
              step="0.25"
              value={minSize}
              onChange={(e) => setMinSize(parseFloat(e.target.value))}
              className="flex-1 accent-copper"
            />
            <span className="font-mono-num text-sm w-14 text-right tabular-nums">
              {minSize.toFixed(2)}″
            </span>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Org-wide default. Individual addresses can override on the
            Monitored Addresses page.
          </p>
        </div>

        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="accent-copper h-4 w-4"
            disabled={recipientsCount === 0}
          />
          <span className="text-sm">
            <span className="font-medium text-foreground">Send alerts by email</span>{" "}
            <span className="text-muted-foreground">
              — fires whenever a new alert is generated for a monitored address
            </span>
          </span>
        </label>

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
              Send test email
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-atlas hover:bg-copper-700 disabled:opacity-60"
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
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          connected ? "bg-forest" : "bg-foreground/35",
        )}
      />
      {connected ? "On" : "Off"}
    </span>
  );
}
