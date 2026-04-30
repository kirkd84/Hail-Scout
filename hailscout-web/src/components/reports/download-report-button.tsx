"use client";

import { useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Storm } from "@/lib/api-types";
import { captureMapSnapshot } from "@/lib/map-snapshot";
import { cn } from "@/lib/utils";
import { IconReport } from "@/components/icons";

interface Props {
  storm: Storm;
  address?: string;
  /** When provided, captures a snapshot of the live map and embeds it. */
  map?: MapLibreMap | null;
  className?: string;
}

/**
 * "Download Hail Impact Report" — generates a branded PDF on the
 * client (no backend roundtrip) and triggers a download.
 *
 * If a live map ref is passed, we fly to the storm's bounding box and
 * embed a PNG snapshot of the swath in the PDF. Otherwise the report
 * still generates without a map image.
 */
export function DownloadReportButton({ storm, address, map, className }: Props) {
  const [busy, setBusy] = useState<"capture" | "render" | null>(null);

  const handleClick = async () => {
    if (busy) return;
    try {
      let mapImage: string | undefined;
      if (map && storm.bbox) {
        setBusy("capture");
        const pad = 0.05;
        try {
          mapImage = await captureMapSnapshot(map, {
            bounds: [
              [storm.bbox.min_lng - pad, storm.bbox.min_lat - pad],
              [storm.bbox.max_lng + pad, storm.bbox.max_lat + pad],
            ],
            padding: 50,
            duration: 600,
          });
        } catch {
          // Snapshot failed — continue without it
          mapImage = undefined;
        }
      }

      setBusy("render");
      const [{ pdf }, { HailImpactReport }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./hail-impact-report"),
      ]);
      const blob = await pdf(
        <HailImpactReport storm={storm} address={address} mapImage={mapImage} />,
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
      setBusy(null);
    }
  };

  const label =
    busy === "capture"
      ? "Capturing storm snapshot…"
      : busy === "render"
      ? "Generating report…"
      : "Download Hail Impact Report";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy !== null}
      className={cn(
        "inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-atlas transition-colors hover:bg-teal-900 disabled:opacity-60",
        className,
      )}
    >
      <IconReport className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}
