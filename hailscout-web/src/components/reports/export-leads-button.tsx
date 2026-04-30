"use client";

import { useState } from "react";
import type { Storm } from "@/lib/api-types";
import { useSavedAddresses } from "@/hooks/useSavedAddresses";
import { hailColor } from "@/lib/hail";
import { cn } from "@/lib/utils";

/**
 * Export every monitored address inside a storm's bbox as a CSV.
 *
 * For demo purposes, owner contact data is mocked deterministically from
 * the address (so the same address always produces the same fake owner).
 * In production this would call /v1/contacts which proxies Cole-sourced
 * contact data.
 */
function mockContact(address: string): { owner: string; phone: string; email: string } {
  let h = 0;
  for (let i = 0; i < address.length; i++) h = (h * 31 + address.charCodeAt(i)) >>> 0;
  const FIRST = ["James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda", "David", "Barbara", "William", "Elizabeth", "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah", "Charles", "Karen"];
  const LAST  = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Miller", "Davis", "Garcia", "Rodriguez", "Wilson", "Martinez", "Anderson", "Taylor", "Thomas", "Hernandez", "Moore", "Martin", "Jackson", "Thompson", "White"];
  const first = FIRST[h % FIRST.length];
  const last  = LAST[(h >> 5) % LAST.length];
  const owner = `${first} ${last}`;
  const phone = `+1 (${500 + (h % 400)}) ${100 + ((h >> 7) % 900)}-${1000 + ((h >> 11) % 9000)}`;
  const email = `${first.toLowerCase()}.${last.toLowerCase()}${(h % 90) + 10}@example.com`;
  return { owner, phone, email };
}

function csvCell(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return "";
  const str = String(s);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

interface Props {
  storm: Storm;
  className?: string;
}

export function ExportLeadsButton({ storm, className }: Props) {
  const { addresses } = useSavedAddresses();
  const [busy, setBusy] = useState(false);

  const handleClick = () => {
    if (busy) return;
    if (!storm.bbox) return;
    setBusy(true);

    const { min_lat, min_lng, max_lat, max_lng } = storm.bbox;
    const insideStorm = addresses.filter(
      (a) =>
        a.lat >= min_lat && a.lat <= max_lat && a.lng >= min_lng && a.lng <= max_lng,
    );

    if (insideStorm.length === 0) {
      alert(
        "None of your monitored addresses fall inside this storm's bounding box. Save some addresses first and try again.",
      );
      setBusy(false);
      return;
    }

    const c = hailColor(storm.max_hail_size_in);
    const headers = [
      "address",
      "lat",
      "lng",
      "label",
      "owner_name",
      "phone",
      "email",
      "storm_peak_size_in",
      "storm_object",
      "storm_started_at",
      "storm_ended_at",
      "storm_id",
    ];
    const rows = insideStorm.map((a) => {
      const m = mockContact(a.address);
      return [
        csvCell(a.address),
        csvCell(a.lat),
        csvCell(a.lng),
        csvCell(a.label ?? ""),
        csvCell(m.owner),
        csvCell(m.phone),
        csvCell(m.email),
        csvCell(storm.max_hail_size_in.toFixed(2)),
        csvCell(c.object),
        csvCell(storm.start_time),
        csvCell(storm.end_time),
        csvCell(storm.id),
      ].join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date(storm.start_time).toISOString().slice(0, 10);
    a.href = url;
    a.download = `HailScout-Leads-${stamp}-${storm.id.slice(-8)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setBusy(false);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className={cn(
        "inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-card px-4 py-3 text-sm font-medium text-foreground transition-colors hover:border-copper/50 hover:bg-muted disabled:opacity-60",
        className,
      )}
      title="Export every monitored address inside this storm as a CSV"
    >
      <svg viewBox="0 0 16 16" className="h-4 w-4 text-copper" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 13H13M8 2V11M5 8L8 11L11 8" />
      </svg>
      Export leads (CSV)
    </button>
  );
}
