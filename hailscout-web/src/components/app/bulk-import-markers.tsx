"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useMarkers } from "@/hooks/useMarkers";
import { searchAddress } from "@/lib/geocode";
import { useIsMobile } from "@/hooks/useIsMobile";
import { type MarkerStatus } from "@/lib/markers";
import { cn } from "@/lib/utils";

const VALID_STATUSES = new Set([
  "lead", "knocked", "no_answer", "appt", "contract", "not_interested",
]);

interface RowState {
  raw: string;
  status: "pending" | "geocoding" | "saved" | "skipped" | "failed";
  message?: string;
}

const SAMPLE = `address, status, notes
2840 N Pleasant Ave, Dallas TX, lead, Owner Marcus, mentioned hail damage
1100 Congress Ave, Austin TX, knocked, Returned business card
820 N Tyler Ave, Wichita KS, appt, Inspection Tuesday 4pm
6112 Memorial Hwy, OKC OK, contract, Signed 4/26 — start scheduled`;

interface CsvRow {
  address: string;
  lat?: number;
  lng?: number;
  status?: string;
  notes?: string;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  // Skip header if first row contains "address" or "lat"
  const firstLow = lines[0].toLowerCase();
  const start = (firstLow.includes("address") || firstLow.startsWith("lat")) ? 1 : 0;

  const out: CsvRow[] = [];
  for (let i = start; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    if (cells.length === 0) continue;

    // Two supported shapes:
    //   address, status, notes        (no coords — we geocode)
    //   lat, lng, status, notes       (coords already)
    const looksNumeric = /^-?\d/.test(cells[0]) && cells.length >= 2 && /^-?\d/.test(cells[1]);
    if (looksNumeric) {
      out.push({
        address: "",
        lat: parseFloat(cells[0]),
        lng: parseFloat(cells[1]),
        status: cells[2]?.trim().toLowerCase(),
        notes: cells[3]?.trim() || undefined,
      });
    } else {
      out.push({
        address: cells[0]?.trim() ?? "",
        status: cells[1]?.trim().toLowerCase(),
        notes: cells[2]?.trim() || undefined,
      });
    }
  }
  return out;
}

function splitCsvLine(line: string): string[] {
  // Simple CSV splitter — handles double-quoted fields with embedded commas.
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cur += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        out.push(cur);
        cur = "";
      } else {
        cur += c;
      }
    }
  }
  out.push(cur);
  return out;
}

export function BulkImportMarkers({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const isMobile = useIsMobile();
  const { add } = useMarkers();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<RowState[]>([]);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setText("");
    setRows([]);
    setBusy(false);
  };

  const startImport = async () => {
    const parsed = parseCsv(text);
    if (parsed.length === 0) return;
    setBusy(true);

    setRows(parsed.map((r) => ({
      raw: r.address || `${r.lat?.toFixed(4)}, ${r.lng?.toFixed(4)}`,
      status: "pending",
    })));

    for (let i = 0; i < parsed.length; i++) {
      const row = parsed[i];
      setRows((prev) => prev.map((r, j) => (j === i ? { ...r, status: "geocoding" } : r)));

      let lat = row.lat;
      let lng = row.lng;

      // Geocode if no coords
      if ((lat === undefined || lng === undefined) && row.address) {
        try {
          const g = await searchAddress(row.address);
          if (g) {
            lat = g.lat;
            lng = g.lng;
          }
        } catch {
          // ignore
        }
      }

      if (lat === undefined || lng === undefined || isNaN(lat) || isNaN(lng)) {
        setRows((prev) => prev.map((r, j) => (j === i ? { ...r, status: "failed", message: "no coords" } : r)));
        continue;
      }

      // Validate status
      const status: MarkerStatus = (row.status && VALID_STATUSES.has(row.status))
        ? row.status as MarkerStatus
        : "lead";

      try {
        await add({
          lat, lng, status,
          notes: row.notes,
        });
        setRows((prev) => prev.map((r, j) => (j === i ? { ...r, status: "saved", message: status } : r)));
      } catch (err) {
        setRows((prev) => prev.map((r, j) => (j === i ? { ...r, status: "failed", message: "API error" } : r)));
      }
    }
    setBusy(false);
  };

  const counts = {
    saved: rows.filter((r) => r.status === "saved").length,
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
            Bulk import markers
          </SheetTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Paste a CSV. Columns: <code className="font-mono-num text-foreground/85">address, status, notes</code> or
            {" "}<code className="font-mono-num text-foreground/85">lat, lng, status, notes</code>. We&apos;ll geocode addresses, dedupe by coords, and drop a marker per row.
          </p>
        </SheetHeader>

        <div className="px-6">
          <div className="rule-atlas" />
        </div>

        <div className="px-6 py-5 space-y-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
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
              Try sample
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
                {busy ? `Importing… (${counts.saved + counts.failed}/${rows.length})` : "Import"}
              </button>
            </div>
          </div>

          {rows.length > 0 && (
            <>
              <div className="rule-atlas" />
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat tone="forest" label="Saved" value={counts.saved} />
                <Stat tone="muted"  label="Pending" value={counts.pending} />
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
    skipped:    { color: "#E2B843", ring: "rgba(226,184,67,0.25)" },
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
