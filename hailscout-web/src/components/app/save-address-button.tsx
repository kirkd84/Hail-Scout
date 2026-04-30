"use client";

import { useState } from "react";
import { useSavedAddresses } from "@/hooks/useSavedAddresses";
import { cn } from "@/lib/utils";
import { IconAddresses, IconClose } from "@/components/icons";

interface Props {
  address: string;
  lat: number;
  lng: number;
  /** Most recent storm size at this address (optional, for the cached KPI). */
  lastStormSizeIn?: number;
  /** ISO timestamp of the most recent storm. */
  lastStormAt?: string;
  className?: string;
}

/**
 * Toggle button shown above the storm list in the search results sheet.
 * Click to save / unsave the searched address. Persists in localStorage.
 */
export function SaveAddressButton({
  address,
  lat,
  lng,
  lastStormSizeIn,
  lastStormAt,
  className,
}: Props) {
  const { addresses, save, remove, exists } = useSavedAddresses();
  const saved = exists(lat, lng);
  const existingId = saved
    ? addresses.find((a) => Math.abs(a.lat - lat) < 0.0005 && Math.abs(a.lng - lng) < 0.0005)?.id
    : undefined;

  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    setBusy(true);
    try {
      if (saved && existingId) {
        await remove(existingId);
      } else {
        await save({
          address,
          lat,
          lng,
          last_storm_size_in: lastStormSizeIn,
          last_storm_at: lastStormAt,
        });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("save-address failed", err);
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
        "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-all",
        saved
          ? "border-copper bg-copper/10 text-copper-700 hover:bg-copper/15"
          : "border-border bg-card text-foreground/85 hover:border-copper/50 hover:text-foreground",
        className,
      )}
      aria-pressed={saved}
    >
      {saved ? <IconClose className="h-3.5 w-3.5" /> : <IconAddresses className="h-3.5 w-3.5" />}
      <span>{saved ? "Monitoring" : "Monitor address"}</span>
    </button>
  );
}
