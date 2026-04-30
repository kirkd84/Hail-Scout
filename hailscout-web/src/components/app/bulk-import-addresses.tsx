"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useSavedAddresses } from "@/hooks/useSavedAddresses";
import { searchAddress } from "@/lib/geocode";
import { fixturesAtPoint } from "@/lib/storm-fixtures";
import { useIsMobile } from "@/hooks/useIsMobile";
import { cn } from "@/lib/utils";

interface RowState {
  raw: string;
  status: "pending" | "geocoding" | "saved" | "duplicate" | "failed";
  message?: string;
}

const SAMPLE = `2840 N Pleasant Ave, Dallas TX
1100 Congress Ave, Austin TX
715 N Robinson Ave, Oklahoma City OK
820 N Tyler Ave, Wichita KS`;

export function BulkImportAddresses({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const isMobile = useIsMobile();
  const { save, exists } = useSavedAddresses();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<RowState[]>([]);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setText("");
    setRows([]);
    setBusy(false);
  };

  const startImport = async () => {
    const lines = text
      .split(/[\n;,]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 4);
    if (lines.length === 0) return;

    setBusy(true);
    const initial: RowState[] = lines.map((raw) => ({ raw, status: "pending" }));
    setRows(initial);

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      // Mark as geocoding
      setRows((prev) => prev.map((r, j) => (j === i ? { ...r, status: "geocoding" } : r)));
      try {
        const r = await searchAddress(raw);
        if (!r) {
          setRows((prev) => prev.map((row, j) => (j === i ? { ...row, status: "failed", message: "no match" } : row)));
          continue;
        }
        if (exists(r.lat, r.lng)) {
          setRows((prev) => prev.map((row, j) => (j === i ? { ...row, status: "duplicate", message: "already on watchlist" } : row)));
          continue;
        }
        // Compute cached storm meta from local fixtures (best-effort)
        const hits = fixturesAtPoint(r.lng, r.lat);
        const peak = hits.length > 0 ? Math.max(...hits.map((s) => s.max_hail_size_in)) : undefined;
        const last = hits.length > 0
          ? hits.reduce((a, b) => (new Date(a.start_time).getTime() > new Date(b.start_time).getTime() ? a : b)).start_time
          : undefined;

        await save({
          address: r.pretty,
          lat: r.lat,
          lng: r.lng,
          last_storm_size_in: peak,
          last_storm_at: last,
        });
        setRows((prev) => prev.map((row, j) => (j === i ? { ...row, status: "saved" } : row)));
      } catch {
        setRows((prev) => prev.map((row, j) => (j === i ? { ...row, status: "failed", message: "error" } : row)));
      }
    }
    setBusy(false);
  };

  const counts = {
    saved: rows.filter((r) => r.status === "saved").length,
    duplicate: rows.filter((r) => r.status === "duplicate").length,
    failed: rows.filter((r) => r.status === "failed").length,
    pending: rows.filter((r) => r.status === "pending" || r.status === "geocoding").length,
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={
          isMobile
            ? "p-0 bg-card border-t border-border max-h-[88vh] overflow-y-auto rounded-t-2xl"
            : "w-full sm:max-w-lg p-0 bg-card border-l border-border overflow-y-auto"
        }
      >
        <SheetHeader className="px-6 pt-6 pb-3">
          <p className="text-[10px] font-mono uppercase tracking-wide-caps text-copper">
            Import
          </p>
          <SheetTitle className="font-display text-2xl font-medium tracking-tight-display">
            Bulk add addresses
          </SheetTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Paste a list (one per line, or comma/semicolon-separated). We&apos;ll
            geocode each one and save it to your watchlist.
          </p>
        </SheetHeader>

        <div className="px-6">
          <div className="rule-atlas" />
        </div>

        <div className="px-6 py-5 space-y-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder={SAMPLE}
            className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm focus:border-copper focus:outline-none resize-none font-mono-num"
            disabled={busy}
          />
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setText(SAMPLE)}
              className="text-[11px] font-mono uppercase tracking-wide-caps text-foreground/55 hover:text-copper"
            >
              Try sample addresses
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={reset}
                disabled={busy}
                className="rounded-md border border-border bg-card px-4 py-2 text-sm text-foreground hover:bg-muted disabled:opacity-50"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => void startImport()}
                disabled={busy || text.trim().length === 0}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-atlas hover:bg-teal-900 disabled:opacity-60"
              >
                {busy ? `Importing… (${counts.saved + counts.duplicate + counts.failed}/${rows.length})` : "Geocode + save"}
              </button>
            </div>
          </div>

          {rows.length > 0 && (
            <>
              <div className="rule-atlas" />
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat tone="forest" label="Saved" value={counts.saved} />
                <Stat tone="muted"  label="Duplicates" value={counts.duplicate} />
                <Stat tone="destructive" label="Failed" value={counts.failed} />
              </div>
              <ul className="rounded-md border border-border bg-card divide-y divide-border/60 max-h-72 overflow-y-auto">
                {rows.map((r, i) => (
                  <li key={i} className="flex items-center gap-3 px-3 py-2 text-xs">
                    <StatusDot status={r.status} />
                    <span className="flex-1 min-w-0 truncate font-mono-num text-foreground/85">{r.raw}</span>
                    {r.message && (
                      <span className="text-muted-foreground italic">{r.message}</span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Stat({ tone, label, value }: { tone: "forest" | "muted" | "destructive"; label: string; value: number }) {
  const colors: Record<typeof tone, string> = {
    forest: "text-forest border-forest/30 bg-forest/5",
    muted:  "text-foreground/70 border-border bg-secondary/30",
    destructive: "text-destructive border-destructive/30 bg-destructive/5",
  };
  return (
    <div className={cn("rounded-md border p-3", colors[tone])}>
      <p className="font-display text-2xl font-medium tracking-tight-display">{value}</p>
      <p className="text-[10px] font-mono uppercase tracking-wide-caps">{label}</p>
    </div>
  );
}

function StatusDot({ status }: { status: RowState["status"] }) {
  const map: Record<RowState["status"], { color: string; ring: string; pulse?: boolean }> = {
    pending:    { color: "#A89F92", ring: "rgba(168,159,146,0.25)" },
    geocoding:  { color: "#D87C4A", ring: "rgba(216,124,74,0.3)", pulse: true },
    saved:      { color: "#36C168", ring: "rgba(54,193,104,0.25)" },
    duplicate:  { color: "#E2B843", ring: "rgba(226,184,67,0.25)" },
    failed:     { color: "#A11F2A", ring: "rgba(161,31,42,0.3)" },
  };
  const s = map[status];
  return (
    <span className="relative inline-flex h-2.5 w-2.5">
      <span className="absolute inset-0 rounded-full" style={{ background: s.color, boxShadow: `0 0 0 3px ${s.ring}` }} />
      {s.pulse && <span className="absolute inset-0 rounded-full animate-ping" style={{ background: s.color, opacity: 0.6 }} />}
    </span>
  );
}
