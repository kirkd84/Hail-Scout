"use client";

import { useState, useEffect } from "react";
import { MARKER_STATUSES, statusInfo, type Marker, type MarkerStatus } from "@/lib/markers";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useIsMobile";

interface MarkerEditorProps {
  marker: Marker | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, patch: { status: MarkerStatus; notes?: string }) => void;
  onDelete: (id: string) => void;
}

export function MarkerEditor({
  marker,
  isOpen,
  onClose,
  onSave,
  onDelete,
}: MarkerEditorProps) {
  const isMobile = useIsMobile();
  const [status, setStatus] = useState<MarkerStatus>(marker?.status ?? "lead");
  const [notes, setNotes] = useState(marker?.notes ?? "");

  useEffect(() => {
    if (marker) {
      setStatus(marker.status);
      setNotes(marker.notes ?? "");
    }
  }, [marker]);

  if (!marker) return null;
  const info = statusInfo(status);

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={isMobile ? "p-0 bg-card border-t border-border max-h-[88vh] overflow-y-auto rounded-t-2xl" : "w-full sm:max-w-md p-0 bg-card border-l border-border"}
      >
        <SheetHeader className="px-6 pt-6 pb-3">
          <p className="text-[10px] font-mono uppercase tracking-wide-caps text-copper">
            Canvassing marker
          </p>
          <SheetTitle className="font-display text-2xl font-medium tracking-tight-display">
            Update marker
          </SheetTitle>
          <p className="font-mono-num text-xs text-muted-foreground">
            {marker.lat.toFixed(5)}°N, {Math.abs(marker.lng).toFixed(5)}°W
          </p>
        </SheetHeader>

        <div className="px-6">
          <div className="rule-atlas" />
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Status hero */}
          <div
            className="rounded-xl border p-5 flex items-center gap-4"
            style={{ background: `${info.color}1a`, borderColor: `${info.outline}55` }}
          >
            <div
              className="h-10 w-10 rounded-full ring-4 ring-white"
              style={{ background: info.color }}
              aria-hidden
            />
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wide-caps" style={{ color: info.outline }}>
                Current status
              </p>
              <p className="font-display text-2xl font-medium tracking-tight-display" style={{ color: info.outline }}>
                {info.label}
              </p>
            </div>
          </div>

          {/* Status picker */}
          <div>
            <p className="mb-2 text-[10px] font-mono uppercase tracking-wide-caps text-copper">Set status</p>
            <div className="grid grid-cols-2 gap-2">
              {MARKER_STATUSES.map((s) => {
                const active = s.id === status;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStatus(s.id)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm transition-all text-left",
                      active
                        ? "border-foreground/30 shadow-atlas"
                        : "border-border hover:border-foreground/30",
                    )}
                    style={
                      active
                        ? { background: `${s.color}1a`, borderColor: `${s.outline}66` }
                        : undefined
                    }
                  >
                    <span
                      className="inline-block h-3 w-3 rounded-full ring-2 ring-white"
                      style={{ background: s.color }}
                    />
                    <span className={cn("font-medium", active && "text-foreground")} style={active ? { color: s.outline } : undefined}>
                      {s.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <p className="mb-2 text-[10px] font-mono uppercase tracking-wide-caps text-copper">Notes</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Roofer's notes — owner name, last contact, hail damage observed…"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-copper focus:outline-none resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => {
                onDelete(marker.id);
                onClose();
              }}
              className="text-xs font-mono uppercase tracking-wide-caps text-destructive hover:text-destructive/80"
            >
              Delete marker
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-border bg-card px-4 py-2 text-sm text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onSave(marker.id, { status, notes: notes.trim() || undefined });
                  onClose();
                }}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-atlas hover:bg-teal-900"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
