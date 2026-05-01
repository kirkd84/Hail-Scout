"use client";

import { useState } from "react";
import type { SavedAddress } from "@/lib/saved-addresses";
import { fixturesAtPoint } from "@/lib/storm-fixtures";
import { useBranding } from "@/hooks/useReports";
import { cn } from "@/lib/utils";
import { IconReport } from "@/components/icons";

interface Props {
  addresses: SavedAddress[];
  className?: string;
}

export function PortfolioReportButton({ addresses, className }: Props) {
  const [busy, setBusy] = useState(false);
  const { branding } = useBranding();

  const handleClick = async () => {
    if (busy) return;
    if (addresses.length === 0) {
      alert("Save at least one address first to generate a portfolio report.");
      return;
    }
    setBusy(true);
    try {
      // Build blocks from saved addresses + fixture hits
      const blocks = addresses.map((a) => {
        const hits = fixturesAtPoint(a.lng, a.lat);
        return {
          address: a.address,
          lat: a.lat,
          lng: a.lng,
          label: a.label,
          storms: hits.map((s) => ({
            id: s.id,
            start_time: s.start_time,
            end_time: s.end_time,
            max_hail_size_in: s.max_hail_size_in,
            centroid_lat: s.centroid_lat,
            centroid_lng: s.centroid_lng,
            source: s.source,
          })),
        };
      });

      const [{ pdf }, { PortfolioReport }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./portfolio-report"),
      ]);
      const blob = await pdf(
        <PortfolioReport
          blocks={blocks}
          organizationName={branding?.company_name ?? undefined}
          brandPrimary={branding?.primary ?? undefined}
          brandAccent={branding?.accent ?? undefined}
        />,
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `HailScout-Portfolio-${stamp}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Portfolio PDF failed", err);
      alert("Portfolio PDF generation failed — see console for details.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy || addresses.length === 0}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-copper/50 disabled:opacity-60",
        className,
      )}
    >
      <IconReport className="h-4 w-4 text-copper" />
      {busy ? "Generating PDF…" : "Portfolio report"}
    </button>
  );
}
