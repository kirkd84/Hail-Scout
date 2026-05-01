"use client";

import { useState, useEffect } from "react";
import { useSlackConfig } from "@/hooks/useSlackConfig";
import { cn } from "@/lib/utils";

export function SlackCard() {
  const { config, update, test } = useSlackConfig();
  const [url, setUrl] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [flashTone, setFlashTone] = useState<"good" | "bad">("good");

  useEffect(() => {
    if (!config) return;
    setEnabled(config.enabled);
    // Don't pre-fill the URL — show the masked variant in placeholder
  }, [config]);

  const handleSave = async () => {
    setBusy(true);
    setFlash(null);
    try {
      await update({
        webhook_url: url.trim() || undefined,
        enabled,
      });
      setUrl("");
      setFlashTone("good");
      setFlash(url.trim() ? "Slack saved" : "Slack updated");
    } catch (e) {
      setFlashTone("bad");
      setFlash(
        e instanceof Error && e.message ? e.message : "Failed to update Slack config",
      );
    } finally {
      setBusy(false);
      setTimeout(() => setFlash(null), 2400);
    }
  };

  const handleTest = async () => {
    setBusy(true);
    setFlash(null);
    try {
      const r = await test();
      setFlashTone(r?.ok ? "good" : "bad");
      setFlash(r?.ok ? "Test message sent — check your Slack channel" : "Slack rejected the test message");
    } catch (e) {
      setFlashTone("bad");
      setFlash(e instanceof Error ? e.message : "Test failed");
    } finally {
      setBusy(false);
      setTimeout(() => setFlash(null), 3500);
    }
  };

  const isConfigured = !!config?.webhook_masked;

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-foreground/55">
            Integrations
          </p>
          <h2 className="mt-1 font-display text-2xl font-medium tracking-tight-display">
            Slack
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Post storm alerts to a Slack channel of your choice. We don&apos;t
            hold a Slack API key — paste an incoming-webhook URL.
          </p>
        </div>
        <SlackBadge connected={isConfigured && enabled} />
      </div>

      <div className="mt-6 space-y-5">
        <div>
          <label className="font-mono-num text-[10px] uppercase tracking-wide-caps text-foreground/55 block mb-1.5">
            Incoming webhook URL
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={config?.webhook_masked ?? "https://hooks.slack.com/services/T…/B…/…"}
            className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm font-mono-num focus:border-copper focus:outline-none"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Create one at <span className="text-copper">https://api.slack.com/apps</span> → Your App → Incoming Webhooks → Add Webhook to Workspace.
          </p>
        </div>

        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="accent-copper h-4 w-4"
            disabled={!isConfigured && !url.trim()}
          />
          <span className="text-sm">
            <span className="font-medium text-foreground">Send alerts to Slack</span>{" "}
            <span className="text-muted-foreground">— posts a message every time a new alert is generated</span>
          </span>
        </label>

        {flash && (
          <p className={cn(
            "text-xs font-mono uppercase tracking-wide-caps",
            flashTone === "good" ? "text-forest" : "text-destructive",
          )}>
            {flash}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          {isConfigured && (
            <button
              type="button"
              onClick={handleTest}
              disabled={busy}
              className="text-[11px] font-mono uppercase tracking-wide-caps text-foreground/55 hover:text-copper disabled:opacity-60"
            >
              Send test message
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

function SlackBadge({ connected }: { connected: boolean }) {
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
      {connected ? "Connected" : "Off"}
    </span>
  );
}
