"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HailAtAddressResponse } from "@/lib/api-types";
import { useStormsAtAddress } from "@/hooks/useStormsAtAddress";
import { searchAddressSuggestions, type GeocodeResult } from "@/lib/geocode";
import { IconSearch, IconClose, IconPin } from "@/components/icons";
import { cn, debounce } from "@/lib/utils";

interface AddressSearchProps {
  onResultsFound?: (lat: number, lng: number) => void;
  onResultsChange?: (data: HailAtAddressResponse) => void;
}

/**
 * Glass-morphism address search with MapTiler autocomplete dropdown.
 *
 * Behaviour:
 *  - Type → debounced (180 ms) suggestion fetch, max 5 results
 *  - Arrow keys move focus through suggestions, Enter submits
 *  - Click a suggestion → submits with that geocoded result
 *  - Plain Enter without selection → submits the typed query as-is
 *
 * Cmd-K / Ctrl-K from anywhere on the page focuses the input.
 */
export function AddressSearch({
  onResultsFound,
  onResultsChange,
}: AddressSearchProps) {
  const [value, setValue] = useState("");
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([]);
  const [highlight, setHighlight] = useState(-1);
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState<string | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const requestSeq = useRef(0);

  const { data, isLoading, error } = useStormsAtAddress(submitted);

  // Forward to parent on success
  useEffect(() => {
    if (data) {
      onResultsFound?.(data.lat, data.lng);
      onResultsChange?.(data);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Debounced autocomplete
  const debouncedFetch = useMemo(
    () =>
      debounce(async (q: string) => {
        const seq = ++requestSeq.current;
        if (q.trim().length < 2) {
          setSuggestions([]);
          return;
        }
        const results = await searchAddressSuggestions(q, 5);
        // Drop stale responses
        if (seq !== requestSeq.current) return;
        setSuggestions(results);
        setHighlight(-1);
      }, 180),
    [],
  );

  // Cmd-K to focus
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const submitText = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setValue(trimmed);
      setSubmitted(trimmed);
      setOpen(false);
      setSuggestions([]);
    },
    [],
  );

  const submitGeocoded = useCallback((r: GeocodeResult) => {
    setValue(r.pretty);
    setSubmitted(r.pretty);
    setOpen(false);
    setSuggestions([]);
    // Notify parent immediately with the geocoded coordinates so the map
    // pans without waiting for the API roundtrip
    onResultsFound?.(r.lat, r.lng);
  }, [onResultsFound]);

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(suggestions.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(-1, h - 1));
    } else if (e.key === "Enter") {
      if (highlight >= 0 && suggestions[highlight]) {
        e.preventDefault();
        submitGeocoded(suggestions[highlight]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const showHint = !open && (isLoading || error || data);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-6 z-30 flex justify-center px-4">
      <div className="pointer-events-auto w-full max-w-xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (highlight >= 0 && suggestions[highlight]) {
              submitGeocoded(suggestions[highlight]);
            } else {
              submitText(value);
            }
          }}
        >
          <div
            className={cn(
              "glass flex items-center gap-3 rounded-full px-4 py-2.5 shadow-panel transition-shadow",
              "focus-within:shadow-atlas-lg",
              open && suggestions.length > 0 && "rounded-b-none rounded-t-2xl",
            )}
          >
            <IconSearch className="h-4 w-4 text-foreground/55" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search any address — see every storm that hit it"
              value={value}
              onChange={(e) => {
                const v = e.target.value;
                setValue(v);
                setOpen(true);
                debouncedFetch(v);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => {
                // Delay so a click on a suggestion still fires
                setTimeout(() => setOpen(false), 150);
              }}
              onKeyDown={handleKey}
              className={cn(
                "flex-1 bg-transparent text-sm text-foreground placeholder:text-foreground/45",
                "outline-none focus:outline-none",
              )}
              aria-label="Search address"
              aria-autocomplete="list"
              aria-expanded={open}
              role="combobox"
            />
            {value && (
              <button
                type="button"
                onClick={() => {
                  setValue("");
                  setSubmitted(undefined);
                  setSuggestions([]);
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

          {/* Suggestions dropdown */}
          {open && suggestions.length > 0 && (
            <ul
              className="glass overflow-hidden rounded-b-2xl border-t-0 shadow-panel"
              role="listbox"
            >
              {suggestions.map((s, i) => {
                const active = i === highlight;
                return (
                  <li key={s.id} role="option" aria-selected={active}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        submitGeocoded(s);
                      }}
                      onMouseEnter={() => setHighlight(i)}
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors",
                        active
                          ? "bg-copper/10"
                          : "hover:bg-foreground/5",
                      )}
                    >
                      <IconPin className={cn("mt-0.5 h-4 w-4 shrink-0", active ? "text-copper" : "text-foreground/40")} />
                      <span className="flex-1 min-w-0">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {s.short}
                        </span>
                        {s.context && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {s.context}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </form>

        {showHint && (
          <div className="mt-2 px-2">
            {isLoading && (
              <p className="flex items-center gap-2 text-xs font-mono-num text-foreground/55">
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
              <p className="text-xs leading-relaxed text-foreground/65">
                <span className="font-medium text-foreground">{data.address}</span>
                {" — "}
                <span className="font-mono-num text-copper">{data.storms.length}</span>{" "}
                storm{data.storms.length === 1 ? "" : "s"} found
                {data.storms.length > 0 && (
                  <>
                    {", peak "}
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
