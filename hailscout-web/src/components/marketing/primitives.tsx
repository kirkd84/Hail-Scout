import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ContourBg } from "@/components/brand/contour-bg";

/**
 * Marketing primitives — the "Storm Instrument" component contract.
 *
 * Server-component-safe (no hooks here; ContourBg is a client leaf).
 * Pages compose these instead of hand-rolling headings/cards/CTAs so
 * the marketing site keeps one rhythm:
 *
 *   - SectionHeading: mono eyebrow → display-2 title → capped lede
 *   - MarketingCard:  bg-card / border / rounded-xl (shadow only when elevated)
 *   - CtaBand:        always-slate band + contour texture + cyan primary button
 *                     (never a full-width cyan section)
 */

interface SectionHeadingProps {
  eyebrow?: string;
  title: ReactNode;
  lede?: ReactNode;
  align?: "left" | "center";
  className?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  lede,
  align = "left",
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2 className={cn("display-2 text-foreground", eyebrow && "mt-3")}>{title}</h2>
      {lede && (
        <p className="mt-4 max-w-prose text-base leading-[1.65] text-muted-foreground text-pretty">
          {lede}
        </p>
      )}
    </div>
  );
}

interface MarketingCardProps {
  children: ReactNode;
  /** Adds shadow-panel — reserve for interactive / featured cards. */
  elevated?: boolean;
  className?: string;
}

export function MarketingCard({ children, elevated = false, className }: MarketingCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-6",
        elevated && "shadow-panel",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface CtaLink {
  label: string;
  href: string;
}

interface CtaBandProps {
  title: ReactNode;
  lede?: ReactNode;
  primary: CtaLink;
  secondary?: CtaLink;
  className?: string;
}

/**
 * CTA band — deep-slate plate with quiet contour texture and a cyan
 * primary button. The plate is *always* dark (teal-900 / cream ramps
 * are mode-invariant), so it reads like the product map in both themes.
 */
export function CtaBand({ title, lede, primary, secondary, className }: CtaBandProps) {
  return (
    <section className={cn("py-24 md:py-32", className)}>
      <div className="container max-w-6xl">
        <div className="relative overflow-hidden rounded-xl border border-teal-700/70 bg-teal-900 px-6 py-14 text-center sm:px-10 md:py-20">
          <ContourBg density="sparse" fadeBottom={false} className="text-cream-50 opacity-70" />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="display-2 text-cream-50">{title}</h2>
            {lede && (
              <p className="mx-auto mt-4 max-w-prose text-base leading-[1.65] text-teal-200/90 text-pretty">
                {lede}
              </p>
            )}
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href={primary.href}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-copper-700 sm:w-auto"
              >
                {primary.label}
              </Link>
              {secondary && (
                <Link
                  href={secondary.href}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-cream-50/25 px-5 text-sm font-medium text-cream-50 transition-colors hover:bg-cream-50/10 sm:w-auto"
                >
                  {secondary.label}
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
