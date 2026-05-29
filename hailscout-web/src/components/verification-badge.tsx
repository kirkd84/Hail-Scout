"use client";

import type { Verification } from "@/lib/api-types";
import { cn } from "@/lib/utils";

/**
 * Multi-source verification badge (Phase 24). Renders the tier as a
 * colored pill. Optionally expands into the full evidence breakdown
 * (defensibility statement + signal checklist) for detail views.
 *
 * The tier scale, strongest → weakest:
 *   ground_truth_confirmed · dual_pol_confirmed · multi_source ·
 *   radar_indicated · unverified
 */

const TIER_STYLE: Record<string, { dot: string; text: string; ring: string; bg: string }> = {
  ground_truth_confirmed: { dot: "bg-forest", text: "text-forest", ring: "ring-forest/30", bg: "bg-forest/10" },
  dual_pol_confirmed:     { dot: "bg-teal-700", text: "text-teal-700", ring: "ring-teal-700/30", bg: "bg-teal-700/10" },
  multi_source:           { dot: "bg-blue-600", text: "text-blue-700", ring: "ring-blue-600/30", bg: "bg-blue-600/10" },
  radar_indicated:        { dot: "bg-copper", text: "text-copper-700", ring: "ring-copper/30", bg: "bg-copper/10" },
  unverified:             { dot: "bg-destructive", text: "text-destructive", ring: "ring-destructive/30", bg: "bg-destructive/10" },
};

function styleFor(tier: string) {
  return TIER_STYLE[tier] ?? TIER_STYLE.radar_indicated;
}

export function VerificationBadge({
  verification,
  className,
}: {
  verification?: Verification | null;
  className?: string;
}) {
  if (!verification) return null;
  const s = styleFor(verification.tier);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wide-caps ring-1",
        s.bg, s.text, s.ring, className,
      )}
      title={verification.defensibility}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {verification.tier_label}
    </span>
  );
}

/** Full evidence panel — badge + defensibility paragraph + signal list.
 *  Used on detail surfaces (storm sheet, claim result expansion). */
export function VerificationPanel({
  verification,
  className,
}: {
  verification?: Verification | null;
  className?: string;
}) {
  if (!verification) return null;
  const s = styleFor(verification.tier);
  return (
    <div className={cn("rounded-lg border p-4", s.ring, className)}>
      <div className="flex items-center justify-between gap-2">
        <VerificationBadge verification={verification} />
        <span className="font-mono-num text-[11px] text-foreground/55">
          {Math.round(verification.confidence * 100)}% confidence
        </span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-foreground/85">
        {verification.defensibility}
      </p>
      <ul className="mt-3 space-y-1.5">
        {verification.signals.map((sig) => (
          <li key={sig.key} className="flex items-start gap-2 text-xs">
            <span className={cn("mt-0.5 font-mono", sig.present ? s.text : "text-foreground/35")}>
              {sig.present ? "✓" : "—"}
            </span>
            <span>
              <span className="font-medium text-foreground">{sig.label}</span>
              <span className="text-foreground/55"> · {sig.detail}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
