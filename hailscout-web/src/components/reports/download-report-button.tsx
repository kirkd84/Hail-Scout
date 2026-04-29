"use client";

import { useState } from "react";
import type { Storm } from "@/lib/api-types";
import { cn } from "@/lib/utils";
import { IconReport } from "@/components/icons";

interface Props {
  storm: Storm;
  address?: string;
  className?: string;
}

/**
 * "Download Hail Impact Report" — generates a branded PDF on the
 * client (no backend roundtrip) and triggers a download. The render
 * library is lazy-loaded so the report deps don't bloat the map page bundle.
 */
export function DownloadReportButton({ storm, address, className }: Props) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const [{ pdf }, { HailImpactReport }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./hail-impact-report"),
      ]);
      const blob = await pdf(
        <HailImpactReport storm={storm} address={address} />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date(storm.start_time).toISOString().slice(0, 10);
      const slug = (address || storm.id).replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      a.download = `HailScout-Impact-Report-${stamp}-${slug}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("PDF generation failed", err);
      alert("PDF generation failed — see console for details.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className={cn(
        "inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-atlas transition-colors hover:bg-teal-900 disabled:opacity-60",
        className,
      )}
    >
      <IconReport className="h-4 w-4" />
      <span>{busy ? "Generating…" : "Download Hail Impact Report"}</span>
    </button>
  );
}
