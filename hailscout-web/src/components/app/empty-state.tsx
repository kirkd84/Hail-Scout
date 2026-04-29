import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  /** Icon component (one of our @/components/icons exports). */
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  eyebrow?: string;
  title: string;
  description: string;
  /** Optional primary CTA. */
  primary?: { label: string; href: string };
  /** Optional secondary action (link). */
  secondary?: { label: string; href: string };
  className?: string;
}

/**
 * Shared empty-state for inner-app surfaces ("Coming soon" pages,
 * zero-data lists, etc).
 *
 * Uses a contour-line background + atlas-card layout so the page
 * doesn't read as broken — it reads as a future page of the atlas
 * that hasn't been printed yet.
 */
export function EmptyState({
  icon: Icon,
  eyebrow,
  title,
  description,
  primary,
  secondary,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-card px-6 py-16 text-center md:py-20",
        className,
      )}
    >
      {/* Contour line decoration */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-40"
        viewBox="0 0 600 240"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path d="M-20,180 Q140,150 300,170 T620,150" fill="none" stroke="hsl(var(--teal-700))" strokeWidth="0.6" opacity="0.18" />
        <path d="M-20,140 Q140,110 300,128 T620,108" fill="none" stroke="hsl(var(--teal-700))" strokeWidth="0.6" opacity="0.14" />
        <path d="M-20,100 Q140,72 300,86 T620,68"  fill="none" stroke="hsl(var(--teal-700))" strokeWidth="0.6" opacity="0.10" />
      </svg>

      <div className="relative">
        {Icon && (
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-copper/40 bg-copper/10 text-copper">
            <Icon className="h-5 w-5" />
          </div>
        )}
        {eyebrow && (
          <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-copper">{eyebrow}</p>
        )}
        <h2 className="mt-2 font-display text-3xl font-medium tracking-tight-display text-foreground">
          {title}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>

        {(primary || secondary) && (
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            {primary && (
              <Link
                href={primary.href}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-atlas transition-colors hover:bg-teal-900"
              >
                {primary.label} <span aria-hidden>→</span>
              </Link>
            )}
            {secondary && (
              <Link
                href={secondary.href}
                className="text-sm text-foreground/70 transition-colors hover:text-copper"
              >
                {secondary.label}
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
