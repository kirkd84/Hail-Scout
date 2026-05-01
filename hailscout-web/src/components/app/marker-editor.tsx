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
import { useTeam } from "@/hooks/useTeam";
import { MarkerNotesThread } from "@/components/app/marker-notes-thread";

interface MarkerEditorProps {
  marker: Marker | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, patch: { status: MarkerStatus; notes?: string; assignee_user_id?: string | null }) => void;
  onDelete: (id: string) => void;
}


const ROOF_TYPES = ["Asphalt shingle", "Metal", "Tile", "Wood shake", "Flat / TPO", "Other"] as const;
const DAMAGE_OPTIONS = [
  "Granule loss",
  "Shingle bruising",
  "Cracked shingles",
  "Dented metal",
  "Broken tiles",
  "Gutter damage",
  "Window damage",
  "Soft metal dents",
  "Skylight damage",
  "Vent / cap damage",
] as const;

interface Inspection {
  roof_type?: string;
  age_years?: number | null;
  damage?: string[];
  photos?: number;
}

function parseInspection(notes: string | undefined): { plain: string; inspection: Inspection | null } {
  if (!notes) return { plain: "", inspection: null };
  // Notes can be either plain string or "::INSPECT::{json}\n<plain text>"
  const TAG = "::INSPECT::";
  if (!notes.startsWith(TAG)) return { plain: notes, inspection: null };
  const rest = notes.slice(TAG.length);
  const newline = rest.indexOf("\n");
  const jsonPart = newline === -1 ? rest : rest.slice(0, newline);
  const plain = newline === -1 ? "" : rest.slice(newline + 1);
  try {
    const parsed = JSON.parse(jsonPart);
    return { plain, inspection: parsed };
  } catch {
    return { plain: notes, inspection: null };
  }
}

function serializeInspection(plain: string, inspection: Inspection | null): string {
  if (!inspection || (
    !inspection.roof_type &&
    !inspection.age_years &&
    (!inspection.damage || inspection.damage.length === 0) &&
    !inspection.photos
  )) {
    return plain;
  }
  return "::INSPECT::" + JSON.stringify(inspection) + (plain ? "\n" + plain : "");
}

export function MarkerEditor({
  marker,
  isOpen,
  onClose,
  onSave,
  onDelete,
}: MarkerEditorProps) {
  const isMobile = useIsMobile();
  const { members } = useTeam();
  const [assignee, setAssignee] = useState<string | null>(marker?.assignee_user_id ?? null);
  const initial = parseInspection(marker?.notes);
  const [plainNotes, setPlainNotes] = useState(initial.plain);
  const [inspection, setInspection] = useState<Inspection | null>(initial.inspection);
  const [status, setStatus] = useState<MarkerStatus>(marker?.status ?? "lead");
  const [notes, setNotes] = useState(marker?.notes ?? "");

  useEffect(() => {
    if (marker) {
      setStatus(marker.status);
      setNotes(marker.notes ?? "");
      setAssignee(marker.assignee_user_id ?? null);
      const parsed = parseInspection(marker.notes ?? undefined);
      setPlainNotes(parsed.plain);
      setInspection(parsed.inspection);
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

          {/* Inspection (only when status is knocked or beyond) */}
          {(status === "knocked" || status === "appt" || status === "contract") && (
            <InspectionPanel inspection={inspection} setInspection={setInspection} />
          )}

          {/* Assignee */}
          {members.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-mono uppercase tracking-wide-caps text-copper">Assigned to</p>
              <select
                value={assignee ?? ""}
                onChange={(e) => setAssignee(e.target.value || null)}
                className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm focus:border-copper focus:outline-none"
              >
                <option value="">— Unassigned —</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.email.split("@")[0]} ({m.role})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Notes */}
          <div>
            <p className="mb-2 text-[10px] font-mono uppercase tracking-wide-caps text-copper">Notes</p>
            <textarea
              value={plainNotes}
              onChange={(e) => setPlainNotes(e.target.value)}
              rows={3}
              placeholder="Roofer's notes — owner name, last contact, hail damage observed…"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-copper focus:outline-none resize-none"
            />
          </div>

          {/* Thread */}
          <MarkerNotesThread markerId={marker.id} />

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
                  const combined = serializeInspection(plainNotes.trim(), inspection);
                  onSave(marker.id, {
                    status,
                    notes: combined || undefined,
                    assignee_user_id: assignee,
                  });
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


function InspectionPanel({
  inspection,
  setInspection,
}: {
  inspection: Inspection | null;
  setInspection: (next: Inspection | null) => void;
}) {
  const i = inspection ?? {};
  const update = (patch: Partial<Inspection>) => setInspection({ ...i, ...patch });

  const toggleDamage = (d: string) => {
    const cur = new Set(i.damage ?? []);
    if (cur.has(d)) cur.delete(d);
    else cur.add(d);
    update({ damage: Array.from(cur) });
  };

  return (
    <div className="rounded-lg border border-copper/30 bg-copper/5 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-copper-700">
          Roof inspection
        </p>
        {inspection && (
          <button
            type="button"
            onClick={() => setInspection(null)}
            className="text-[10px] font-mono uppercase tracking-wide-caps text-foreground/55 hover:text-destructive"
          >
            Clear
          </button>
        )}
      </div>

      <div>
        <p className="text-[10px] font-mono uppercase tracking-wide-caps text-foreground/55 mb-1.5">Roof type</p>
        <div className="flex flex-wrap gap-1.5">
          {ROOF_TYPES.map((rt) => (
            <button
              type="button"
              key={rt}
              onClick={() => update({ roof_type: rt })}
              className={
                "rounded-full px-3 py-1 text-xs transition-colors " +
                (i.roof_type === rt
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card text-foreground/70 hover:border-copper/50")
              }
            >
              {rt}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[10px] font-mono uppercase tracking-wide-caps text-foreground/55 mb-1.5">Age estimate (years)</p>
        <input
          type="number"
          min={0}
          max={50}
          value={i.age_years ?? ""}
          onChange={(e) => update({ age_years: e.target.value ? Number(e.target.value) : null })}
          className="w-32 rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-copper focus:outline-none"
          placeholder="—"
        />
      </div>

      <div>
        <p className="text-[10px] font-mono uppercase tracking-wide-caps text-foreground/55 mb-1.5">Damage observed</p>
        <div className="flex flex-wrap gap-1.5">
          {DAMAGE_OPTIONS.map((d) => {
            const active = (i.damage ?? []).includes(d);
            return (
              <button
                type="button"
                key={d}
                onClick={() => toggleDamage(d)}
                className={
                  "rounded-full px-3 py-1 text-xs transition-colors " +
                  (active
                    ? "bg-destructive/15 text-destructive ring-1 ring-destructive/40"
                    : "border border-border bg-card text-foreground/70 hover:border-destructive/30")
                }
              >
                {active ? "✓ " : ""}{d}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
