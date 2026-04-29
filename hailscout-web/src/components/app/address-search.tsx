"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { HailAtAddressResponse } from "@/lib/api-types";
import { useStormsAtAddress } from "@/hooks/useStormsAtAddress";
import { IconSearch, IconClose } from "@/components/icons";
import { cn } from "@/lib/utils";

interface AddressSearchProps {
  onResultsFound?: (lat: number, lng: number) => void;
  onResultsChange?: (data: HailAtAddressResponse) => void;
}

/**
 * Glass-morphism address search pill, top-center of the map.
 *
 * Apple-Maps-grade simplicity:
 *  - Single floating pill (no "card" surrounding chrome)
 *  - Submit-on-enter, no separate button
 *  - Inline loading / error / result hint just below the pill
 *
 * Does NOT do client-side geocoding autocomplete yet — that's a
 * Mapbox/MapTiler call we'll wire in next pass. For now this fires
 * a single search on submit.
 */
export function AddressSearch({
  onResultsFound,
  onResultsChange,
}: AddressSearchProps) {
  const [value, setValue] = useState("");
  const [submitted, setSubmitted] = useState<string | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { data, isLoading, error } = useStormsAtAddress(submitted);

  // Forward to parent on success
  useEffect(() => {
    if (data) {
      onResultsFound?.(data.lat, data.lng);
      onResultsChange?.(data);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Cmd-K / Ctrl-K focuses the search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = value.trim();
      if (!trimmed) return;
      setSubmitted(trimmed);
    },
    [value],
  );

  const showHint = isLoading || error || data;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-6 z-20 flex justify-center px-4">
      <div className="pointer-events-auto w-full max-w-xl">
        <form onSubmit={handleSubmit}>
          <div
            className={cn(
              "glass flex items-center gap-3 rounded-full px-4 py-2.5 shadow-panel",
              "transition-shadow focus-within:shadow-atlas-lg",
            )}
          >
            <IconSearch className="h-4 w-4 text-foreground/55" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search any address — see every storm that hit it"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className={cn(
                "flex-1 bg-transparent text-sm text-foreground placeholder:text-foreground/45",
                "outline-none focus:outline-none",
              )}
              aria-label="Search address"
            />
            {value && (
              <button
                type="button"
                onClick={() => {
                  setValue("");
                  setSubmitted(undefined);
                  inputRef.current?.focus();
                }}
                className="text-foreground/40 transition-colors hover:text-foreground"
                aria-label="Clear search"
              >
                <IconClose className="h-3.5 w-3.5" />
              </button>
            )}
            <span className="hidden md:inline-flex items-center gap-0.5 font-mono text-[10px] text-foreground/45">
              ⌘ <span>K</span>
            </span>
          </div>
        </form>

        {showHint && (
          <div className="mt-2 px-2">
            {isLoading && (
              <p className="text-xs font-mono-num text-foreground/55 flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-copper" />
                Searching the atlas…
              </p>
            )}
            {error && !isLoading && (
              <p className="text-xs text-destructive">
                {error instanceof Error ? error.message : "Search failed"}
              </p>
            )}
            {data && !isLoading && !error && (
              <p className="text-xs text-foreground/65 leading-relaxed">
                <span className="font-medium text-foreground">{data.address}</span>
                {" — "}
                <span className="font-mono-num text-copper">{data.storms.length}</span>{" "}
                storm{data.storms.length === 1 ? "" : "s"} found
                {data.storms.length > 0 && (
                  <>
                    {", "}
                    peak{" "}
                    <span className="font-mono-num font-medium text-foreground">
                      {Math.max(...data.storms.map((s) => s.max_hail_size_in)).toFixed(2)}″
                    </span>
                  </>
                )}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
