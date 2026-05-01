"use client";

import { useEffect, useState } from "react";
import { IconClose } from "@/components/icons";
import { cn } from "@/lib/utils";

interface Shortcut {
  keys: string[];
  label: string;
  context?: string;
}

const GLOBAL: Shortcut[] = [
  { keys: ["⌘", "K"],     label: "Open command palette" },
  { keys: ["?"],          label: "Show keyboard shortcuts" },
  { keys: ["esc"],        label: "Close any open modal / sheet" },
];

const PALETTE: Shortcut[] = [
  { keys: ["↑", "↓"],     label: "Move focus between options" },
  { keys: ["↵"],          label: "Select highlighted option" },
];

const MAP: Shortcut[] = [
  { keys: ["⌘", "K"],     label: "Focus the address search" },
  { keys: ["esc"],        label: "Cancel sweep / drop-pin mode" },
  { keys: ["↵"],          label: "Close polygon while sweeping" },
];

export function ShortcutsModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Only trigger '?' when not in an input/textarea
      const target = e.target as HTMLElement | null;
      const inField = target?.matches("input, textarea, select, [contenteditable]");
      if (e.key === "?" && !inField) {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape" && open) setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-background/55 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-panel"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-copper">
              Reference
            </p>
            <p className="font-display text-lg font-medium tracking-tight-display">
              Keyboard shortcuts
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="text-foreground/40 hover:text-foreground"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-5 max-h-[70vh] overflow-y-auto">
          <Group title="Global">{GLOBAL.map((s) => <Row key={s.label} {...s} />)}</Group>
          <Group title="Command palette">{PALETTE.map((s) => <Row key={s.label} {...s} />)}</Group>
          <Group title="Atlas (map page)">{MAP.map((s) => <Row key={s.label} {...s} />)}</Group>
        </div>
        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <span className="text-[10px] font-mono uppercase tracking-wide-caps text-foreground/45">
            Press ? anywhere to reopen
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-[11px] font-mono uppercase tracking-wide-caps text-foreground/55 hover:text-foreground"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="text-[10px] font-mono uppercase tracking-wide-caps text-foreground/55 mb-2">{title}</h4>
      <ul className="space-y-1.5">{children}</ul>
    </section>
  );
}

function Row({ keys, label }: Shortcut) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="text-sm text-foreground/85">{label}</span>
      <span className="flex items-center gap-1">
        {keys.map((k, i) => (
          <kbd
            key={i}
            className={cn(
              "inline-flex h-5 min-w-[20px] items-center justify-center rounded border border-border bg-secondary px-1.5",
              "text-[10px] font-mono text-foreground/85",
            )}
          >
            {k}
          </kbd>
        ))}
      </span>
    </li>
  );
}
