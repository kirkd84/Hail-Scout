"use client";

import Link from "next/link";
import { useMarkers } from "@/hooks/useMarkers";
import { MARKER_STATUSES, statusInfo } from "@/lib/markers";
import { EmptyState } from "@/components/app/empty-state";
import { IconFlag, IconPin } from "@/components/icons";
import { cn } from "@/lib/utils";

export default function MarkersPage() {
  const { markers, remove, clear } = useMarkers();

  if (markers.length === 0) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="container max-w-3xl py-10">
          <EmptyState
            icon={IconFlag}
            eyebrow="Canvassing markers"
            title="No markers yet."
            description="Drop your first marker on the map. Track every door your crew knocks — lead, knocked, no answer, appointment, contract, or not interested. Synced across your devices via your account (coming soon)."
            primary={{ label: "Drop a pin on the map", href: "/app/map" }}
          />
        </div>
      </div>
    );
  }

  // Group by status for the breakdown stats
  const byStatus = MARKER_STATUSES.map((s) => ({
    ...s,
    count: markers.filter((m) => m.status === s.id).length,
  }));

  // Sort by most recent
  const sorted = [...markers].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="container max-w-5xl py-10 space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-copper">
              Canvassing
            </p>
            <h1 className="mt-1 font-display text-4xl font-medium tracking-tight-display text-foreground">
              Markers
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {markers.length} marker{markers.length === 1 ? "" : "s"} dropped. Stored locally on this device.
            </p>
          </div>
          <Link
            href="/app/map"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-atlas hover:bg-teal-900"
          >
            Drop a pin <span aria-hidden>→</span>
          </Link>
        </div>

        <div className="rule-atlas" />

        {/* Status breakdown */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {byStatus.map((s) => (
            <div key={s.id} className="rounded-md border border-border bg-card p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full ring-2 ring-white" style={{ background: s.color }} />
                <span className="text-[10px] font-mono uppercase tracking-wide-caps text-foreground/55 truncate">
                  {s.label}
                </span>
              </div>
              <p className="font-display text-2xl font-medium tracking-tight-display text-foreground">
                {s.count}
              </p>
            </div>
          ))}
        </div>

        {/* Marker list */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-[40px_2fr_1fr_2fr_120px_60px] border-b border-border bg-secondary/40 text-[11px] font-mono uppercase tracking-wide-caps text-foreground/65">
            <div className="px-3 py-3" />
            <div className="px-4 py-3">Status</div>
            <div className="px-4 py-3">Coordinates</div>
            <div className="px-4 py-3">Notes</div>
            <div className="px-4 py-3">Updated</div>
            <div className="px-4 py-3" />
          </div>
          {sorted.map((m, i) => {
            const info = statusInfo(m.status);
            return (
              <div
                key={m.id}
                className={cn(
                  "grid grid-cols-[40px_2fr_1fr_2fr_120px_60px] items-center hover:bg-secondary/30 transition-colors",
                  i < sorted.length - 1 ? "border-b border-border/60" : "",
                )}
              >
                <div className="px-3 py-3 flex justify-center">
                  <span className="inline-block h-3 w-3 rounded-full ring-2 ring-white" style={{ background: info.color }} />
                </div>
                <div className="px-4 py-3 text-sm font-medium" style={{ color: info.outline }}>
                  {info.label}
                </div>
                <div className="px-4 py-3 text-xs font-mono-num text-foreground/75">
                  {m.lat.toFixed(4)}, {Math.abs(m.lng).toFixed(4)}
                </div>
                <div className="px-4 py-3 text-sm text-foreground/85 truncate">
                  {m.notes || <span className="text-muted-foreground italic">—</span>}
                </div>
                <div className="px-4 py-3 text-xs text-muted-foreground">
                  {new Date(m.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </div>
                <div className="px-4 py-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => remove(m.id)}
                    className="text-[11px] font-mono uppercase tracking-wide-caps text-foreground/40 hover:text-destructive"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {markers.length > 0 && (
          <div className="text-right">
            <button
              type="button"
              onClick={() => {
                if (confirm(`Delete all ${markers.length} markers? This cannot be undone.`)) {
                  clear();
                }
              }}
              className="text-[11px] font-mono uppercase tracking-wide-caps text-foreground/40 hover:text-destructive"
            >
              Clear all markers
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
