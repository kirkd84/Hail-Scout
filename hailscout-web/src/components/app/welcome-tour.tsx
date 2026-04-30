"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/brand/wordmark";
import {
  IconSearch,
  IconLayers,
  IconPin,
  IconCommand,
  IconClose,
  IconChevronRight,
} from "@/components/icons";

const STORAGE_KEY = "hs.welcome-tour.v1";

interface Step {
  icon: React.ReactNode;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    icon: <IconSearch className="h-5 w-5" />,
    title: "Search any address",
    body: "Type any U.S. address into the search pill at the top. We'll show you every hailstorm that's ever hit it. Press ⌘K from anywhere to focus the search.",
  },
  {
    icon: <IconLayers className="h-5 w-5" />,
    title: "Switch the basemap",
    body: "The bottom toggle swaps Atlas, Streets, Satellite, and Hybrid. Use Streets for navigation, Satellite for visual roof inspection, Hybrid for both at once.",
  },
  {
    icon: <IconPin className="h-5 w-5" />,
    title: "Drop pins as you canvass",
    body: "Click 'Drop a pin' on the bottom right, then tap the map. Mark every door — lead, knocked, no answer, appointment, contract. Saved on your device.",
  },
  {
    icon: <IconCommand className="h-5 w-5" />,
    title: "Command palette is your friend",
    body: "Press ⌘K (Ctrl-K on Windows) to jump anywhere — pages, recent storms, theme toggle, super-admin. The fastest way to get around.",
  },
];

/**
 * One-time welcome card shown on /app/map for first-time users.
 * Persists 'seen' flag in localStorage so it never re-appears.
 *
 * Skippable from the X button or by clicking the backdrop.
 */
export function WelcomeTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (!seen) {
        // Tiny delay so it doesn't fight with the page mount paint
        const t = setTimeout(() => setOpen(true), 700);
        return () => clearTimeout(t);
      }
    } catch {
      // ignore
    }
  }, []);

  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
  };

  if (!open) return null;
  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center px-4 bg-background/55 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={close}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-panel animate-in zoom-in-95 duration-300"
      >
        {/* Topo decoration */}
        <svg
          className="pointer-events-none absolute inset-x-0 top-0 h-32 w-full opacity-50"
          viewBox="0 0 480 128"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path d="M-10,30 Q120,18 260,30 T520,22"  fill="none" stroke="hsl(var(--teal-700))" strokeWidth="0.6" opacity="0.25" />
          <path d="M-10,52 Q120,40 260,50 T520,42"  fill="none" stroke="hsl(var(--teal-700))" strokeWidth="0.6" opacity="0.18" />
          <path d="M-10,78 Q120,68 260,72 T520,66"  fill="none" stroke="hsl(var(--teal-700))" strokeWidth="0.6" opacity="0.12" />
          <path d="M0,68 Q140,40 260,52 T480,40" fill="none" stroke="hsl(var(--copper-500))" strokeWidth="1" opacity="0.7" />
          <circle cx="260" cy="52" r="2" fill="hsl(var(--copper-500))" />
        </svg>

        <button
          type="button"
          onClick={close}
          className="absolute right-4 top-4 z-10 rounded-md p-1 text-foreground/40 transition-colors hover:bg-foreground/5 hover:text-foreground"
          aria-label="Close tour"
        >
          <IconClose className="h-4 w-4" />
        </button>

        <div className="relative px-7 pt-7 pb-4">
          <div className="mb-1">
            <Wordmark size="sm" pulse href={null} />
          </div>
          <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-copper">
            Welcome to the atlas
          </p>
        </div>

        <div className="rule-atlas mx-7 mb-5" />

        <div className="px-7 pb-2 min-h-[180px]">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-copper/40 bg-copper/10 text-copper">
              {s.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-display text-2xl font-medium tracking-tight-display text-foreground">
                {s.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {s.body}
              </p>
            </div>
          </div>
        </div>

        {/* Step dots */}
        <div className="flex items-center justify-center gap-1.5 py-3">
          {STEPS.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to step ${i + 1}`}
              onClick={() => setStep(i)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === step ? "w-6 bg-copper" : "w-1.5 bg-foreground/20 hover:bg-foreground/35",
              )}
            />
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={close}
            className="text-[11px] font-mono uppercase tracking-wide-caps text-foreground/55 transition-colors hover:text-foreground"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => (isLast ? close() : setStep((s) => s + 1))}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-atlas transition-colors hover:bg-teal-900"
          >
            <span>{isLast ? "Start exploring" : "Next"}</span>
            <IconChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
